/**
 * IslandPass: Generates island terrain using multi-octave simplex noise
 * with a radial gradient mask for organic island shapes.
 *
 * The mask guarantees elevation → 0 at map edges (no land leaking out).
 * Noise provides the organic coastline variation within the mask.
 */

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import type { GenerationPass, Grid } from '../types';
import {
  NOISE_OCTAVES,
  NOISE_LACUNARITY,
  NOISE_PERSISTENCE,
  NOISE_SCALE,
  ELEVATION_EXPONENT,
  DEEP_WATER_THRESHOLD,
  WATER_THRESHOLD,
} from '../../constants';

export class IslandPass implements GenerationPass {
  readonly name = 'island';

  execute(grid: Grid, width: number, height: number, rng: () => number): void {
    const noise2D = createNoise2D(rng);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const elevation = this.computeElevation(x, y, width, height, noise2D);
        const terrain = this.classifyTerrain(elevation);

        grid[y][x].elevation = elevation;
        grid[y][x].terrain = terrain;
      }
    }
  }

  private computeElevation(
    x: number,
    y: number,
    width: number,
    height: number,
    noise2D: NoiseFunction2D,
  ): number {
    const noise = this.fbm(x, y, noise2D);
    const mask = this.islandMask(x, y, width, height);

    // Multiply noise by mask directly — guarantees 0 at edges.
    // Apply redistribution exponent after masking for sharper land/water split.
    const e = Math.pow(noise * mask, ELEVATION_EXPONENT);

    return Math.max(0, Math.min(1, e));
  }

  private fbm(x: number, y: number, noise2D: NoiseFunction2D): number {
    let value = 0;
    let amplitude = 1.0;
    let frequency = NOISE_SCALE;
    let maxAmplitude = 0;

    for (let i = 0; i < NOISE_OCTAVES; i++) {
      value += amplitude * noise2D(x * frequency, y * frequency);
      maxAmplitude += amplitude;
      amplitude *= NOISE_PERSISTENCE;
      frequency *= NOISE_LACUNARITY;
    }

    // Normalize to [0, 1]
    return (value / maxAmplitude + 1) / 2;
  }

  private islandMask(x: number, y: number, width: number, height: number): number {
    // Normalize to [-1, 1] from center
    const nx = 2 * x / (width - 1) - 1;
    const ny = 2 * y / (height - 1) - 1;

    // Euclidean distance from center, normalized so corners = 1
    const d = Math.sqrt(nx * nx + ny * ny) / Math.SQRT2;

    // Smooth falloff: 1 at center, 0 near edges.
    // d * 1.0 = island fills ~70% of map, d * 1.3 = smaller island
    const t = Math.max(0, 1 - d * 1.05);
    return t * t * (3 - 2 * t); // smoothstep
  }

  private classifyTerrain(elevation: number): 'deep_water' | 'water' | 'grass' {
    if (elevation < DEEP_WATER_THRESHOLD) return 'deep_water';
    if (elevation < WATER_THRESHOLD) return 'water';
    return 'grass';
  }
}
