import type { Cell } from '@nookstead/shared';
import type { MaterialInfo } from '../types/material-types';

/**
 * Recompute the walkability grid from terrain data.
 *
 * For each cell, looks up walkability from the provided materials map.
 * Terrains not found in the map default to walkable (true).
 *
 * Returns a new `boolean[][]` array (immutable -- never mutates inputs).
 *
 * @param grid - The 2D cell grid (indexed as grid[y][x]).
 * @param width - Grid width in cells.
 * @param height - Grid height in cells.
 * @param materials - Map from terrain name to material info for walkability lookup.
 * @returns A 2D boolean array where `true` means walkable.
 */
export function recomputeWalkability(
  grid: Cell[][],
  width: number,
  height: number,
  materials: ReadonlyMap<string, MaterialInfo>,
): boolean[][] {
  const walkable: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(materials.get(grid[y][x].terrain)?.walkable ?? true);
    }
    walkable.push(row);
  }
  return walkable;
}
