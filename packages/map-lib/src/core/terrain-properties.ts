/**
 * Surface properties for each terrain type.
 *
 * Defines walkability, speed modifiers, and other
 * gameplay-relevant properties per terrain classification.
 *
 * Covers all 26 terrain types from TERRAIN_NAMES plus the 3 base types.
 */

import type { TerrainCellType } from '@nookstead/shared';

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

/**
 * @deprecated Use database-driven material records from GET /api/materials instead.
 * Surface properties are now stored in the materials table. Kept for backward compatibility with apps/game.
 */
export const SURFACE_PROPERTIES: Record<TerrainCellType, SurfaceProperties> = {
  // --- Base terrain types (existing 3) ---
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

  // --- Grass/dirt variants ---
  dirt_light_grass: {
    walkable: true,
    speedModifier: 0.9,
    swimRequired: false,
    damaging: false,
  },
  orange_grass: {
    walkable: true,
    speedModifier: 0.9,
    swimRequired: false,
    damaging: false,
  },
  pale_sage: {
    walkable: true,
    speedModifier: 0.9,
    swimRequired: false,
    damaging: false,
  },
  forest_edge: {
    walkable: true,
    speedModifier: 0.8,
    swimRequired: false,
    damaging: false,
  },
  lush_green: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },
  grass_orange: {
    walkable: true,
    speedModifier: 0.9,
    swimRequired: false,
    damaging: false,
  },
  grass_alpha: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },
  grass_fenced: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },

  // --- Water transition variants (non-walkable) ---
  water_grass: {
    walkable: false,
    speedModifier: 0,
    swimRequired: false,
    damaging: false,
  },
  grass_water: {
    walkable: false,
    speedModifier: 0,
    swimRequired: false,
    damaging: false,
  },
  deep_water_water: {
    walkable: false,
    speedModifier: 0,
    swimRequired: false,
    damaging: false,
  },

  // --- Sand variants ---
  light_sand_grass: {
    walkable: true,
    speedModifier: 0.9,
    swimRequired: false,
    damaging: false,
  },
  light_sand_water: {
    walkable: false,
    speedModifier: 0.4,
    swimRequired: false,
    damaging: false,
  },
  orange_sand_light_sand: {
    walkable: true,
    speedModifier: 0.85,
    swimRequired: false,
    damaging: false,
  },
  sand_alpha: {
    walkable: true,
    speedModifier: 0.85,
    swimRequired: false,
    damaging: false,
  },

  // --- Misc walkable terrain ---
  clay_ground: {
    walkable: true,
    speedModifier: 0.85,
    swimRequired: false,
    damaging: false,
  },

  // --- Props/fence (non-walkable) ---
  alpha_props_fence: {
    walkable: false,
    speedModifier: 0,
    swimRequired: false,
    damaging: false,
  },

  // --- Ice ---
  ice_blue: {
    walkable: true,
    speedModifier: 0.6,
    swimRequired: false,
    damaging: false,
  },

  // --- Stone/urban surfaces ---
  light_stone: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },
  warm_stone: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },
  gray_cobble: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },
  slate: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },
  dark_brick: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },
  steel_floor: {
    walkable: true,
    speedModifier: 1.0,
    swimRequired: false,
    damaging: false,
  },

  // --- Road surfaces ---
  asphalt_white_line: {
    walkable: true,
    speedModifier: 1.1,
    swimRequired: false,
    damaging: false,
  },
  asphalt_yellow_line: {
    walkable: true,
    speedModifier: 1.1,
    swimRequired: false,
    damaging: false,
  },
};

/** Default surface properties for unknown terrain types. */
const DEFAULT_SURFACE: SurfaceProperties = {
  walkable: true,
  speedModifier: 1.0,
  swimRequired: false,
  damaging: false,
};

/** Get surface properties for a terrain type. Returns safe defaults for unknown terrains. */
export function getSurfaceProperties(terrain: TerrainCellType): SurfaceProperties {
  return SURFACE_PROPERTIES[terrain] ?? DEFAULT_SURFACE;
}

/** Check if a terrain type is walkable (without special abilities). */
export function isWalkable(terrain: TerrainCellType): boolean {
  return getSurfaceProperties(terrain).walkable;
}
