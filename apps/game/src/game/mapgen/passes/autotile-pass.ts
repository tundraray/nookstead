/**
 * AutotilePass: Converts the terrain grid into rendering layers
 * with correct autotile frame indices.
 *
 * Uses the GMS2 47-tile autotile engine (autotile.ts) to compute
 * per-cell frames for each terrain layer.
 */

import { getFrame, SOLID_FRAME, EMPTY_FRAME, N, NE, E, SE, S, SW, W, NW } from '../../autotile';
import type { Grid, LayerData, LayerPass, TerrainCellType } from '../types';

/** Definition of a rendering layer. */
interface TerrainLayer {
  name: string;
  terrainKey: string;
  isFill: boolean;
  isPresent: (type: TerrainCellType) => boolean;
  /** Treat out-of-bounds cells as present (solid edges). */
  oobPresent?: boolean;
}

/**
 * Layer stack (bottom → top):
 * 1. base: solid shallow water fill (every cell)
 * 2. deep_water: autotiled deep water over shallow water background
 * 3. grass: autotiled grass over water background
 */
const LAYERS: TerrainLayer[] = [
  {
    name: 'base',
    terrainKey: 'terrain-03', // water_grass
    isFill: true,
    isPresent: () => true,
  },
  {
    name: 'deep_water',
    terrainKey: 'terrain-16', // deep_water_water
    isFill: false,
    isPresent: (type) => type === 'deep_water',
    oobPresent: true,
  },
  {
    name: 'grass',
    terrainKey: 'terrain-15', // grass_water
    isFill: false,
    isPresent: (type) => type === 'grass',
  },
];

export class AutotilePass implements LayerPass {
  readonly name = 'autotile';

  buildLayers(grid: Grid, width: number, height: number): LayerData[] {
    return LAYERS.map((layer) => ({
      name: layer.name,
      terrainKey: layer.terrainKey,
      frames: this.computeFrames(grid, layer, width, height),
    }));
  }

  private computeFrames(
    grid: Grid,
    layer: TerrainLayer,
    width: number,
    height: number,
  ): number[][] {
    const frames: number[][] = Array.from({ length: height }, () =>
      new Array<number>(width).fill(EMPTY_FRAME),
    );

    if (layer.isFill) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          frames[y][x] = SOLID_FRAME;
        }
      }
      return frames;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!layer.isPresent(grid[y][x].terrain)) continue;

        const neighbors = this.computeNeighborMask(grid, x, y, width, height, layer.isPresent, layer.oobPresent ?? false);
        frames[y][x] = getFrame(neighbors);
      }
    }

    return frames;
  }

  private computeNeighborMask(
    grid: Grid,
    x: number,
    y: number,
    width: number,
    height: number,
    isPresent: (type: TerrainCellType) => boolean,
    oobPresent: boolean,
  ): number {
    let mask = 0;

    const check = (nx: number, ny: number): boolean => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return oobPresent;
      return isPresent(grid[ny][nx].terrain);
    };

    if (check(x, y - 1)) mask |= N;
    if (check(x + 1, y - 1)) mask |= NE;
    if (check(x + 1, y)) mask |= E;
    if (check(x + 1, y + 1)) mask |= SE;
    if (check(x, y + 1)) mask |= S;
    if (check(x - 1, y + 1)) mask |= SW;
    if (check(x - 1, y)) mask |= W;
    if (check(x - 1, y - 1)) mask |= NW;

    return mask;
  }
}
