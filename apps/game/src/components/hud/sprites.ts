import type { NineSliceSet } from './types';
import { TILE_SIZE, tileRect, tileRectCentered } from './sprite';

/**
 * Named regions in hud_32.png (32px tile grid, 61 columns).
 * Use tileRect(position) to compute [x, y, w, h] from a 1-indexed tile number.
 * All coordinates are expressed relative to TILE_SIZE (T).
 *
 * IMPORTANT: Values are APPROXIMATE. Must be verified at 1:1 zoom
 * in an image editor before production use.
 */

const T = TILE_SIZE;

// 9-slice: slot normal (tile 1102)
export const SLOT_NORMAL: NineSliceSet = {
  cornerTL: tileRect(1102),
  edgeT: tileRect(1103),
  cornerTR: tileRect(1104),
  edgeL: tileRect(1163),
  center: tileRect(1164),
  edgeR: tileRect(1165),
  cornerBL: tileRect(1224),
  edgeB: tileRect(1225),
  cornerBR: tileRect(1226),
};

// 9-slice: slot selected (tile 614)
export const SLOT_SELECTED: NineSliceSet = {
  cornerTL: tileRect(614),
  edgeT: tileRect(615),
  cornerTR: tileRect(616),
  edgeL: tileRect(675),
  center: tileRect(676),
  edgeR: tileRect(677),
  cornerBL: tileRect(736),
  edgeB: tileRect(737),
  cornerBR: tileRect(738),
};

// 9-slice: modal panel (tile 1)
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
  // Icons
  menuBtnNormal: tileRect(91),
  menuBtnActive: tileRect(101),

  // Modal
  closeIcon: tileRectCentered(20, T / 2),
  headerLeft: tileRect(1404),
  headerCenter: tileRect(1405),
  headerRight: tileRect(1406),
} as const;
