import type { Cell } from '@nookstead/shared';
import { getFrame, EMPTY_FRAME } from './autotile';
import { computeNeighborMask, checkTerrainPresence } from './neighbor-mask';
import type { EditorLayer } from '../types/editor-types';
import type { TilesetInfo } from '../types/material-types';

/**
 * Recompute autotile frames for affected cells after a paint operation.
 *
 * For each affected cell, recalculates the cell and its 8 neighbors.
 * Uses a Set to deduplicate cells when multiple affected cells share neighbors.
 *
 * Returns a new layers array with updated frames (immutable updates --
 * creates new array references for changed layers so consumers detect changes).
 *
 * If `affectedCells` is empty, returns the input `layers` array unchanged.
 *
 * @param grid - The 2D cell grid (indexed as grid[y][x]).
 * @param layers - Current editor layers with autotile frame data.
 * @param affectedCells - Coordinates of cells whose terrain changed.
 * @param tilesets - Available tileset descriptors for key-to-name lookup.
 * @returns A new layers array with updated frame indices.
 */
export function recomputeAutotileLayers(
  grid: Cell[][],
  layers: EditorLayer[],
  affectedCells: ReadonlyArray<{ x: number; y: number }>,
  tilesets: ReadonlyArray<TilesetInfo>,
): EditorLayer[] {
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

  // Update frames for each layer for each cell in the recalc set
  return layers.map((layer) => {
    const newFrames = layer.frames.map((row) => [...row]);

    for (const key of recalcSet) {
      const [xStr, yStr] = key.split(',');
      const cx = parseInt(xStr, 10);
      const cy = parseInt(yStr, 10);

      // Determine if this cell has terrain belonging to this layer
      const isPresent = checkTerrainPresence(
        grid[cy][cx].terrain,
        layer.terrainKey,
        tilesets,
      );

      if (!isPresent) {
        newFrames[cy][cx] = EMPTY_FRAME;
        continue;
      }

      // Compute neighbor mask and get correct autotile frame
      // Default outOfBoundsMatches: true (seamless map edges)
      const mask = computeNeighborMask(
        grid,
        cx,
        cy,
        width,
        height,
        layer.terrainKey,
        tilesets,
      );
      newFrames[cy][cx] = getFrame(mask);
    }

    return { ...layer, frames: newFrames };
  });
}
