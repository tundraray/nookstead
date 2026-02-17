/**
 * Surface properties for each terrain type.
 *
 * Defines walkability, speed modifiers, and other
 * gameplay-relevant properties per terrain classification.
 */

import type { TerrainCellType } from './types';

export interface SurfaceProperties {
  /** Can the player walk on this surface? */
  walkable: boolean;
  /** Movement speed multiplier (1.0 = normal). */
  speedModifier: number;
  /** Does traversal require swimming ability? */
  swimRequired: boolean;
  /** Does this surface deal damage over time? */
  damaging: boolean;
}

const SURFACE_PROPERTIES: Record<TerrainCellType, SurfaceProperties> = {
  deep_water: {
    walkable: false,
    speedModifier: 0,
    swimRequired: false,
    damaging: false,
  },
  water: {
    walkable: false,
    speedModifier: 0.5,
    swimRequired: true,
    damaging: false,
  },
  grass: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },
};

/** Get surface properties for a terrain type. */
export function getSurfaceProperties(terrain: TerrainCellType): SurfaceProperties {
  return SURFACE_PROPERTIES[terrain];
}

/** Check if a terrain type is walkable (without special abilities). */
export function isWalkable(terrain: TerrainCellType): boolean {
  return SURFACE_PROPERTIES[terrain].walkable;
}
