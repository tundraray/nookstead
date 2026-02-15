import type { NineSliceSet, SpriteRect } from './types';

/**
 * Named regions in hud_32.png (32px tile grid).
 *
 * IMPORTANT: Values are APPROXIMATE. Must be verified at 1:1 zoom
 * in an image editor before production use.
 */

// 9-slice: slot normal (tiles 1101-1225)
export const SLOT_NORMAL: NineSliceSet = {
  cornerTL: [96, 576, 32, 32],
  edgeT: [128, 576, 32, 32],
  cornerTR: [160, 576, 32, 32],
  edgeL: [96, 608, 32, 32],
  center: [128, 608, 32, 32],
  edgeR: [160, 608, 32, 32],
  cornerBL: [96, 640, 32, 32],
  edgeB: [128, 640, 32, 32],
  cornerBR: [160, 640, 32, 32],
};

// 9-slice: slot selected (tiles 613-737)
export const SLOT_SELECTED: NineSliceSet = {
  cornerTL: [96, 320, 32, 32],
  edgeT: [128, 320, 32, 32],
  cornerTR: [160, 320, 32, 32],
  edgeL: [96, 352, 32, 32],
  center: [128, 352, 32, 32],
  edgeR: [160, 352, 32, 32],
  cornerBL: [96, 384, 32, 32],
  edgeB: [128, 384, 32, 32],
  cornerBR: [160, 384, 32, 32],
};

// Default panel style (reuses slot normal frame)
export const PANEL_DEFAULT = SLOT_NORMAL;

export const SPRITES = {
  // Icons (approximate -- verify in image editor)
  coinIcon: [32, 32, 11, 11] as SpriteRect,
  menuBtnNormal: [928, 32, 32, 32] as SpriteRect,
  menuBtnActive: [1248, 32, 32, 32] as SpriteRect,

  // Season icons
  seasonSpring: [0, 48, 11, 11] as SpriteRect,
  seasonSummer: [11, 48, 11, 11] as SpriteRect,
  seasonAutumn: [21, 48, 11, 11] as SpriteRect,
  seasonWinter: [32, 48, 11, 11] as SpriteRect,

  // Energy bar
  energyFrame: [64, 0, 5, 32] as SpriteRect,
  energyFill: [69, 0, 3, 32] as SpriteRect,
  energyEmpty: [72, 0, 3, 32] as SpriteRect,

  // Navigation icons (approximate -- verify in image editor)
  navInventory: [928, 64, 32, 32] as SpriteRect,
  navMap: [960, 64, 32, 32] as SpriteRect,
  navQuests: [992, 64, 32, 32] as SpriteRect,
  navSocial: [1024, 64, 32, 32] as SpriteRect,
  navSettings: [1056, 64, 32, 32] as SpriteRect,
} as const;
