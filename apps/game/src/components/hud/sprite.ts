import type React from 'react';
import type { SpriteRect } from './types';

export const SHEET_PATH = '/assets/ui/hud_32.png';
export const SHEET_W = 1952;
export const SHEET_H = 1376;
export const TILE_SIZE = 32;
export const TILE_COLS = Math.floor(SHEET_W / TILE_SIZE); // 61

/**
 * Converts a 1-indexed tile position to a SpriteRect [x, y, w, h].
 * Tile numbering: 1 = top-left, increments left-to-right then top-to-bottom.
 * Optional w/h override the default TILE_SIZE dimensions.
 */
export function tileRect(
  position: number,
  w = TILE_SIZE,
  h = w,
): SpriteRect {
  const index = position - 1;
  const col = index % TILE_COLS;
  const row = Math.floor(index / TILE_COLS);
  return [col * TILE_SIZE, row * TILE_SIZE, w, h];
}

/**
 * Like tileRect but centers a smaller sprite within the tile cell.
 * E.g. a 16x16 icon centered in a 32x32 tile.
 */
export function tileRectCentered(
  position: number,
  size: number,
): SpriteRect {
  const index = position - 1;
  const col = index % TILE_COLS;
  const row = Math.floor(index / TILE_COLS);
  const offset = Math.floor((TILE_SIZE - size) / 2);
  return [col * TILE_SIZE + offset, row * TILE_SIZE + offset, size, size];
}

/**
 * Returns inline styles that slice a rectangle from hud.png
 * using a fixed numeric scale factor.
 */
export function spriteStyle(
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 3,
): React.CSSProperties {
  return {
    backgroundImage: `url('${SHEET_PATH}')`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${-x * scale}px ${-y * scale}px`,
    backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
    width: `${w * scale}px`,
    height: `${h * scale}px`,
    imageRendering: 'pixelated',
  };
}

/**
 * CSS calc() variant -- reflows automatically when --ui-scale changes.
 * No JavaScript resize listener needed.
 */
export function spriteCSSStyle(
  x: number,
  y: number,
  w: number,
  h: number,
): React.CSSProperties {
  return {
    backgroundImage: `url('${SHEET_PATH}')`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `calc(${-x}px * var(--ui-scale)) calc(${-y}px * var(--ui-scale))`,
    backgroundSize: `calc(${SHEET_W}px * var(--ui-scale)) calc(${SHEET_H}px * var(--ui-scale))`,
    width: `calc(${w}px * var(--ui-scale))`,
    height: `calc(${h}px * var(--ui-scale))`,
    imageRendering: 'pixelated',
  };
}

/**
 * Renders a sprite at native 1:1 pixel size (no --ui-scale).
 * Sets explicit width/height — use for fixed-size elements (corners).
 */
export function spriteNativeStyle(
  x: number,
  y: number,
  w: number,
  h: number,
): React.CSSProperties {
  return {
    backgroundImage: `url('${SHEET_PATH}')`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${-x}px ${-y}px`,
    backgroundSize: `${SHEET_W}px ${SHEET_H}px`,
    width: `${w}px`,
    height: `${h}px`,
    imageRendering: 'pixelated',
  };
}

/**
 * Renders a sprite tile stretched to fill its container.
 * No explicit width/height — the parent (e.g. CSS grid cell) determines size.
 * Uses percentage-based background-size so the tile scales with the cell.
 */
export function spriteStretchStyle(
  x: number,
  y: number,
  w: number,
  h: number,
): React.CSSProperties {
  const cols = SHEET_W / w;
  const rows = SHEET_H / h;
  const tileCol = x / w;
  const tileRow = y / h;
  const posX = cols > 1 ? (tileCol / (cols - 1)) * 100 : 0;
  const posY = rows > 1 ? (tileRow / (rows - 1)) * 100 : 0;

  return {
    backgroundImage: `url('${SHEET_PATH}')`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${posX}% ${posY}%`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    imageRendering: 'pixelated',
  };
}
