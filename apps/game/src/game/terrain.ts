export interface TerrainType {
  key: string;
  file: string;
  name: string;
  solidFrame: number;
}

const TERRAIN_NAMES = [
  'Dirt / Light Grass',     // 01
  'Orange / Grass',   // 02
  'Water / Grass',    // 03
  'Pale Sage',              // 04
  'Forest Edge',            // 05
  'Lush Green',             // 06
  'Light Sand / Grass',     // 07
  'Light Sand / Water',     // 08
  'Orange Sand / Light Sand',// 09
  'Sand / Alpha',           // 10
  'Clay Ground',            // 11
  'Grass / Orange',   // 12 — inv 02
  'Grass / Alpha',    // 13
  'Grass + Fenced',          // 14
  'Grass / Water',    // 15 — inv 03
  'Deep Water / Water',     // 16
  'Alpha / Props Fence',    // 17
  'Ice Blue',               // 18
  'Light Stone',            // 19
  'Warm Stone',             // 20
  'Gray Cobble',            // 21
  'Slate',                  // 22
  'Dark Brick',             // 23
  'Steel Floor',            // 24
  'Asphalt / White Line',   // 25
  'Asphalt / Yellow Line',  // 26
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
