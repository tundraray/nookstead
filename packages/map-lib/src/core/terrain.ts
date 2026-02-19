/** Describes how a tileset relates to terrain types and other tilesets. */
export interface TilesetRelationship {
  /** The terrain type this tileset draws (the "subject"). */
  from: string;
  /** The terrain type visible where this tileset is absent (the "background"). */
  to: string;
  /** Key of the inverse tileset (same transition, swapped subject/background). */
  inverseOf?: string;
}

export interface TerrainType {
  key: string;
  file: string;
  name: string;
  solidFrame: number;
  relationship?: TilesetRelationship;
}

export const TERRAIN_NAMES = [
  'dirt_light_grass',       // 01
  'orange_grass',           // 02
  'water_grass',            // 03
  'pale_sage',              // 04
  'forest_edge',            // 05
  'lush_green',             // 06
  'light_sand_grass',       // 07
  'light_sand_water',       // 08
  'orange_sand_light_sand', // 09
  'sand_alpha',             // 10
  'clay_ground',            // 11
  'grass_orange',           // 12 — inv 02
  'grass_alpha',            // 13
  'grass_fenced',           // 14
  'grass_water',            // 15 — inv 03
  'deep_water_water',       // 16
  'alpha_props_fence',      // 17
  'ice_blue',               // 18
  'light_stone',            // 19
  'warm_stone',             // 20
  'gray_cobble',            // 21
  'slate',                  // 22
  'dark_brick',             // 23
  'steel_floor',            // 24
  'asphalt_white_line',     // 25
  'asphalt_yellow_line',    // 26
];

import { SOLID_FRAME } from './autotile';

export const TERRAINS: TerrainType[] = TERRAIN_NAMES.map((name, i) => {
  const num = String(i + 1).padStart(2, '0');
  return {
    key: `terrain-${num}`,
    file: `terrain-${num}.png`,
    name,
    solidFrame: SOLID_FRAME,
  };
});

// Set relationships for terrain types that have them
function setRelationship(terrainNum: number, rel: TilesetRelationship) {
  TERRAINS[terrainNum - 1].relationship = rel;
}

// Water/grass pair (inverses)
setRelationship(3, { from: 'water', to: 'grass', inverseOf: 'terrain-15' });
setRelationship(15, { from: 'grass', to: 'water', inverseOf: 'terrain-03' });

// Deep water/water
setRelationship(16, { from: 'deep_water', to: 'water' });

// Dirt/grass
setRelationship(1, { from: 'dirt', to: 'grass' });

// Orange grass (and its inverse)
setRelationship(2, { from: 'orange_grass', to: 'grass' });
setRelationship(12, { from: 'grass', to: 'orange_grass', inverseOf: 'terrain-02' });

// Sand pairs
setRelationship(7, { from: 'light_sand', to: 'grass' });
setRelationship(8, { from: 'light_sand', to: 'water' });
setRelationship(9, { from: 'orange_sand', to: 'light_sand' });
setRelationship(10, { from: 'sand', to: 'alpha' });

// Forest
setRelationship(4, { from: 'pale_sage', to: 'grass' });
setRelationship(5, { from: 'forest', to: 'grass' });
setRelationship(6, { from: 'lush_green', to: 'grass' });

// Grass variants
setRelationship(13, { from: 'grass', to: 'alpha' });
setRelationship(14, { from: 'grass', to: 'fenced' });

/** Get a terrain type by its key (e.g., 'terrain-03'). */
export function getTerrainByKey(key: string): TerrainType | undefined {
  return TERRAINS.find((t) => t.key === key);
}

/** Get the inverse tileset for a given terrain key. */
export function getInverseTileset(key: string): TerrainType | undefined {
  const terrain = getTerrainByKey(key);
  if (!terrain?.relationship?.inverseOf) return undefined;
  return getTerrainByKey(terrain.relationship.inverseOf);
}

/** Check if two tilesets can be layered (top over bottom). */
export function canLayerTogether(topKey: string, bottomKey: string): boolean {
  const top = getTerrainByKey(topKey);
  const bottom = getTerrainByKey(bottomKey);
  if (!top?.relationship || !bottom?.relationship) return false;
  // Top's background must match bottom's subject
  return top.relationship.to === bottom.relationship.from;
}

/** Get all tilesets that transition FROM a given terrain type. */
export function getTilesetsForTerrain(terrainType: string): TerrainType[] {
  return TERRAINS.filter((t) => t.relationship?.from === terrainType);
}

/** Helper: get terrain by 1-based number. */
function t(n: number) { return TERRAINS[n - 1]; }

/** Named tileset collections. Keys match TERRAIN_NAMES exactly. */
export const TILESETS = {
  grassland: {
    name: 'grassland',
    dirt_light_grass:  t(1),
    orange_grass:      t(2),
    grass_orange:      t(12),
    grass_alpha:       t(13),
    grass_fenced:      t(14),
  },
  water: {
    name: 'water',
    water_grass:       t(3),
    grass_water:       t(15),
    deep_water_water:  t(16),
  },
  sand: {
    name: 'sand',
    light_sand_grass:        t(7),
    light_sand_water:        t(8),
    orange_sand_light_sand:  t(9),
    sand_alpha:              t(10),
  },
  forest: {
    name: 'forest',
    pale_sage:         t(4),
    forest_edge:       t(5),
    lush_green:        t(6),
  },
  stone: {
    name: 'stone',
    ice_blue:          t(18),
    light_stone:       t(19),
    warm_stone:        t(20),
    gray_cobble:       t(21),
    slate:             t(22),
    dark_brick:        t(23),
    steel_floor:       t(24),
  },
  road: {
    name: 'road',
    asphalt_white_line:  t(25),
    asphalt_yellow_line: t(26),
  },
  props: {
    name: 'props',
    alpha_props_fence: t(17),
  },
  misc: {
    name: 'misc',
    clay_ground:       t(11),
  },
} as const;
