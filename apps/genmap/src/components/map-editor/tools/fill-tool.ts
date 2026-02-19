import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';
import type { CellDelta } from '@/hooks/map-editor-commands';
import { FillCommand } from '@/hooks/map-editor-commands';
import type { Cell } from '@nookstead/map-lib';
import type { ToolHandlers } from '../map-editor-canvas';

/**
 * 4-directional BFS flood fill.
 * Uses index-based dequeue (head pointer, no Array.shift()) for O(1) dequeue.
 * Returns CellDelta[] for all cells that changed.
 */
export function floodFill(
  grid: Cell[][],
  startX: number,
  startY: number,
  newTerrain: string,
  width: number,
  height: number,
  layerIndex: number,
  layers: MapEditorState['layers']
): CellDelta[] {
  // Bounds check
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return [];
  }

  const targetTerrain = grid[startY][startX].terrain;

  // Early return if filling with same terrain
  if (targetTerrain === newTerrain) return [];

  const queue: Array<{ x: number; y: number }> = [
    { x: startX, y: startY },
  ];
  let head = 0;
  const visited = new Set<string>();
  const deltas: CellDelta[] = [];

  visited.add(`${startX},${startY}`);

  // 4-directional neighbors
  const directions: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (head < queue.length) {
    const { x, y } = queue[head++];

    if (grid[y][x].terrain !== targetTerrain) continue;

    const oldFrame =
      layerIndex >= 0 && layerIndex < layers.length
        ? layers[layerIndex].frames[y][x]
        : 0;

    deltas.push({
      layerIndex,
      x,
      y,
      oldTerrain: targetTerrain,
      newTerrain,
      oldFrame,
      newFrame: 0, // Will be recalculated by autotile (Task 17)
    });

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const key = `${nx},${ny}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  return deltas;
}

/**
 * Creates fill tool handlers.
 * Single-click performs a flood fill; no drag behavior.
 */
export function createFillTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>
): ToolHandlers {
  return {
    onMouseDown(tile: { x: number; y: number }) {
      const deltas = floodFill(
        state.grid,
        tile.x,
        tile.y,
        state.activeTerrainKey,
        state.width,
        state.height,
        state.activeLayerIndex,
        state.layers
      );

      if (deltas.length === 0) return;

      const command = new FillCommand(deltas);
      dispatch({ type: 'PUSH_COMMAND', command });
    },

    onMouseMove() {
      // No-op: fill is single-click, no drag behavior
    },

    onMouseUp() {
      // No-op
    },
  };
}
