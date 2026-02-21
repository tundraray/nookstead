import { N, NE, E, SE, S, SW, W, NW } from './autotile';
import type { Cell } from '@nookstead/shared';
import type { TilesetInfo } from '../types/material-types';

/**
 * Direction offsets for the 8 neighbors, ordered to match bitmask constants.
 * Each entry: [dx, dy, maskBit].
 */
export const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, -1, N],    // North
  [1, -1, NE],   // Northeast
  [1, 0, E],     // East
  [1, 1, SE],    // Southeast
  [0, 1, S],     // South
  [-1, 1, SW],   // Southwest
  [-1, 0, W],    // West
  [-1, -1, NW],  // Northwest
];

/**
 * Options for controlling neighbor mask computation behavior.
 */
export interface NeighborMaskOptions {
  /**
   * How to treat out-of-bounds neighbors.
   * - true: OOB neighbors are treated as matching (bit set). Use for seamless map edges.
   * - false: OOB neighbors are treated as not matching (bit not set). Use for isolated tiles.
   * @default true
   */
  outOfBoundsMatches?: boolean;
}

/**
 * Check if a terrain cell type belongs to a layer's terrain key.
 *
 * Looks up the tilesets entry matching the given terrainKey and checks
 * if the cell's terrain name matches the entry's name. For example,
 * terrain key "terrain-03" maps to name "water_grass", so a cell with
 * terrain "water_grass" belongs to that layer.
 *
 * @param terrain - The terrain string from a cell (e.g., "water_grass").
 * @param terrainKey - The tileset key to check against (e.g., "terrain-03").
 * @param tilesets - Available tileset descriptors for key-to-name lookup.
 * @returns true if the terrain matches the tileset identified by terrainKey.
 */
export function checkTerrainPresence(
  terrain: string,
  terrainKey: string,
  tilesets: ReadonlyArray<TilesetInfo>,
): boolean {
  const entry = tilesets.find((t) => t.key === terrainKey);
  if (!entry) return false;
  return terrain === entry.name;
}

/**
 * Compute the 8-bit neighbor mask for a cell at (x, y) within a grid.
 *
 * For each of the 8 directions, sets the corresponding bit if:
 * - The neighbor is out of bounds and `outOfBoundsMatches` is true (default)
 * - The neighbor cell's terrain matches the layer's terrain key
 *
 * The returned mask is a raw 8-bit value; diagonal gating is applied
 * inside getFrame().
 *
 * @param grid - The 2D cell grid (indexed as grid[y][x]).
 * @param x - Column index of the target cell.
 * @param y - Row index of the target cell.
 * @param width - Grid width in cells.
 * @param height - Grid height in cells.
 * @param terrainKey - The tileset key to check neighbors against.
 * @param tilesets - Available tileset descriptors for key-to-name lookup.
 * @param options - Optional configuration for OOB behavior.
 * @returns An 8-bit neighbor mask with bits set for matching neighbors.
 */
export function computeNeighborMask(
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  terrainKey: string,
  tilesets: ReadonlyArray<TilesetInfo>,
  options?: NeighborMaskOptions,
): number {
  const oobMatches = options?.outOfBoundsMatches ?? true;
  let mask = 0;

  for (const [dx, dy, bit] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;

    // Out-of-bounds handling: set or clear bit based on options
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
      if (oobMatches) mask |= bit;
      // else: bit stays clear (default 0)
      continue;
    }

    if (checkTerrainPresence(grid[ny][nx].terrain, terrainKey, tilesets)) {
      mask |= bit;
    }
  }

  return mask;
}
