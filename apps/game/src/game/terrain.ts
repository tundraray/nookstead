export interface TerrainType {
  key: string;
  file: string;
  name: string;
  solidFrame: number;
}

const TERRAIN_NAMES = [
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
