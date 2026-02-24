import type { Cell } from '@nookstead/shared';
import type { EdgeDirection, MaterialPriorityMap } from '../types/routing-types';
import type { MaterialInfo } from '../types/material-types';
import type { TilesetRegistry } from './tileset-registry';
import { NEIGHBOR_OFFSETS, computeNeighborMaskByMaterial } from './neighbor-mask';
import { E, N, NE, NW, S, SE, SW, W, gateDiagonals, getFrame, SOLID_FRAME } from './autotile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Edge information passed to `selectTilesetForCell`.
 *
 * Each entry describes an owned edge where this cell is responsible for
 * rendering the transition. The `bg` field is the virtual background
 * material determined by the routing table, and `neighborMaterial` is
 * the actual FG material of the cell on the other side of the edge.
 */
export interface OwnedEdgeInfo {
  /** Virtual background material determined by routing. */
  readonly bg: string;
  /** Actual FG material of the neighbor cell across this edge. */
  readonly neighborMaterial: string;
}

// ---------------------------------------------------------------------------
// selectTilesetForCell
// ---------------------------------------------------------------------------

/**
 * Select the logical tileset for a single cell based on its owned edges.
 *
 * Implements Per-Cell BG Resolution (Design Doc Steps 1-4):
 * 1. Collect unique BG materials from owned edges.
 * 2. If zero BGs: select base tileset. If one BG: select FG_BG tileset.
 * 3. If multiple BGs (conflict): apply S1 Owner Reassign (max 4 iterations).
 * 4. If S1 fails: apply S2 BG Priority Fallback using preferences array.
 *
 * @param fg - Foreground material of the cell.
 * @param ownedEdges - Map of edge directions to owned edge info (0-4 entries).
 * @param registry - Tileset registry for tileset lookups.
 * @param priorities - Material priority map for S1 conflict resolution (optional).
 * @param preferences - BFS tie-break preference array for S2 fallback (optional; earlier = preferred).
 * @returns Selected logical tileset key and background material.
 */
export function selectTilesetForCell(
  fg: string,
  ownedEdges: ReadonlyMap<EdgeDirection, OwnedEdgeInfo>,
  registry: TilesetRegistry,
  priorities?: MaterialPriorityMap,
  preferences?: ReadonlyArray<string>,
): { selectedTilesetKey: string; bg: string; orientation: 'direct' | 'reverse' | '' } {
  // Step 1: Collect unique BG materials from owned edges.
  if (ownedEdges.size === 0) {
    // No foreign neighbors -- use base tileset.
    const baseTilesetKey = registry.getBaseTilesetKey(fg);
    return {
      selectedTilesetKey: baseTilesetKey ?? '',
      bg: '',
      orientation: '',
    };
  }

  // Collect all BG values.
  const bgSet = new Set<string>();
  for (const edge of ownedEdges.values()) {
    bgSet.add(edge.bg);
  }

  // Step 2: Single unique BG -- no conflict.
  if (bgSet.size === 1) {
    const bg = bgSet.values().next().value as string;
    return resolvePairOrFallback(fg, bg, registry);
  }

  // Step 3: Multiple BGs -- conflict. Apply S1 (Owner Reassign).
  // S1: For each conflicting edge, if the neighbor has higher priority than fg,
  // reassign the edge (drop it from our set). Repeat up to 4 iterations.
  const fgPriority = priorities?.get(fg) ?? 0;
  let activeEdges = new Map<EdgeDirection, OwnedEdgeInfo>(ownedEdges);

  const MAX_S1_ITERATIONS = 4;
  for (let iter = 0; iter < MAX_S1_ITERATIONS; iter++) {
    let changed = false;
    const newEdges = new Map<EdgeDirection, OwnedEdgeInfo>();

    // Collect current unique BGs.
    const currentBGs = new Set<string>();
    for (const edge of activeEdges.values()) {
      currentBGs.add(edge.bg);
    }

    if (currentBGs.size <= 1) {
      break; // Already resolved.
    }

    for (const [dir, edge] of activeEdges) {
      const neighborPriority = priorities?.get(edge.neighborMaterial) ?? 0;
      if (neighborPriority > fgPriority) {
        // Neighbor has higher priority -- reassign this edge.
        changed = true;
        // Drop this edge (do not add to newEdges).
      } else {
        newEdges.set(dir, edge);
      }
    }

    activeEdges = newEdges;

    if (!changed) {
      break; // No progress -- fall through to S2.
    }

    // Check if resolved after this iteration.
    const remainingBGs = new Set<string>();
    for (const edge of activeEdges.values()) {
      remainingBGs.add(edge.bg);
    }
    if (remainingBGs.size <= 1) {
      break;
    }
  }

  // Check result after S1.
  const s1BGs = new Set<string>();
  for (const edge of activeEdges.values()) {
    s1BGs.add(edge.bg);
  }

  if (s1BGs.size === 1) {
    const bg = s1BGs.values().next().value as string;
    return resolvePairOrFallback(fg, bg, registry);
  }

  if (s1BGs.size === 0) {
    // All edges were reassigned by S1 -- fall through to S2 with ORIGINAL edges.
    // This happens when fg is the lowest-priority material (e.g., water=10).
    // S1 drops edges where neighbor has higher priority, but if ALL neighbors
    // are higher priority, we'd lose all transitions. Instead, let S2 pick
    // the best BG from the original edges.
    activeEdges = new Map<EdgeDirection, OwnedEdgeInfo>(ownedEdges);
  }

  // Step 4: S2 -- BG Priority Fallback.
  // Pick the BG with highest priority from preferences array (earlier index = preferred).
  const s2BGs = new Set<string>();
  for (const edge of activeEdges.values()) {
    s2BGs.add(edge.bg);
  }
  const remainingBGs = Array.from(s2BGs);
  let bestBG = remainingBGs[0];

  if (preferences && preferences.length > 0) {
    let bestIndex = Infinity;
    for (const bg of remainingBGs) {
      const idx = preferences.indexOf(bg);
      if (idx !== -1 && idx < bestIndex) {
        bestIndex = idx;
        bestBG = bg;
      }
    }
  } else if (priorities) {
    // Fallback: use material priority map for S2.
    let bestPriority = -Infinity;
    for (const bg of remainingBGs) {
      const p = priorities.get(bg) ?? 0;
      if (p > bestPriority) {
        bestPriority = p;
        bestBG = bg;
      }
    }
  }

  // Log S2 fallback warning per AC5.
  console.warn(
    `[CellTilesetSelector] S2 fallback: fg=${fg}, conflicting BGs=[${remainingBGs.join(', ')}], selected=${bestBG}`,
  );

  return resolvePairOrFallback(fg, bestBG, registry);
}

/**
 * Resolve a pair via `registry.resolvePair` with fallback to base tileset.
 * Shared helper used by all paths in `selectTilesetForCell`.
 */
function resolvePairOrFallback(
  fg: string,
  bg: string,
  registry: TilesetRegistry,
): { selectedTilesetKey: string; bg: string; orientation: 'direct' | 'reverse' | '' } {
  const resolved = registry.resolvePair(fg, bg);
  if (resolved) {
    return {
      selectedTilesetKey: resolved.tilesetKey,
      bg,
      orientation: resolved.orientation,
    };
  }
  // No pair found -- fallback to base tileset with warning.
  console.warn(
    `[CellTilesetSelector] No pair found for fg=${fg}, bg=${bg}. Falling back to base tileset.`,
  );
  return {
    selectedTilesetKey: registry.getBaseTilesetKey(fg) ?? '',
    // Fallback to base mode: transition context is dropped.
    bg: '',
    orientation: '',
  };
}

// ---------------------------------------------------------------------------
// computeCellFrame
// ---------------------------------------------------------------------------

/**
 * Compute a transition mask relative to a target BG material.
 *
 * Sets bit=0 where the neighbor IS the target BG material or is in the
 * `bgMatchMaterials` set (materials that route to FG through BG, and so
 * are visually on the "BG side" of the transition).
 *
 * All other neighbors (own FG material + unrelated foreign materials) get bit=1.
 */
function computeTransitionMask(
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  targetMaterial: string,
  bgMatchMaterials?: ReadonlySet<string>,
): number {
  let mask = 0;

  for (const [dx, dy, bit] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
      mask |= bit; // OOB treated as non-target (matching / solid)
      continue;
    }

    const neighborTerrain = grid[ny][nx].terrain;
    if (neighborTerrain === targetMaterial) {
      continue; // bit stays 0 (transition opening toward BG)
    }

    if (bgMatchMaterials && bgMatchMaterials.has(neighborTerrain)) {
      continue; // Neighbor routes through BG → treat as BG-side (bit stays 0)
    }

    mask |= bit;
  }

  return mask;
}

/**
 * Compute the blob-47 mask and frame index for a cell.
 *
 * Selected-mode mask computation (ADR-0011 Decision 8, Design Doc FR5 / AC4):
 * - If `bg === ''` (base mode): use FG-equality mask via `computeNeighborMaskByMaterial`.
 *   In engine context (`ownedEdges` provided):
 *   - Mode B: If any in-bounds cardinal neighbor is foreign → SOLID_FRAME directly.
 *     (All base-mode cells with foreign cardinals have had their transitions
 *      handled by bridge edge promotion in RetileEngine; remaining foreign
 *      cardinals are non-renderable and must show solid.)
 *   - Mode C: All in-bounds cardinals match FG → FG-equality mask with
 *     selective diagonal closure via `closeDiagonalMask`, then FRAME_TABLE.
 * - If `bg !== ''` (transition mode, Mode A): start from BG-targeted transition mask
 *   (bit=0 where neighbor IS BG or in `bgMatchMaterials`, bit=1 otherwise),
 *   then enforce canonical edge contracts on cardinal foreign edges:
 *   - owned edge with matching contract type (`edge.bg === bg`) -> force open (`bit=0`)
 *   - all other foreign cardinal edges -> force closed (`bit=1`)
 *
 * Orientation handling (ADR-0011 Decision 7):
 * - Build `mask47Input = gateDiagonals(rawMask)`.
 * - `direct` or `''`: `getFrame(mask47Input)` as-is.
 * - `reverse`: `getFrame((~mask47Input) & 0xFF)` — invert after diagonal gating.
 *
 * @param grid - The 2D cell grid (indexed as `grid[y][x]`).
 * @param x - Column index of the target cell.
 * @param y - Row index of the target cell.
 * @param width - Grid width in cells.
 * @param height - Grid height in cells.
 * @param fg - Foreground material of the cell.
 * @param bg - Background material ('' for base mode, non-empty for transition mode).
 * @param orientation - Pair orientation: 'direct', 'reverse', or '' (base).
 * @param ownedEdges - Owned edge contracts for this cell (used for transition-mode cardinal gating).
 * @param closeDiagonalMask - Bitmask of diagonal bits to force closed in base mode (engine-computed).
 * @param bgMatchMaterials - Additional materials treated as BG-matching in transition mode.
 * @returns Object with `mask47` (gated mask) and `frameId` (0-47).
 */
export function computeCellFrame(
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  fg: string,
  bg = '',
  orientation: 'direct' | 'reverse' | '' = '',
  ownedEdges?: ReadonlyMap<EdgeDirection, OwnedEdgeInfo>,
  closeDiagonalMask = 0,
  bgMatchMaterials?: ReadonlySet<string>,
  closeForeignCardinals = false,
): { mask47: number; frameId: number } {
  const hasOwnerContext = ownedEdges !== undefined;
  const edgeContracts = ownedEdges ?? EMPTY_OWNED_EDGES;

  // Selected-mode mask: base vs transition
  let rawMask: number;
  if (bg === '') {
    // Base mode: bit=1 where neighbor terrain === fg
    rawMask = computeNeighborMaskByMaterial(grid, x, y, width, height, fg);
    if (hasOwnerContext) {
      if (closeForeignCardinals) {
        // Mode B-base: Cell has a standalone base tileset but foreign cardinals.
        // Close foreign cardinal bits (treat them as matching) so the cell
        // computes a proper corner/edge frame instead of isolated/cross.
        // Then apply diagonal closure as usual.
        rawMask = closeForeignCardinalBits(rawMask, grid, x, y, width, height, fg);
        rawMask |= closeDiagonalMask;
      } else if (hasForeignCardinalNeighbor(grid, x, y, width, height, fg)) {
        // Mode B-solid: Cell has NO standalone base tileset and foreign cardinals.
        // All renderable transitions for these cells have been promoted to
        // transition mode via C3 bridge edge promotion in RetileEngine.
        // Remaining foreign cardinals are non-renderable (C4/C5) and must show solid.
        return { mask47: 255, frameId: SOLID_FRAME };
      }
      // Mode C: No foreign cardinals. Apply selective diagonal closure
      // (pre-computed by RetileEngine based on edge classification).
      rawMask |= closeDiagonalMask;
    }
  } else {
    // Mode A: Transition mode uses selected BG baseline + owner/type gating
    // on cardinal foreign edges (canonical edge contract semantics).
    rawMask = computeTransitionMask(
      grid, x, y, width, height, bg, bgMatchMaterials,
    );
    rawMask = applyCardinalOwnershipGating(
      rawMask, grid, x, y, width, height, fg, bg, edgeContracts,
    );
  }

  const mask47Input = gateDiagonals(rawMask);
  const frameLookupMask = orientation === 'reverse'
    ? (~mask47Input) & 0xFF
    : mask47Input;
  const frameId = getFrame(frameLookupMask);
  return { mask47: mask47Input, frameId };
}

const CARDINAL_GATING: ReadonlyArray<readonly [EdgeDirection, number, number, number]> = [
  ['N', 0, -1, N],
  ['E', 1, 0, E],
  ['S', 0, 1, S],
  ['W', -1, 0, W],
];

const EMPTY_OWNED_EDGES: ReadonlyMap<EdgeDirection, OwnedEdgeInfo> = new Map();

/**
 * Returns true if at least one in-bounds cardinal neighbor has a different
 * terrain than fg.
 */
function hasForeignCardinalNeighbor(
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  fg: string,
): boolean {
  for (const [, dx, dy] of CARDINAL_GATING) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    if (grid[ny][nx].terrain !== fg) return true;
  }
  return false;
}

/**
 * Close (set to 1) all foreign cardinal bits in a raw FG-equality mask.
 *
 * Used in base mode when the cell has a standalone base tileset but
 * foreign cardinal neighbors. Foreign cardinals are treated as "matching"
 * so the cell computes a proper corner/edge frame (not isolated/cross).
 */
function closeForeignCardinalBits(
  rawMask: number,
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  fg: string,
): number {
  let mask = rawMask;
  for (const [, dx, dy, bit] of CARDINAL_GATING) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    if (grid[ny][nx].terrain !== fg) {
      mask |= bit; // Close: treat foreign cardinal as matching
    }
  }
  return mask;
}

/**
 * Enforce owner-gated canonical edge contracts on cardinal bits.
 *
 * Only foreign cardinal edges are overridden:
 * - owned + matching selected bg => open (`bit = 0`)
 * - otherwise => closed (`bit = 1`)
 */
function applyCardinalOwnershipGating(
  rawMask: number,
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  fg: string,
  bg: string,
  ownedEdges: ReadonlyMap<EdgeDirection, OwnedEdgeInfo>,
): number {
  let gatedMask = rawMask;

  for (const [dir, dx, dy, bit] of CARDINAL_GATING) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      continue;
    }

    const neighborFg = grid[ny][nx].terrain;
    if (neighborFg === fg) {
      continue;
    }

    const owned = ownedEdges.get(dir);
    const isOwnedAndTyped = owned !== undefined && owned.bg === bg;
    if (isOwnedAndTyped) {
      gatedMask &= ~bit;
    } else {
      gatedMask |= bit;
    }
  }

  return gatedMask;
}

// ---------------------------------------------------------------------------
// resolveRenderTilesetKey
// ---------------------------------------------------------------------------

/**
 * Resolve the final render tileset key for a computed frame.
 *
 * Default policy (v1, Design Doc AC4):
 * - If `frameId === SOLID_FRAME` and the FG material has a `baseTilesetKey`
 *   in the materials map, return that base tileset key.
 * - Otherwise return `selectedTilesetKey` unchanged.
 *
 * This allows solid (fully surrounded) cells to render with their native
 * base tileset rather than a transition tileset, avoiding visual artifacts
 * when no transition is visually needed.
 *
 * @param fg - Foreground material of the cell.
 * @param selectedTilesetKey - Tileset key chosen by `selectTilesetForCell`.
 * @param frameId - Frame index computed by `computeCellFrame`.
 * @param materials - Material definitions keyed by material key.
 * @param _registry - Tileset registry (reserved for future policy extensions).
 * @returns The final tileset key to use for rendering.
 */
export function resolveRenderTilesetKey(
  fg: string,
  selectedTilesetKey: string,
  frameId: number,
  materials: ReadonlyMap<string, MaterialInfo>,
  _registry: TilesetRegistry,
  bg = '',
): string {
  // Only override to base tileset in base mode (bg === '').
  // In transition mode (bg !== ''), the cell must keep its transition tileset
  // even for SOLID_FRAME — solid means "fully surrounded in this transition
  // context", which is different from base-mode solid.
  if (bg === '' && frameId === SOLID_FRAME) {
    const materialInfo = materials.get(fg);
    if (materialInfo?.baseTilesetKey) {
      return materialInfo.baseTilesetKey;
    }
  }
  return selectedTilesetKey;
}
