/**
 * MapGenerator: Composable procedural map generation pipeline.
 *
 * Server-side map generation pipeline.
 * Identical logic to client mapgen but running in Node.js.
 * All dependencies are pure JS (alea, simplex-noise) -- no browser/Phaser deps.
 *
 * Usage:
 *   const gen = new MapGenerator(64, 64)
 *     .addPass(new IslandPass())
 *     .addPass(new WaterBorderPass())
 *     .setLayerPass(new AutotilePass());
 *
 *   const map = gen.generate();       // random seed
 *   const map = gen.generate(12345);  // deterministic seed
 *
 * Each GenerationPass modifies the grid in order.
 * The LayerPass converts the final grid into rendering layers.
 */

import alea from 'alea';
import { isWalkable } from '../core/terrain-properties';
import type { Cell, GeneratedMap, Grid } from '@nookstead/shared';
import type { GenerationPass, LayerPass } from './generation-types';
import { IslandPass } from './passes/island-pass';
import { ConnectivityPass } from './passes/connectivity-pass';
import { WaterBorderPass } from './passes/water-border-pass';
import { AutotilePass } from './passes/autotile-pass';

export class MapGenerator {
  private passes: GenerationPass[] = [];
  private layerPass: LayerPass | null = null;

  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {}

  addPass(pass: GenerationPass): this {
    this.passes.push(pass);
    return this;
  }

  setLayerPass(pass: LayerPass): this {
    this.layerPass = pass;
    return this;
  }

  generate(seed?: number): GeneratedMap {
    const actualSeed = seed ?? Date.now();
    const rng = alea(actualSeed);
    const grid = this.createGrid();

    // Execute generation passes in order
    for (const pass of this.passes) {
      pass.execute(grid, this.width, this.height, rng);
    }

    // Build rendering layers
    const layers = this.layerPass
      ? this.layerPass.buildLayers(grid, this.width, this.height)
      : [];

    // Build walkability grid from terrain properties
    const walkable = this.buildWalkabilityGrid(grid);

    return {
      width: this.width,
      height: this.height,
      seed: actualSeed,
      grid,
      layers,
      walkable,
    };
  }

  private buildWalkabilityGrid(grid: Grid): boolean[][] {
    return grid.map((row) => row.map((cell) => isWalkable(cell.terrain)));
  }

  private createGrid(): Grid {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, (): Cell => ({
        terrain: 'deep_water',
        elevation: 0,
        meta: {},
      })),
    );
  }
}

/**
 * Factory function to create a fully configured MapGenerator.
 * Pre-configured with all 4 passes in the correct order:
 * IslandPass -> ConnectivityPass -> WaterBorderPass -> AutotilePass (layer pass).
 */
export function createMapGenerator(width: number, height: number): MapGenerator {
  return new MapGenerator(width, height)
    .addPass(new IslandPass())
    .addPass(new ConnectivityPass())
    .addPass(new WaterBorderPass())
    .setLayerPass(new AutotilePass());
}
