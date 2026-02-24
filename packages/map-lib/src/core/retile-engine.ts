import type { Cell } from '@nookstead/shared';
import type {
  CellCacheEntry,
  CellPatchEntry,
  EdgeDirection,
  MapPatchEntry,
  MaterialPriorityMap,
  RetileEngineOptions,
  RetileResult,
  RoutingTable,
} from '../types/routing-types';
import type { EditorLayer, MapEditorState } from '../types/editor-types';
import type { MaterialInfo, TilesetInfo } from '../types/material-types';
import { TilesetRegistry } from './tileset-registry';
import { buildGraphs } from './graph-builder';
import { computeRoutingTable } from './router';
import {
  selectTilesetForCell,
  computeCellFrame,
  resolveRenderTilesetKey,
  type OwnedEdgeInfo,
} from './cell-tileset-selector';
import { resolveEdge } from './edge-resolver';
import { classifyEdge } from './edge-classifier';
import { SOLID_FRAME, NE, SE, SW, NW } from './autotile';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cardinal direction offsets: [dx, dy, EdgeDirection]. */
const CARDINAL_OFFSETS: ReadonlyArray<readonly [number, number, EdgeDirection]> = [
  [0, -1, 'N'],
  [1, 0, 'E'],
  [0, 1, 'S'],
  [-1, 0, 'W'],
];

/**
 * Diagonal commit rules from center:
 * [dx, dy, requiredCardinalA, requiredCardinalB]
 *
 * A diagonal neighbor of a painted cell is committed only when
 * both adjacent cardinal edges (from the painted center) are
 * C1/C2/C3 (stable). This ensures diagonals near C4/C5 borders
 * are not forcibly committed.
 */
const DIAGONAL_COMMIT_RULES: ReadonlyArray<
readonly [number, number, EdgeDirection, EdgeDirection]
> = [
  [-1, -1, 'N', 'W'], // NW corner
  [1, -1, 'N', 'E'],  // NE corner
  [1, 1, 'S', 'E'],   // SE corner
  [-1, 1, 'S', 'W'],  // SW corner
];

/**
 * Diagonal direction offsets for base-mode diagonal closure:
 * [dx, dy, autotile bit constant].
 */
const DIAGONAL_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [1, -1, NE],
  [1, 1, SE],
  [-1, 1, SW],
  [-1, -1, NW],
];

interface ComputedCellResult {
  x: number;
  y: number;
  fg: string;
  oldCache: CellCacheEntry | undefined;
  newCache: CellCacheEntry;
}

// ---------------------------------------------------------------------------
// RetileEngine
// ---------------------------------------------------------------------------

/**
 * Central orchestrator for the autotile routing pipeline.
 *
 * Maintains per-cell cache, propagates dirty sets via Chebyshev R=2,
 * and calls EdgeResolver/CellTilesetSelector for each dirty cell.
 * Replaces `recomputeAutotileLayers`.
 *
 * Input state is NEVER mutated -- all methods return new objects.
 */
export class RetileEngine {
  private registry: TilesetRegistry;
  private router: RoutingTable;
  private readonly width: number;
  private readonly height: number;
  private readonly materials: ReadonlyMap<string, MaterialInfo>;
  private readonly priorities: MaterialPriorityMap;
  private readonly preferences: ReadonlyArray<string>;

  /** Per-cell cache indexed as `[y][x]`. */
  private cache: (CellCacheEntry | null)[][];

  /** Reverse index: selected tileset key -> set of flat cell indices. */
  private cellsBySelectedTilesetKey: Map<string, Set<number>>;

  /** Reverse index: render tileset key -> set of flat cell indices. */
  private cellsByRenderTilesetKey: Map<string, Set<number>>;

  /**
   * Create a new RetileEngine.
   *
   * Internally constructs TilesetRegistry, builds material graphs,
   * and computes the BFS routing table.
   *
   * @param options - Engine configuration options.
   */
  constructor(options: RetileEngineOptions) {
    this.width = options.width;
    this.height = options.height;
    this.materials = options.materials;
    this.priorities = options.materialPriority ?? new Map();
    this.preferences = options.preferences ?? [];

    this.registry = new TilesetRegistry(options.tilesets);
    const { compatGraph } = buildGraphs(this.registry);
    this.router = computeRoutingTable(compatGraph, this.preferences);

    this.cache = this.createEmptyCache();
    this.cellsBySelectedTilesetKey = new Map();
    this.cellsByRenderTilesetKey = new Map();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Apply a map patch (T1/T2 trigger): paint one or more cells.
   *
   * Updates grid terrain for each patch entry, propagates dirty set
   * via Chebyshev R=2, and recomputes all dirty cells.
   *
   * @param state - Current editor state (never mutated).
   * @param patch - Array of cells to paint.
   * @returns RetileResult with updated grid, layers, patches, and metrics.
   */
  applyMapPatch(
    state: MapEditorState,
    patch: ReadonlyArray<MapPatchEntry>,
  ): RetileResult {
    if (this.width === 0 || this.height === 0) {
      return {
        layers: state.layers,
        patches: [],
        rebuiltCells: 0,
        grid: state.grid,
      };
    }

    // Clone grid immutably
    const newGrid = this.cloneGrid(state.grid);

    // Apply terrain changes and collect changed positions
    const changedPositions: Array<{ x: number; y: number }> = [];
    const paintedPatches: Array<{
      x: number;
      y: number;
      oldFg: string;
      newFg: string;
    }> = [];

    for (const entry of patch) {
      if (entry.x < 0 || entry.x >= this.width || entry.y < 0 || entry.y >= this.height) {
        continue; // Skip OOB
      }

      const oldFg = newGrid[entry.y][entry.x].terrain;
      newGrid[entry.y][entry.x] = {
        ...newGrid[entry.y][entry.x],
        terrain: entry.fg as Cell['terrain'],
      };
      changedPositions.push({ x: entry.x, y: entry.y });
      paintedPatches.push({ x: entry.x, y: entry.y, oldFg, newFg: entry.fg });
    }

    if (changedPositions.length === 0) {
      return {
        layers: state.layers,
        patches: [],
        rebuiltCells: 0,
        grid: state.grid,
      };
    }

    // Compute dirty set via Chebyshev R=2
    const dirtySet = this.expandDirtySet(changedPositions);

    // Clone layers and rebuild dirty cells
    const newLayers = this.cloneLayers(state.layers);
    const cellPatches = this.rebuildCells(newGrid, newLayers, dirtySet, paintedPatches);

    return {
      layers: newLayers,
      patches: cellPatches,
      rebuiltCells: dirtySet.size,
      grid: newGrid,
    };
  }

  /**
   * Update a tileset's mask-to-tile mapping (T3a trigger).
   *
   * Finds cells using the given tilesetKey via reverse indices and
   * recomputes frameId only (not tileset selection).
   *
   * @param state - Current editor state (never mutated).
   * @param tilesetKey - Key of the tileset being updated.
   * @param _newMaskToTile - New mask-to-tile mapping (reserved for future use).
   * @returns RetileResult with updated layers.
   */
  updateTileset(
    state: MapEditorState,
    tilesetKey: string,
    _newMaskToTile?: unknown,
  ): RetileResult {
    // Find all cells that use this tileset
    const affectedIndices = new Set<number>();
    const selectedSet = this.cellsBySelectedTilesetKey.get(tilesetKey);
    const renderSet = this.cellsByRenderTilesetKey.get(tilesetKey);

    if (selectedSet) {
      for (const idx of selectedSet) affectedIndices.add(idx);
    }
    if (renderSet) {
      for (const idx of renderSet) affectedIndices.add(idx);
    }

    if (affectedIndices.size === 0) {
      return {
        layers: state.layers,
        patches: [],
        rebuiltCells: 0,
        grid: state.grid,
      };
    }

    const newLayers = this.cloneLayers(state.layers);
    const patches: CellPatchEntry[] = [];

    for (const flatIdx of affectedIndices) {
      const x = flatIdx % this.width;
      const y = Math.floor(flatIdx / this.width);
      const oldCache = this.cache[y]?.[x] ?? undefined;

      // Recompute frame only -- keep selectedTilesetKey, bg, orientation from cache
      const fg = state.grid[y][x].terrain;
      const cachedBg = oldCache?.bg ?? '';
      const cachedOrientation = oldCache?.orientation ?? '';
      const { frameId } = computeCellFrame(
        state.grid, x, y, this.width, this.height, fg,
        cachedBg, cachedOrientation || undefined,
      );
      const selectedKey = oldCache?.selectedTilesetKey || this.resolveBaseTilesetKeyForMaterial(fg);
      const renderKey = resolveRenderTilesetKey(
        fg, selectedKey, frameId, this.materials, this.registry, cachedBg,
      );

      const newCache: CellCacheEntry = {
        fg,
        selectedTilesetKey: selectedKey,
        renderTilesetKey: renderKey,
        frameId,
        bg: cachedBg,
        orientation: cachedOrientation,
      };

      this.updateCacheEntry(x, y, newCache);
      this.writeToLayers(newLayers, x, y, frameId, renderKey);

      patches.push({ x, y, oldFg: fg, newFg: fg, oldCache, newCache });
    }

    return {
      layers: newLayers,
      patches,
      rebuiltCells: affectedIndices.size,
      grid: state.grid,
    };
  }

  /**
   * Remove a tileset (T3b trigger).
   *
   * Rebuilds registry, graphs, and routing table, then recomputes
   * cells near affected materials.
   *
   * @param state - Current editor state (never mutated).
   * @param tilesetKey - Key of the tileset to remove.
   * @returns RetileResult with updated layers.
   */
  removeTileset(
    state: MapEditorState,
    tilesetKey: string,
  ): RetileResult {
    const info = this.registry.getTilesetInfo(tilesetKey);
    const affectedMaterials = new Set<string>();
    if (info?.fromMaterialKey) affectedMaterials.add(info.fromMaterialKey);
    if (info?.toMaterialKey) affectedMaterials.add(info.toMaterialKey);

    // Rebuild with filtered tilesets
    const newTilesets = state.tilesets.filter(t => t.key !== tilesetKey);
    this.rebuildRouting(newTilesets);

    // Dirty all cells near affected materials
    return this.rebuildAffectedMaterials(state, affectedMaterials);
  }

  /**
   * Add a new tileset (T3b trigger).
   *
   * Rebuilds registry, graphs, and routing table, then recomputes
   * cells near affected materials.
   *
   * @param state - Current editor state (never mutated).
   * @param tilesetInfo - New tileset descriptor to add.
   * @returns RetileResult with updated layers.
   */
  addTileset(
    state: MapEditorState,
    tilesetInfo: TilesetInfo,
  ): RetileResult {
    const affectedMaterials = new Set<string>();
    if (tilesetInfo.fromMaterialKey) affectedMaterials.add(tilesetInfo.fromMaterialKey);
    if (tilesetInfo.toMaterialKey) affectedMaterials.add(tilesetInfo.toMaterialKey);

    // Rebuild with expanded tilesets
    const newTilesets = [...state.tilesets, tilesetInfo];
    this.rebuildRouting(newTilesets);

    // Dirty all cells near affected materials
    return this.rebuildAffectedMaterials(state, affectedMaterials);
  }

  /**
   * Switch the entire tileset group (T4 trigger).
   *
   * Performs a full rebuild with a new tileset set: replaces registry,
   * rebuilds graphs and routing table, clears cache, and recomputes
   * every cell.
   *
   * @param state - Current editor state (never mutated).
   * @param tilesets - New complete tileset array.
   * @returns RetileResult with fully rebuilt layers.
   */
  switchTilesetGroup(
    state: MapEditorState,
    tilesets: ReadonlyArray<TilesetInfo>,
  ): RetileResult {
    // Rebuild routing with new tilesets
    this.rebuildRouting(tilesets);

    // Clear cache and indices
    this.cache = this.createEmptyCache();
    this.cellsBySelectedTilesetKey.clear();
    this.cellsByRenderTilesetKey.clear();

    // Full rebuild
    return this.rebuild(state, 'full');
  }

  /**
   * Rebuild cells: full or local mode.
   *
   * @param state - Current editor state (never mutated).
   * @param mode - 'full' recomputes all cells; 'local' expands changedCells by R=2.
   * @param changedCells - Cells to start from (only used in 'local' mode).
   * @returns RetileResult with rebuilt layers.
   */
  rebuild(
    state: MapEditorState,
    mode: 'full' | 'local',
    changedCells?: ReadonlyArray<{ x: number; y: number }>,
  ): RetileResult {
    if (this.width === 0 || this.height === 0) {
      return {
        layers: state.layers,
        patches: [],
        rebuiltCells: 0,
        grid: state.grid,
      };
    }

    let dirtySet: Set<number>;

    if (mode === 'full') {
      dirtySet = new Set<number>();
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          dirtySet.add(y * this.width + x);
        }
      }
    } else {
      const positions = changedCells
        ? Array.from(changedCells)
        : [];
      dirtySet = this.expandDirtySet(positions);
    }

    const newLayers = this.cloneLayers(state.layers);
    const patches = this.rebuildCells(state.grid, newLayers, dirtySet, []);

    return {
      layers: newLayers,
      patches,
      rebuiltCells: dirtySet.size,
      grid: state.grid,
    };
  }

  /**
   * Get the internal per-cell cache (for testing / inspection).
   *
   * @returns The current cache grid.
   */
  getCache(): ReadonlyArray<ReadonlyArray<CellCacheEntry | null>> {
    return this.cache;
  }

  /**
   * Get the cellsBySelectedTilesetKey reverse index (for testing / inspection).
   *
   * @returns The selected tileset key index map.
   */
  getCellsBySelectedTilesetKey(): ReadonlyMap<string, ReadonlySet<number>> {
    return this.cellsBySelectedTilesetKey;
  }

  /**
   * Get the cellsByRenderTilesetKey reverse index (for testing / inspection).
   *
   * @returns The render tileset key index map.
   */
  getCellsByRenderTilesetKey(): ReadonlyMap<string, ReadonlySet<number>> {
    return this.cellsByRenderTilesetKey;
  }

  // -------------------------------------------------------------------------
  // Private: Core Recompute
  // -------------------------------------------------------------------------

  /**
   * Recompute tileset selection and frame for all cells in the dirty set.
   *
   * @param grid - The (possibly updated) grid to read cell data from.
   * @param layers - Mutable layers to write frames and tilesetKeys to.
   * @param dirtySet - Set of flat cell indices to recompute.
   * @param paintedPatches - Cells whose terrain was changed (for patch oldFg/newFg).
   * @returns Array of CellPatchEntry for undo support.
   */
  private rebuildCells(
    grid: Cell[][],
    layers: EditorLayer[],
    dirtySet: Set<number>,
    paintedPatches: ReadonlyArray<{
      x: number;
      y: number;
      oldFg: string;
      newFg: string;
    }>,
  ): CellPatchEntry[] {
    const patches: CellPatchEntry[] = [];

    // Build a lookup for painted cells' old/new fg
    const paintedLookup = new Map<number, { oldFg: string; newFg: string }>();
    for (const p of paintedPatches) {
      paintedLookup.set(p.y * this.width + p.x, { oldFg: p.oldFg, newFg: p.newFg });
    }

    // Deterministic order: top-to-bottom, left-to-right (flat index order).
    const dirtyIndices = Array.from(dirtySet).sort((a, b) => a - b);
    const computed = new Map<number, ComputedCellResult>();

    // Phase 1: compute candidate output for every dirty cell.
    for (const flatIdx of dirtyIndices) {
      const x = flatIdx % this.width;
      const y = Math.floor(flatIdx / this.width);

      const oldCache = this.cache[y]?.[x] ?? undefined;
      const fg = grid[y][x].terrain;

      // 1. Resolve edge ownership for cardinal foreign neighbors.
      //    Owner-side contracts + C3 bridge promotions are collected.
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>();
      let hasForeignCardinal = false;

      for (const [dx, dy, dir] of CARDINAL_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
          continue; // OOB neighbor -- no edge
        }

        const neighborFg = grid[ny][nx].terrain;
        if (neighborFg === fg) {
          continue; // Same material -- no transition needed
        }

        hasForeignCardinal = true;

        const edgeOwner = resolveEdge(
          fg,
          neighborFg,
          dir,
          this.router,
          this.registry,
          this.priorities,
        );

        if (edgeOwner?.owner === fg) {
          // Cell wins ownership of this edge.
          ownedEdges.set(dir, {
            bg: edgeOwner.bg,
            neighborMaterial: neighborFg,
          });
        } else {
          // Cell does NOT own this edge. Check if it's a C3 bridge edge
          // AND the cell has no standalone base tileset in the registry.
          //
          // C3 edges have both-direct pairs through a common intermediate hop.
          // When the cell lacks a standalone base tileset (its baseTilesetKey
          // in the materials map points to a transition tileset), the non-owner
          // side must still enter transition mode so that the correct autotile
          // shape is computed. Cells WITH a standalone base tileset can fall
          // back cleanly and do not need bridge promotion.
          const hasStandaloneBase = this.registry.getBaseTilesetKey(fg) !== undefined;
          if (!hasStandaloneBase) {
            const edgeClass = classifyEdge(fg, neighborFg, this.router, this.registry);
            if (edgeClass === 'C3') {
              const virtualBG = this.router.nextHop(fg, neighborFg);
              if (virtualBG !== null) {
                const pair = this.registry.resolvePair(fg, virtualBG);
                if (pair && pair.orientation === 'direct') {
                  ownedEdges.set(dir, {
                    bg: virtualBG,
                    neighborMaterial: neighborFg,
                  });
                }
              }
            }
          }
        }
      }

      // 1b. Determine if this cell has a standalone base tileset in the registry.
      //     Cells WITH a standalone base tileset that have foreign cardinals
      //     use "close foreign cardinals" mode (Mode B-base) instead of
      //     returning SOLID_FRAME (Mode B-solid).
      const hasStandaloneBase = this.registry.getBaseTilesetKey(fg) !== undefined;
      const closeForeignCardinals = hasStandaloneBase && hasForeignCardinal && ownedEdges.size === 0;

      // 1c. Compute closeDiagonalMask for base-mode cells. Only C2 (symmetric
      //     direct pair) foreign diagonals are closed to prevent visual corner
      //     indent artifacts when both sides have direct tilesets. C3/C4/C5
      //     diagonals remain open so that natural autotile shapes are preserved
      //     for multi-hop transitions.
      //     This applies both to Mode C (no foreign cardinals) and Mode B-base
      //     (foreign cardinals but standalone base tileset).
      let closeDiagonalMask = 0;
      const isBaseMode = ownedEdges.size === 0;
      const shouldComputeDiagonalClosure = isBaseMode && (!hasForeignCardinal || closeForeignCardinals);
      if (shouldComputeDiagonalClosure) {
        for (const [ddx, ddy, diagonalBit] of DIAGONAL_OFFSETS) {
          const dnx = x + ddx;
          const dny = y + ddy;
          if (dnx < 0 || dnx >= this.width || dny < 0 || dny >= this.height) {
            continue;
          }
          const diagFg = grid[dny][dnx].terrain;
          if (diagFg === fg) continue;
          const diagEdgeClass = classifyEdge(fg, diagFg, this.router, this.registry);
          if (diagEdgeClass === 'C2') {
            closeDiagonalMask |= diagonalBit;
          }
        }
      }

      // 2. Select tileset for this cell (now returns orientation for mask computation)
      const selection = selectTilesetForCell(
        fg, ownedEdges, this.registry, this.priorities, this.preferences,
      );

      // Guard against empty logical keys when content defines base provider
      // only in materials.baseTilesetKey (common in production data).
      const selectedTilesetKey = selection.selectedTilesetKey
        || this.resolveBaseTilesetKeyForMaterial(fg);
      const bg = selection.selectedTilesetKey ? selection.bg : '';
      const orientation = selection.selectedTilesetKey ? selection.orientation : '';

      // 2b. Compute bgMatchMaterials for transition mode.
      //     Materials that route to FG through the selected BG are treated
      //     as BG-side neighbors in the transition mask (bit=0), preventing
      //     false corner artifacts in multi-hop routing chains.
      let bgMatchMaterials: Set<string> | undefined;
      if (bg !== '') {
        bgMatchMaterials = new Set<string>();
        // Check each unique neighbor material.
        for (const [ndx, ndy] of [...CARDINAL_OFFSETS.map(([dx, dy]) => [dx, dy] as const), ...DIAGONAL_OFFSETS.map(([dx, dy]) => [dx, dy] as const)]) {
          const nnx = x + ndx;
          const nny = y + ndy;
          if (nnx < 0 || nnx >= this.width || nny < 0 || nny >= this.height) continue;
          const nFg = grid[nny][nnx].terrain;
          if (nFg === fg || nFg === bg || bgMatchMaterials.has(nFg)) continue;
          // If this neighbor routes to fg through bg, it's on the bg-side.
          const hop = this.router.nextHop(nFg, fg);
          if (hop === bg) {
            bgMatchMaterials.add(nFg);
          }
        }
        if (bgMatchMaterials.size === 0) {
          bgMatchMaterials = undefined; // No extra materials; skip the set
        }
      }

      // 3. Compute frame with selected-mode mask (bg + orientation)
      const { frameId } = computeCellFrame(
        grid, x, y, this.width, this.height, fg, bg,
        orientation || undefined, ownedEdges, closeDiagonalMask, bgMatchMaterials,
        closeForeignCardinals,
      );

      // 4. Resolve render tileset key (pass bg to avoid base-override in transition mode)
      const renderTilesetKey = resolveRenderTilesetKey(
        fg, selectedTilesetKey, frameId, this.materials, this.registry, bg,
      );

      // 5. Create new cache entry
      const newCache: CellCacheEntry = {
        fg,
        selectedTilesetKey,
        renderTilesetKey,
        frameId,
        bg,
        orientation: orientation || '',
      };

      computed.set(flatIdx, {
        x,
        y,
        fg,
        oldCache,
        newCache,
      });
    }

    // Phase 2: commit only mandatory cells for paint operations, or all dirty
    // cells for non-paint recomputes (full rebuild, tileset change).
    const commitSet = paintedLookup.size === 0
      ? new Set<number>(dirtyIndices)
      : this.buildMandatoryCommitSet(grid, paintedLookup);
    const forcedSolidSet = paintedLookup.size === 0
      ? new Set<number>()
      : this.buildForcedSolidSet(grid, paintedLookup, computed);

    // Build set of non-mandatory dirty cells whose computed frame changed from
    // cache AND that lack a standalone base tileset. These must be committed
    // because their visual representation depends entirely on transition tilesets
    // and cannot safely "fall back" to a base state. Cells WITH standalone base
    // tilesets can preserve their old cached state (C4 cardinal preserve policy).
    const visualChangeSet = paintedLookup.size === 0
      ? new Set<number>()
      : this.buildVisualChangeCommitSet(computed, commitSet);

    for (const flatIdx of dirtyIndices) {
      const computedCell = computed.get(flatIdx);
      if (!computedCell) {
        continue;
      }

      const isMandatory = commitSet.has(flatIdx) || visualChangeSet.has(flatIdx);
      const hasPriorVisualState = computedCell.oldCache !== undefined;
      if (!isMandatory && hasPriorVisualState) {
        continue;
      }

      const cacheToCommit = forcedSolidSet.has(flatIdx)
        ? this.withForcedSolidFrame(computedCell.newCache)
        : computedCell.newCache;

      // Update cache and reverse indices
      this.updateCacheEntry(computedCell.x, computedCell.y, cacheToCommit);

      // Write to layers
      this.writeToLayers(
        layers,
        computedCell.x,
        computedCell.y,
        cacheToCommit.frameId,
        cacheToCommit.renderTilesetKey,
      );

      // Create patch entry for committed cells.
      const painted = paintedLookup.get(flatIdx);
      patches.push({
        x: computedCell.x,
        y: computedCell.y,
        oldFg: painted?.oldFg ?? computedCell.fg,
        newFg: painted?.newFg ?? computedCell.fg,
        oldCache: computedCell.oldCache,
        newCache: cacheToCommit,
      });
    }

    return patches;
  }

  /**
   * Build the mandatory commit set for a paint operation.
   *
   * Rules:
   * - Painted center cells always commit.
   * - Cardinal neighbors commit only for edge classes C1/C2/C3
   *   (C4/C5 cardinal neighbors are skipped — no direct tileset bridge).
   * - Diagonal neighbors commit when both adjacent cardinal edges
   *   (from the painted center's perspective) are C1/C2/C3 (stable).
   *   This ensures diagonal cells near C4/C5 borders are not forcibly
   *   committed, while diagonal cells near stable borders get their
   *   blob-47 masks recomputed.
   */
  private buildMandatoryCommitSet(
    grid: Cell[][],
    paintedLookup: ReadonlyMap<number, { oldFg: string; newFg: string }>,
  ): Set<number> {
    const commitSet = new Set<number>();

    for (const flatIdx of paintedLookup.keys()) {
      // 1) Painted centers always commit.
      commitSet.add(flatIdx);

      const x = flatIdx % this.width;
      const y = Math.floor(flatIdx / this.width);
      const centerFg = grid[y][x].terrain;
      const stableCardinals = new Set<EdgeDirection>();

      // 2) Cardinal neighbors: commit C1/C2/C3, track stable directions.
      for (const [dx, dy, dir] of CARDINAL_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
          continue;
        }

        const neighborFg = grid[ny][nx].terrain;
        const edgeClass = classifyEdge(centerFg, neighborFg, this.router, this.registry);

        if (edgeClass === 'C1' || edgeClass === 'C2' || edgeClass === 'C3') {
          stableCardinals.add(dir);
          commitSet.add(ny * this.width + nx);
        }
      }

      // 3) Diagonal neighbors: commit when both adjacent cardinals are stable.
      for (const [dx, dy, dirA, dirB] of DIAGONAL_COMMIT_RULES) {
        if (!stableCardinals.has(dirA) || !stableCardinals.has(dirB)) {
          continue;
        }
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
          continue;
        }
        commitSet.add(ny * this.width + nx);
      }
    }

    return commitSet;
  }

  /**
   * Build a frame-override set for C2 paint seams:
   * when a painted transition center is adjacent to a base-mode non-owner C2 neighbor,
   * force that neighbor to SOLID_FRAME to avoid corner artifacts in the first ring.
   */
  private buildForcedSolidSet(
    grid: Cell[][],
    paintedLookup: ReadonlyMap<number, { oldFg: string; newFg: string }>,
    computed: ReadonlyMap<number, ComputedCellResult>,
  ): Set<number> {
    const forced = new Set<number>();

    for (const centerIdx of paintedLookup.keys()) {
      const centerComputed = computed.get(centerIdx);
      if (!centerComputed) {
        continue;
      }

      const centerCache = centerComputed.newCache;
      if (centerCache.bg === '') {
        continue; // Center is in base mode; no C2 transition ring override.
      }

      const centerFg = centerCache.fg;
      const cx = centerComputed.x;
      const cy = centerComputed.y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
            continue;
          }

          const neighborIdx = ny * this.width + nx;
          const neighborComputed = computed.get(neighborIdx);
          if (!neighborComputed) {
            continue;
          }

          const neighborCache = neighborComputed.newCache;
          const neighborFg = neighborCache.fg;
          if (neighborFg === centerFg) {
            continue;
          }

          // Never override explicitly painted cells.
          // The center (and any other painted cell) keeps its computed transition shape.
          if (paintedLookup.has(neighborIdx)) {
            continue;
          }

          const edgeClass = classifyEdge(centerFg, neighborFg, this.router, this.registry);
          if (edgeClass !== 'C2') {
            continue;
          }

          forced.add(neighborIdx);
        }
      }
    }

    return forced;
  }

  /**
   * Build a set of non-mandatory dirty cells whose computed frame changed
   * from cache AND that lack a standalone base tileset in the registry.
   *
   * Cells without a standalone base tileset depend entirely on transition
   * tilesets for their visual representation. When a terrain change in their
   * neighborhood alters their computed frame, they must be committed even if
   * the standard C4 cardinal/diagonal commit rules would skip them.
   *
   * Cells WITH a standalone base tileset can safely preserve their old
   * cached state, honoring the C4 cardinal preserve policy.
   */
  private buildVisualChangeCommitSet(
    computed: ReadonlyMap<number, ComputedCellResult>,
    mandatorySet: ReadonlySet<number>,
  ): Set<number> {
    const result = new Set<number>();

    for (const [flatIdx, cell] of computed) {
      if (mandatorySet.has(flatIdx)) {
        continue; // Already committed by normal rules
      }

      if (!cell.oldCache) {
        continue; // No prior state — will be committed as new cell
      }

      // Only commit if cell has no standalone base tileset
      if (this.registry.getBaseTilesetKey(cell.fg) !== undefined) {
        continue; // Has standalone base — preserve old state (C4 policy)
      }

      // Commit if frame or tileset changed
      if (
        cell.newCache.frameId !== cell.oldCache.frameId ||
        cell.newCache.selectedTilesetKey !== cell.oldCache.selectedTilesetKey
      ) {
        result.add(flatIdx);
      }
    }

    return result;
  }

  private withForcedSolidFrame(cache: CellCacheEntry): CellCacheEntry {
    if (cache.frameId === SOLID_FRAME) {
      return cache;
    }

    const renderTilesetKey = resolveRenderTilesetKey(
      cache.fg,
      cache.selectedTilesetKey,
      SOLID_FRAME,
      this.materials,
      this.registry,
      cache.bg,
    );

    return {
      ...cache,
      frameId: SOLID_FRAME,
      renderTilesetKey,
    };
  }

  // -------------------------------------------------------------------------
  // Private: Dirty Set Management
  // -------------------------------------------------------------------------

  /**
   * Expand a set of changed positions into a dirty set using Chebyshev R=2.
   * If the dirty set exceeds 50% of the map, switches to full-pass.
   *
   * @param positions - Changed cell positions.
   * @returns Set of flat cell indices to recompute.
   */
  private expandDirtySet(
    positions: ReadonlyArray<{ x: number; y: number }>,
  ): Set<number> {
    const totalCells = this.width * this.height;
    const dirty = new Set<number>();

    for (const { x, y } of positions) {
      const minX = Math.max(0, x - 2);
      const maxX = Math.min(this.width - 1, x + 2);
      const minY = Math.max(0, y - 2);
      const maxY = Math.min(this.height - 1, y + 2);

      for (let dy = minY; dy <= maxY; dy++) {
        for (let dx = minX; dx <= maxX; dx++) {
          dirty.add(dy * this.width + dx);
        }
      }
    }

    // Full-pass threshold: >50% of map
    if (dirty.size > totalCells * 0.5) {
      dirty.clear();
      for (let i = 0; i < totalCells; i++) {
        dirty.add(i);
      }
    }

    return dirty;
  }

  // -------------------------------------------------------------------------
  // Private: Cache and Index Management
  // -------------------------------------------------------------------------

  /**
   * Update the cache entry at (x, y) and maintain reverse indices.
   *
   * @param x - Column index.
   * @param y - Row index.
   * @param newEntry - New cache entry to store.
   */
  private updateCacheEntry(x: number, y: number, newEntry: CellCacheEntry): void {
    const flatIdx = y * this.width + x;
    const oldEntry = this.cache[y]?.[x];

    // Remove old index entries
    if (oldEntry) {
      this.removeFromIndex(this.cellsBySelectedTilesetKey, oldEntry.selectedTilesetKey, flatIdx);
      this.removeFromIndex(this.cellsByRenderTilesetKey, oldEntry.renderTilesetKey, flatIdx);
    }

    // Store new entry
    if (!this.cache[y]) {
      this.cache[y] = new Array(this.width).fill(null);
    }
    this.cache[y][x] = newEntry;

    // Add new index entries
    this.addToIndex(this.cellsBySelectedTilesetKey, newEntry.selectedTilesetKey, flatIdx);
    this.addToIndex(this.cellsByRenderTilesetKey, newEntry.renderTilesetKey, flatIdx);
  }

  /**
   * Remove a flat index from a reverse index map.
   */
  private removeFromIndex(
    index: Map<string, Set<number>>,
    key: string,
    flatIdx: number,
  ): void {
    const set = index.get(key);
    if (set) {
      set.delete(flatIdx);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Add a flat index to a reverse index map.
   */
  private addToIndex(
    index: Map<string, Set<number>>,
    key: string,
    flatIdx: number,
  ): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(flatIdx);
  }

  /**
   * Create an empty cache grid sized to width x height.
   */
  private createEmptyCache(): (CellCacheEntry | null)[][] {
    return Array.from({ length: this.height }, () =>
      new Array<CellCacheEntry | null>(this.width).fill(null),
    );
  }

  /**
   * Resolve a non-empty provider tileset key for the given foreground material.
   *
   * Priority:
   * 1) `materials[fg].baseTilesetKey` (runtime source of truth),
   * 2) explicit registry base key,
   * 3) `fg` as final sentinel (never empty).
   */
  private resolveBaseTilesetKeyForMaterial(fg: string): string {
    return this.materials.get(fg)?.baseTilesetKey
      ?? this.registry.getBaseTilesetKey(fg)
      ?? fg;
  }

  // -------------------------------------------------------------------------
  // Private: Routing Rebuild
  // -------------------------------------------------------------------------

  /**
   * Rebuild registry, graphs, and routing table from a new tileset array.
   *
   * @param tilesets - New tileset array.
   */
  private rebuildRouting(tilesets: ReadonlyArray<TilesetInfo>): void {
    this.registry = new TilesetRegistry(tilesets);
    const { compatGraph } = buildGraphs(this.registry);
    this.router = computeRoutingTable(compatGraph, this.preferences);
  }

  /**
   * Rebuild all cells near affected materials (for T3b triggers).
   *
   * @param state - Current editor state.
   * @param affectedMaterials - Set of material keys whose routing changed.
   * @returns RetileResult.
   */
  private rebuildAffectedMaterials(
    state: MapEditorState,
    affectedMaterials: Set<string>,
  ): RetileResult {
    // Find all cells whose terrain matches an affected material
    const positions: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (affectedMaterials.has(state.grid[y][x].terrain)) {
          positions.push({ x, y });
        }
      }
    }

    // Expand by R=2 and rebuild
    const dirtySet = this.expandDirtySet(positions);
    const newLayers = this.cloneLayers(state.layers);
    const patches = this.rebuildCells(state.grid, newLayers, dirtySet, []);

    return {
      layers: newLayers,
      patches,
      rebuiltCells: dirtySet.size,
      grid: state.grid,
    };
  }

  // -------------------------------------------------------------------------
  // Private: Immutable Helpers
  // -------------------------------------------------------------------------

  /**
   * Deep-clone the cell grid (row by row, cell by cell).
   */
  private cloneGrid(grid: Cell[][]): Cell[][] {
    return grid.map(row => row.map(cell => ({ ...cell })));
  }

  /**
   * Clone layers, creating new frames and tilesetKeys arrays.
   */
  private cloneLayers(layers: EditorLayer[]): EditorLayer[] {
    return layers.map(layer => {
      // Object layers have no frames/tilesetKeys — shallow-clone only
      if ((layer as unknown as { type: string }).type === 'object') {
        return { ...layer };
      }
      return {
        ...layer,
        frames: layer.frames.map(row => [...row]),
        tilesetKeys: layer.tilesetKeys
          ? layer.tilesetKeys.map(row => [...row])
          : Array.from({ length: this.height }, () =>
            new Array<string>(this.width).fill(''),
          ),
      };
    });
  }

  /**
   * Write frame and tileset key to layer[0] at the given position.
   */
  private writeToLayers(
    layers: EditorLayer[],
    x: number,
    y: number,
    frameId: number,
    tilesetKey: string,
  ): void {
    if (layers.length === 0) return;
    // Find the first tile layer (object layers have no frames)
    const layer = layers.find(
      l => (l as unknown as { type: string }).type !== 'object',
    );
    if (!layer) return;
    if (layer.frames[y]) {
      layer.frames[y][x] = frameId;
    }
    if (layer.tilesetKeys && layer.tilesetKeys[y]) {
      layer.tilesetKeys[y][x] = tilesetKey;
    }
  }
}
