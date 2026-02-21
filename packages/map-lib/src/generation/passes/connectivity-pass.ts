/**
 * ConnectivityPass: Ensures a single cohesive island.
 *
 * 1. Keeps only the largest connected grass region (removes small islands).
 * 2. Fills small enclosed water pockets inside the island with grass.
 */

import type { GenerationPass, Grid, TerrainCellType } from '@nookstead/shared';

/** Max size of an interior water pocket to fill (in cells). */
const MAX_HOLE_SIZE = 20;

export class ConnectivityPass implements GenerationPass {
  readonly name = 'connectivity';

  execute(grid: Grid, width: number, height: number): void {
    // Step 1: Keep only the largest grass component
    this.keepLargestComponent(grid, width, height, 'grass', 'water');

    // Step 2: Fill small enclosed water holes inside the island
    this.fillInteriorHoles(grid, width, height);
  }

  private keepLargestComponent(
    grid: Grid,
    width: number,
    height: number,
    keepType: TerrainCellType,
    convertTo: TerrainCellType,
  ): void {
    const label: number[][] = Array.from({ length: height }, () =>
      new Array<number>(width).fill(-1),
    );

    let componentId = 0;
    const componentSizes: number[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].terrain !== keepType || label[y][x] >= 0) continue;

        const size = this.floodFill(grid, label, x, y, width, height, componentId,
          (t) => t === keepType);
        componentSizes.push(size);
        componentId++;
      }
    }

    if (componentSizes.length <= 1) return;

    let largestId = 0;
    let largestSize = 0;
    for (let i = 0; i < componentSizes.length; i++) {
      if (componentSizes[i] > largestSize) {
        largestSize = componentSizes[i];
        largestId = i;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].terrain === keepType && label[y][x] !== largestId) {
          grid[y][x].terrain = convertTo;
        }
      }
    }
  }

  /**
   * Find water regions that are fully enclosed by grass (don't touch map edges).
   * Fill small ones with grass to remove visual holes.
   */
  private fillInteriorHoles(grid: Grid, width: number, height: number): void {
    const label: number[][] = Array.from({ length: height }, () =>
      new Array<number>(width).fill(-1),
    );

    let componentId = 0;
    const components: { size: number; touchesEdge: boolean; cells: [number, number][] }[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].terrain === 'grass' || label[y][x] >= 0) continue;

        const cells: [number, number][] = [];
        let touchesEdge = false;

        // Flood fill non-grass region
        const stack: [number, number][] = [[x, y]];
        label[y][x] = componentId;

        while (stack.length > 0) {
          const popped = stack.pop();
          if (!popped) break;
          const [cx, cy] = popped;
          cells.push([cx, cy]);

          if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) {
            touchesEdge = true;
          }

          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (label[ny][nx] >= 0 || grid[ny][nx].terrain === 'grass') continue;
            label[ny][nx] = componentId;
            stack.push([nx, ny]);
          }
        }

        components.push({ size: cells.length, touchesEdge, cells });
        componentId++;
      }
    }

    // Fill interior holes that are small enough
    for (const comp of components) {
      if (!comp.touchesEdge && comp.size <= MAX_HOLE_SIZE) {
        for (const [cx, cy] of comp.cells) {
          grid[cy][cx].terrain = 'grass';
        }
      }
    }
  }

  private floodFill(
    grid: Grid,
    label: number[][],
    startX: number,
    startY: number,
    width: number,
    height: number,
    id: number,
    match: (t: TerrainCellType) => boolean,
  ): number {
    const stack: [number, number][] = [[startX, startY]];
    label[startY][startX] = id;
    let size = 0;

    const dx = [0, 0, 1, -1];
    const dy = [1, -1, 0, 0];

    while (stack.length > 0) {
      const popped = stack.pop();
      if (!popped) break;
      const [cx, cy] = popped;
      size++;

      for (let i = 0; i < 4; i++) {
        const nx = cx + dx[i];
        const ny = cy + dy[i];

        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (label[ny][nx] >= 0 || !match(grid[ny][nx].terrain)) continue;

        label[ny][nx] = id;
        stack.push([nx, ny]);
      }
    }

    return size;
  }
}
