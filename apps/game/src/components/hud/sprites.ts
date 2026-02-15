import type { NineSliceSet, SpriteRect } from './types';
import { tileRect, tileRectCentered } from './sprite';

/**
 * Named regions in hud_32.png (32px tile grid, 61 columns).
 * Use tileRect(position) to compute [x, y, w, h] from a 1-indexed tile number.
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

// 9-slice: modal panel (tiles 1, 2, 3 / 62, 63, 64 / 123, 124, 125)
export const PANEL_MODAL: NineSliceSet = {
  cornerTL: tileRect(1),
  edgeT: tileRect(2),
  cornerTR: tileRect(3),
  edgeL: tileRect(62),
  center: tileRect(63),
  edgeR: tileRect(64),
  cornerBL: tileRect(123),
  edgeB: tileRect(124),
  cornerBR: tileRect(125),
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

  // Modal
  closeIcon: tileRectCentered(20, 16),
  headerLeft: tileRect(1404),
  headerCenter: tileRect(1405),
  headerRight: tileRect(1406),
} as const;
