import type { Grid, LayerData } from '@nookstead/shared';

/** Interface for passes that modify the terrain grid. */
export interface GenerationPass {
  readonly name: string;
  execute(
    grid: Grid,
    width: number,
    height: number,
    rng: () => number
  ): void;
}

/** Interface for passes that produce rendering layers. */
export interface LayerPass {
  readonly name: string;
  buildLayers(grid: Grid, width: number, height: number): LayerData[];
}

// Generation constants (moved from @nookstead/shared)
export const NOISE_OCTAVES = 5;
export const NOISE_LACUNARITY = 2.0;
export const NOISE_PERSISTENCE = 0.5;
export const NOISE_SCALE = 0.025;
export const ELEVATION_EXPONENT = 1.3;
export const DEEP_WATER_THRESHOLD = 0.12;
export const WATER_THRESHOLD = 0.18;
export const MIN_WATER_BORDER = 5;
