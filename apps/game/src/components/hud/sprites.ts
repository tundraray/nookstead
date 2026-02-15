import type { NineSliceSet, SpriteRect } from './types';

/** Tile size in the sprite sheet (px). Matches --tile in CSS. */
export const TILE = 32;

/** Returns a SpriteRect for a full tile at grid position (col, row). */
function tile(col: number, row: number): SpriteRect {
  return [col * TILE, row * TILE, TILE, TILE];
}

// 9-slice: slot normal
export const SLOT_NORMAL: NineSliceSet = {
  cornerTL: tile(3, 18),
  edgeT: tile(4, 18),
  cornerTR: tile(5, 18),
  edgeL: tile(3, 19),
  center: tile(4, 19),
  edgeR: tile(5, 19),
  cornerBL: tile(3, 20),
  edgeB: tile(4, 20),
  cornerBR: tile(5, 20),
};

// 9-slice: slot selected
export const SLOT_SELECTED: NineSliceSet = {
  cornerTL: tile(3, 10),
  edgeT: tile(4, 10),
  cornerTR: tile(5, 10),
  edgeL: tile(3, 11),
  center: tile(4, 11),
  edgeR: tile(5, 11),
  cornerBL: tile(3, 12),
  edgeB: tile(4, 12),
  cornerBR: tile(5, 12),
};

// Default panel style (reuses slot normal frame)
export const PANEL_DEFAULT = SLOT_NORMAL;

export const SPRITES = {
  // Sub-tile icons (pixel coords — not tile-aligned)
  coinIcon: [32, 32, 11, 11] as SpriteRect,
  seasonSpring: [0, 48, 11, 11] as SpriteRect,
  seasonSummer: [11, 48, 11, 11] as SpriteRect,
  seasonAutumn: [21, 48, 11, 11] as SpriteRect,
  seasonWinter: [32, 48, 11, 11] as SpriteRect,

  // Menu buttons
  menuBtnNormal: tile(29, 1),
  menuBtnActive: tile(39, 1),
} as const;
