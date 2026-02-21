/**
 * WaterBorderPass: Enforces a minimum shallow water border around
 * all grass tiles before deep water begins.
 *
 * Uses BFS distance field from grass cells. Any non-grass cell
 * within MIN_WATER_BORDER tiles becomes 'water'; beyond becomes 'deep_water'.
 */

import type { GenerationPass, Grid } from '@nookstead/shared';
import { MIN_WATER_BORDER } from '@nookstead/shared';

export class WaterBorderPass implements GenerationPass {
  readonly name = 'water-border';

  execute(grid: Grid, width: number, height: number): void {
    // BFS from all grass cells
    const distance = this.bfsFromGrass(grid, width, height);

    // Reclassify non-grass cells based on distance to grass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].terrain === 'grass') continue;

        const d = distance[y][x];
        grid[y][x].terrain = d <= MIN_WATER_BORDER ? 'water' : 'deep_water';
      }
    }
  }

  private bfsFromGrass(grid: Grid, width: number, height: number): number[][] {
    const dist: number[][] = Array.from({ length: height }, () =>
      new Array<number>(width).fill(Infinity),
    );

    // Queue implemented as array with head pointer (faster than shift())
    const queue: [number, number][] = [];
    let head = 0;

    // Seed: all grass cells at distance 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].terrain === 'grass') {
          dist[y][x] = 0;
          queue.push([x, y]);
        }
      }
    }

    // 4-directional BFS
    const dx = [0, 0, 1, -1];
    const dy = [1, -1, 0, 0];

    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      const nd = dist[cy][cx] + 1;

      for (let i = 0; i < 4; i++) {
        const nx = cx + dx[i];
        const ny = cy + dy[i];

        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (dist[ny][nx] <= nd) continue;

        dist[ny][nx] = nd;
        queue.push([nx, ny]);
      }
    }

    return dist;
  }
}
