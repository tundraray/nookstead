import type { Cell } from '@nookstead/map-lib';
import {
  getFrame,
  N, NE, E, SE, S, SW, W, NW,
  EMPTY_FRAME,
  TERRAINS,
  isWalkable,
} from '@nookstead/map-lib';
import type { TerrainCellType } from '@nookstead/map-lib';
import type { EditorLayerUnion, TileLayer } from './map-editor-types';

/**
 * Check if a terrain cell type belongs to a layer's terrain key.
 *
 * Looks up the TERRAINS entry matching the given terrainKey and checks
 * if the cell's terrain name matches the entry's name. For example,
 * terrain key "terrain-03" maps to name "water_grass", so a cell with
 * terrain "water_grass" belongs to that layer.
 */
export function checkTerrainPresence(
  terrain: string,
  terrainKey: string
): boolean {
  const entry = TERRAINS.find((t) => t.key === terrainKey);
  if (!entry) return false;
  return terrain === entry.name;
}

/**
 * Direction offsets for the 8 neighbors, ordered to match bitmask constants.
 * Each entry: [dx, dy, maskBit].
 */
const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, -1, N],    // North
  [1, -1, NE],   // NorthEast
  [1, 0, E],     // East
  [1, 1, SE],    // SouthEast
  [0, 1, S],     // South
  [-1, 1, SW],   // SouthWest
  [-1, 0, W],    // West
  [-1, -1, NW],  // NorthWest
];

/**
 * Compute the 8-bit neighbor mask for a cell at (x, y) within a grid.
 *
 * For each of the 8 directions, sets the corresponding bit if:
 * - The neighbor is out of bounds (treated as matching, per map-lib convention)
 * - The neighbor cell's terrain matches the layer's terrain key
 *
 * The returned mask is a raw 8-bit value; diagonal gating is applied
 * inside getFrame().
 */
export function computeNeighborMask(
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  terrainKey: string
): number {
  let mask = 0;

  for (const [dx, dy, bit] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;

    // Out-of-bounds neighbors are treated as matching (same terrain)
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
      mask |= bit;
      continue;
    }

    if (checkTerrainPresence(grid[ny][nx].terrain, terrainKey)) {
      mask |= bit;
    }
  }

  return mask;
}

/**
 * Recompute autotile frames for affected cells after a paint operation.
 *
 * For each affected cell, recalculates the cell and its 8 neighbors.
 * Uses a Set to deduplicate cells when multiple affected cells share neighbors.
 *
 * Returns a new layers array with updated frames (immutable -- creates
 * new array references for changed layers so React detects changes).
 * Only tile layers are recomputed; object and fence layers are passed through.
 */
export function recomputeAutotileLayers(
  grid: Cell[][],
  layers: EditorLayerUnion[],
  affectedCells: Array<{ x: number; y: number }>
): EditorLayerUnion[] {
  if (affectedCells.length === 0) return layers;

  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return layers;

  // Collect the set of all cells that need recalculation
  // (affected cells + their 8 neighbors = up to 9 cells per affected cell)
  const recalcSet = new Set<string>();

  for (const { x, y } of affectedCells) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          recalcSet.add(`${nx},${ny}`);
        }
      }
    }
  }

  // Update frames for each tile layer for each cell in the recalc set.
  // Non-tile layers (object, fence) are passed through unchanged.
  return layers.map((layer): EditorLayerUnion => {
    if (layer.type !== 'tile') return layer;

    const tileLayer = layer as TileLayer;
    const newFrames = tileLayer.frames.map((row) => [...row]);

    for (const key of recalcSet) {
      const [xStr, yStr] = key.split(',');
      const cx = parseInt(xStr, 10);
      const cy = parseInt(yStr, 10);

      // Determine if this cell has terrain belonging to this layer
      const isPresent = checkTerrainPresence(
        grid[cy][cx].terrain,
        tileLayer.terrainKey
      );

      if (!isPresent) {
        newFrames[cy][cx] = EMPTY_FRAME;
        continue;
      }

      // Compute neighbor mask and get correct autotile frame
      const mask = computeNeighborMask(
        grid,
        cx,
        cy,
        width,
        height,
        tileLayer.terrainKey
      );
      newFrames[cy][cx] = getFrame(mask);
    }

    return { ...tileLayer, frames: newFrames };
  });
}

/**
 * Recompute the walkability grid from terrain data.
 *
 * For each cell, checks if the terrain type is walkable using
 * isWalkable() from @nookstead/map-lib.
 */
export function recomputeWalkability(
  grid: Cell[][],
  width: number,
  height: number
): boolean[][] {
  const walkable: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(isWalkable(grid[y][x].terrain as TerrainCellType));
    }
    walkable.push(row);
  }
  return walkable;
}
