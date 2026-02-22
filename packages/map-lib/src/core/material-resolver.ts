import type { Cell } from '@nookstead/shared';
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
  /** Cells that need autotile recomputation (painted cell + neighbors). */
  affectedCells: ReadonlyArray<{ x: number; y: number }>;
  /** Warnings for missing material keys. */
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
  materials: ReadonlyMap<string, MaterialInfo>;
}

/**
 * Build a transition map from tileset and material data.
 * Call once when tilesets/materials are loaded, cache the result.
 *
 * Tilesets without `fromMaterialKey` or `toMaterialKey` are skipped.
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
    const fromKey = tileset.fromMaterialKey;
    const toKey = tileset.toMaterialKey;
    if (!fromKey || !toKey) continue;

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

/** Offsets for the 8 neighboring cells (dx, dy). */
const NEIGHBOR_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
] as const;

/**
 * Resolve a material paint operation (single-layer mode).
 *
 * 1. Validates coordinates and materialKey.
 * 2. Sets grid[y][x].terrain to materialKey (immutable update).
 * 3. Collects painted cell + in-bounds 8 neighbors as affectedCells.
 *
 * Does NOT create, modify, or return any layer data.
 * Does NOT recompute autotile frames -- caller must invoke recomputeAutotileLayers.
 * Does NOT recompute walkability -- caller must invoke recomputeWalkability.
 *
 * @param options - Paint resolution options.
 * @returns PaintResult with updated grid, affected cells, and warnings.
 */
export function resolvePaint(options: ResolvePaintOptions): PaintResult {
  const { grid, x, y, materialKey, width, height, materials } = options;

  // Validate coordinates
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return { updatedGrid: grid, affectedCells: [], warnings: [] };
  }

  // Validate materialKey exists in materials
  if (!materials.has(materialKey)) {
    const warning: TransitionWarning = {
      fromMaterial: materialKey,
      toMaterial: '',
      message: `Unknown material key: ${materialKey}`,
    };
    return { updatedGrid: grid, affectedCells: [], warnings: [warning] };
  }

  // Immutable update: create new grid with terrain changed at [y][x]
  const updatedGrid: Cell[][] = grid.map((row, ry) =>
    ry === y
      ? row.map((cell, cx) =>
          cx === x ? { ...cell, terrain: materialKey as Cell['terrain'] } : cell
        )
      : row
  );

  // Collect painted cell + in-bounds 8 neighbors as affectedCells
  const affectedCells: Array<{ x: number; y: number }> = [{ x, y }];

  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      affectedCells.push({ x: nx, y: ny });
    }
  }

  return { updatedGrid, affectedCells, warnings: [] };
}
