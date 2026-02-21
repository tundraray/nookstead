import type { Cell } from '@nookstead/shared';
import type { CellDelta, EditorLayer } from '../types/editor-types';

/**
 * Bresenham's line algorithm.
 * Returns an array of integer grid points from (x0,y0) to (x1,y1),
 * including both endpoints. Guarantees no diagonal gaps.
 */
export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}

/**
 * 4-directional BFS flood fill.
 * Uses index-based dequeue (head pointer, no Array.shift()) for O(1) dequeue.
 * Returns CellDelta[] for all cells that changed terrain.
 * If the start cell already has newTerrain, returns an empty array.
 */
export function floodFill(
  grid: Cell[][],
  startX: number,
  startY: number,
  newTerrain: string,
  width: number,
  height: number,
  layerIndex: number,
  layers: ReadonlyArray<EditorLayer>,
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
      newFrame: 0,
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

/** Options for rectangle fill. */
export interface RectangleFillOptions {
  grid: Cell[][];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  newTerrain: string;
  width: number;
  height: number;
  layerIndex: number;
  layers: ReadonlyArray<EditorLayer>;
}

/**
 * Fill all cells within a rectangle [minX,maxX] x [minY,maxY] with newTerrain.
 * Returns CellDelta[] for all cells that changed terrain.
 */
export function rectangleFill(options: RectangleFillOptions): CellDelta[] {
  const {
    grid,
    minX,
    minY,
    maxX,
    maxY,
    newTerrain,
    width,
    height,
    layerIndex,
    layers,
  } = options;

  const deltas: CellDelta[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Bounds check
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const oldTerrain = grid[y][x].terrain;
      if (oldTerrain === newTerrain) continue;

      const oldFrame =
        layerIndex >= 0 && layerIndex < layers.length
          ? layers[layerIndex].frames[y][x]
          : 0;

      deltas.push({
        layerIndex,
        x,
        y,
        oldTerrain,
        newTerrain,
        oldFrame,
        newFrame: 0,
      });
    }
  }

  return deltas;
}
