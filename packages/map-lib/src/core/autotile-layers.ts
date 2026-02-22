import type { Cell } from '@nookstead/shared';
import { getFrame, EMPTY_FRAME } from './autotile';
import { computeNeighborMaskByMaterial, computeNeighborMaskByPriority } from './neighbor-mask';
import type { EditorLayer } from '../types/editor-types';
import type { MaterialInfo } from '../types/material-types';

/**
 * Recompute autotile frames for affected cells after a paint operation.
 *
 * For each affected cell, recalculates the cell and its 8 neighbors.
 * Uses a Set to deduplicate cells when multiple affected cells share neighbors.
 *
 * All cells with terrain are rendered in every layer — layers are manual
 * (user-created), not auto-generated per material. The renderer uses per-cell
 * baseTilesetKey lookup to pick the correct sprite sheet.
 *
 * When `materials` is provided (non-empty), uses priority-based mask
 * computation: a neighbor "matches" when its renderPriority <= current cell's
 * priority. This fixes the bug where water on deep_water showed ISOLATED
 * instead of SOLID.
 *
 * Returns a new layers array with updated frames (immutable updates --
 * creates new array references for changed layers so consumers detect changes).
 *
 * If `affectedCells` is empty, returns the input `layers` array unchanged.
 *
 * @param grid - The 2D cell grid (indexed as grid[y][x]).
 * @param layers - Current editor layers with autotile frame data.
 * @param affectedCells - Coordinates of cells whose terrain changed.
 * @param materials - Material lookup map for priority-based mask (optional).
 * @returns A new layers array with updated frame indices.
 */
export function recomputeAutotileLayers(
  grid: Cell[][],
  layers: EditorLayer[],
  affectedCells: ReadonlyArray<{ x: number; y: number }>,
  materials: ReadonlyMap<string, MaterialInfo> = new Map(),
): EditorLayer[] {
  if (affectedCells.length === 0) return layers;

  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return layers;

  const usePriority = materials.size > 0;

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
    // Skip object layers (they have no frames array)
    if (!layer.frames) return layer;

    const newFrames = layer.frames.map((row) => [...row]);

    for (const key of recalcSet) {
      const [xStr, yStr] = key.split(',');
      const cx = parseInt(xStr, 10);
      const cy = parseInt(yStr, 10);

      const cellTerrain = grid[cy][cx].terrain;

      if (!cellTerrain) {
        newFrames[cy][cx] = EMPTY_FRAME;
        continue;
      }

      let mask: number;
      if (usePriority) {
        const mat = materials.get(cellTerrain);
        const priority = mat?.renderPriority ?? 0;
        mask = computeNeighborMaskByPriority(
          grid, cx, cy, width, height, priority, materials,
        );
      } else {
        mask = computeNeighborMaskByMaterial(
          grid, cx, cy, width, height, cellTerrain,
        );
      }
      newFrames[cy][cx] = getFrame(mask);
    }

    return { ...layer, frames: newFrames };
  });
}
