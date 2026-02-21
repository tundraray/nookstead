import type { Cell } from '@nookstead/shared';
import type { EditorLayer } from '../types/editor-types';
import type { TilesetInfo, MaterialInfo } from '../types/material-types';

/**
 * A transition mapping entry: for a given material pair, which tileset handles it.
 */
export interface TransitionEntry {
  fromMaterialKey: string;
  toMaterialKey: string;
  tilesetKey: string;
  tilesetName: string;
}

/**
 * Pre-built lookup table for fast material pair -> tileset resolution.
 * Key format: "fromMaterialKey:toMaterialKey"
 */
export type TransitionMap = ReadonlyMap<string, TransitionEntry>;

/**
 * Diagnostic warning for missing transitions.
 */
export interface TransitionWarning {
  fromMaterial: string;
  toMaterial: string;
  message: string;
}

/**
 * Result of a material paint resolution.
 */
export interface PaintResult {
  /** Updated grid with new terrain at painted cell. */
  updatedGrid: Cell[][];
  /** Layers after creating/updating transition layers. */
  updatedLayers: EditorLayer[];
  /** Cells that need autotile recomputation (painted cell + neighbors). */
  affectedCells: ReadonlyArray<{ x: number; y: number }>;
  /** Warnings for missing tileset transitions. */
  warnings: TransitionWarning[];
}

/** Options for material paint resolution. */
export interface ResolvePaintOptions {
  grid: Cell[][];
  x: number;
  y: number;
  materialKey: string;
  width: number;
  height: number;
  layers: EditorLayer[];
  transitionMap: TransitionMap;
  materials: ReadonlyMap<string, MaterialInfo>;
}

/**
 * Build a transition map from tileset and material data.
 * Call once when tilesets/materials are loaded, cache the result.
 *
 * Tilesets without `fromMaterialId` or `toMaterialId` are skipped.
 * The caller must pre-resolve material UUIDs to material keys on the
 * TilesetInfo objects before calling this function, since MaterialInfo
 * does not carry a database UUID field.
 *
 * @param tilesets - Array of tileset descriptors with material relationship keys.
 * @param materials - Map of material key to MaterialInfo for validation.
 * @returns A read-only map from "fromKey:toKey" to TransitionEntry.
 */
export function buildTransitionMap(
  tilesets: ReadonlyArray<TilesetInfo>,
  materials: ReadonlyMap<string, MaterialInfo>,
): TransitionMap {
  const map = new Map<string, TransitionEntry>();

  for (const tileset of tilesets) {
    if (!tileset.fromMaterialId || !tileset.toMaterialId) continue;

    const fromKey = tileset.fromMaterialId;
    const toKey = tileset.toMaterialId;

    // Validate both material keys exist in the materials map
    if (!materials.has(fromKey) || !materials.has(toKey)) continue;

    const key = `${fromKey}:${toKey}`;
    map.set(key, {
      fromMaterialKey: fromKey,
      toMaterialKey: toKey,
      tilesetKey: tileset.key,
      tilesetName: tileset.name,
    });
  }

  return map;
}

/**
 * Create a new EditorLayer for a transition tileset.
 * All frames initialized to EMPTY_FRAME (0).
 *
 * @param tilesetKey - Unique tileset key used as the layer's terrainKey.
 * @param tilesetName - Human-readable name for the layer.
 * @param width - Map width (number of columns).
 * @param height - Map height (number of rows).
 * @returns A new EditorLayer with all frames set to 0.
 */
export function createTransitionLayer(
  tilesetKey: string,
  tilesetName: string,
  width: number,
  height: number,
): EditorLayer {
  return {
    id: `transition-${tilesetKey}`,
    name: tilesetName,
    terrainKey: tilesetKey,
    visible: true,
    opacity: 1,
    frames: Array.from({ length: height }, () => Array(width).fill(0)),
  };
}

/** Offsets for the 8 neighboring cells (dx, dy). */
const NEIGHBOR_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
] as const;

/**
 * Resolve a material paint operation.
 *
 * 1. Validates coordinates and materialKey.
 * 2. Sets grid[y][x].terrain to materialKey (immutable update).
 * 3. Scans 8 neighbors for unique adjacent materials.
 * 4. For each (materialKey, neighborMaterial) pair, looks up tileset in transitionMap.
 * 5. Ensures a layer exists for each transition tileset (creates one if missing).
 * 6. Collects painted cell + 8 neighbors as affectedCells.
 *
 * Does NOT recompute autotile frames -- caller must invoke recomputeAutotileLayers.
 * Does NOT recompute walkability -- caller must invoke recomputeWalkability.
 *
 * @param options - Paint resolution options.
 * @returns PaintResult with updated grid, layers, affected cells, and warnings.
 */
export function resolvePaint(options: ResolvePaintOptions): PaintResult {
  const { grid, x, y, materialKey, width, height, layers, transitionMap, materials } = options;

  // Validate coordinates
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return { updatedGrid: grid, updatedLayers: layers, affectedCells: [], warnings: [] };
  }

  // Validate materialKey exists in materials
  if (!materials.has(materialKey)) {
    const warning: TransitionWarning = {
      fromMaterial: materialKey,
      toMaterial: '',
      message: `Unknown material key: ${materialKey}`,
    };
    return { updatedGrid: grid, updatedLayers: layers, affectedCells: [], warnings: [warning] };
  }

  // Immutable update: create new grid with terrain changed at [y][x]
  const updatedGrid: Cell[][] = grid.map((row, ry) =>
    ry === y
      ? row.map((cell, cx) =>
          cx === x ? { ...cell, terrain: materialKey as Cell['terrain'] } : cell
        )
      : row
  );

  // Scan 8 neighbors for unique adjacent materials
  const uniqueNeighborMaterials = new Set<string>();
  const affectedCells: Array<{ x: number; y: number }> = [{ x, y }];

  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      affectedCells.push({ x: nx, y: ny });
      const neighborTerrain = updatedGrid[ny][nx].terrain as string;
      if (neighborTerrain && neighborTerrain !== materialKey) {
        uniqueNeighborMaterials.add(neighborTerrain);
      }
    }
  }

  // For each unique neighbor material, look up transition tileset
  const warnings: TransitionWarning[] = [];
  let updatedLayers = [...layers];

  for (const neighborMaterial of uniqueNeighborMaterials) {
    const key = `${materialKey}:${neighborMaterial}`;
    const reverseKey = `${neighborMaterial}:${materialKey}`;
    const entry = transitionMap.get(key) ?? transitionMap.get(reverseKey);

    if (!entry) {
      warnings.push({
        fromMaterial: materialKey,
        toMaterial: neighborMaterial,
        message: `No transition tileset for ${materialKey} <-> ${neighborMaterial}`,
      });
      continue;
    }

    // Ensure layer exists for this transition tileset
    const layerExists = updatedLayers.some(l => l.terrainKey === entry.tilesetKey);
    if (!layerExists) {
      updatedLayers = [
        ...updatedLayers,
        createTransitionLayer(entry.tilesetKey, entry.tilesetName, width, height),
      ];
    }
  }

  return { updatedGrid, updatedLayers, affectedCells, warnings };
}
