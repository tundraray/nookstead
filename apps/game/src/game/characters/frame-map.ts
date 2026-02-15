/**
 * Frame map module for character sprite sheet animation definitions.
 *
 * Computes sprite sheet frame indices for all 27 character animations
 * (7 states x 4 directions, minus hurt_down). Handles the irregular
 * sprite sheet layout:
 *
 * - 927px width / 16px frame width = 57 columns per row
 * - Variable frame counts: idle/walk/hit/punch = 6, sit = 3, hurt = 4
 * - Irregular direction orders: most rows LEFT/UP/RIGHT/DOWN,
 *   sit row uses LEFT/DOWN/RIGHT/UP
 * - Hurt has only 3 directions (no down variant)
 *
 * Pure data module with NO Phaser dependency.
 */

import { ANIMATION_FPS } from '../constants';

/** Cardinal movement directions. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** Definition for a single animation sequence. */
export interface AnimationDef {
  /** Unique animation key, e.g. 'char-scout_idle_down' */
  key: string;
  /** Ordered frame indices from the spritesheet */
  frames: number[];
  /** Playback speed in frames per second */
  frameRate: number;
  /** -1 for infinite loop, 0 for play-once */
  repeat: number;
}

/** Standard direction order used by most animation rows. */
const STANDARD_DIRS: readonly Direction[] = [
  'left',
  'up',
  'right',
  'down',
] as const;

/** Sit row uses a different direction order: LEFT, DOWN, RIGHT, UP. */
const SIT_DIRS: readonly Direction[] = [
  'left',
  'down',
  'right',
  'up',
] as const;

/** Hurt row has only 3 directions (no down variant). */
const HURT_DIRS: readonly Direction[] = ['left', 'up', 'right'] as const;

/**
 * Configuration for a single animation state row in the sprite sheet.
 *
 * Each character sprite sheet encodes animation states in specific rows.
 * The row index refers to the 16x32 frame grid (each frame is 16px wide
 * and 32px tall, occupying 2 pixel-rows of 16px each).
 */
interface AnimStateConfig {
  /** Animation state name */
  state: string;
  /** Row index in the 16x32 frame grid */
  row: number;
  /** Number of frames per direction */
  frameCount: number;
  /** Ordered list of directions for this row */
  directions: readonly Direction[];
  /** -1 for loop, 0 for play-once */
  repeat: number;
}

/**
 * All animation state configurations.
 *
 * Row indices correspond to the 16x32 frame grid within the sprite sheet:
 * - Row 1 (y=32): idle
 * - Row 2 (y=64): walk
 * - Row 4 (y=128): sit (different direction order)
 * - Row 13 (y=416): hit
 * - Row 14 (y=448): punch
 * - Row 19 (y=608): hurt (3 directions only)
 *
 * "waiting" reuses idle frames and is handled separately.
 */
const ANIM_STATES: readonly AnimStateConfig[] = [
  {
    state: 'idle',
    row: 1,
    frameCount: 6,
    directions: STANDARD_DIRS,
    repeat: -1,
  },
  {
    state: 'walk',
    row: 2,
    frameCount: 6,
    directions: STANDARD_DIRS,
    repeat: -1,
  },
  {
    state: 'sit',
    row: 4,
    frameCount: 3,
    directions: SIT_DIRS,
    repeat: 0,
  },
  {
    state: 'hit',
    row: 13,
    frameCount: 6,
    directions: STANDARD_DIRS,
    repeat: 0,
  },
  {
    state: 'punch',
    row: 14,
    frameCount: 6,
    directions: STANDARD_DIRS,
    repeat: 0,
  },
  {
    state: 'hurt',
    row: 19,
    frameCount: 4,
    directions: HURT_DIRS,
    repeat: 0,
  },
];

/** Hardcoded sprite sheet width for MVP (Task 4.1 will derive at runtime). */
const TEXTURE_WIDTH = 927;

/** Width of a single frame in the sprite sheet. */
const FRAME_WIDTH = 16;

/**
 * Compute the number of columns per row in a sprite sheet.
 *
 * Uses Math.floor to handle sheets whose width is not an exact multiple
 * of the frame width (e.g. 927 / 16 = 57.9375 -> 57).
 */
export function computeColumnsPerRow(
  textureWidth: number,
  frameWidth: number
): number {
  return Math.floor(textureWidth / frameWidth);
}

/**
 * Generate a unique animation key from sheet key, state, and direction.
 *
 * @example animKey('char-scout', 'idle', 'down') => 'char-scout_idle_down'
 */
export function animKey(
  sheetKey: string,
  state: string,
  direction: Direction
): string {
  return `${sheetKey}_${state}_${direction}`;
}

/**
 * Generate a contiguous array of frame indices.
 *
 * @param start - First frame index (inclusive)
 * @param count - Number of frames to generate
 * @returns Array of sequential frame indices [start, start+1, ..., start+count-1]
 */
function generateFrames(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i);
}

/**
 * Build AnimationDef entries for a single animation state.
 *
 * Computes frame indices for each direction within the state's sprite
 * sheet row, using the configured direction order and frame count.
 */
function buildStateAnimations(
  sheetKey: string,
  config: AnimStateConfig,
  colsPerRow: number
): AnimationDef[] {
  const base = config.row * colsPerRow;

  return config.directions.map((dir, dirIndex) => ({
    key: animKey(sheetKey, config.state, dir),
    frames: generateFrames(base + dirIndex * config.frameCount, config.frameCount),
    frameRate: ANIMATION_FPS,
    repeat: config.repeat,
  }));
}

/**
 * Generate all 27 animation definitions for a character skin.
 *
 * Produces AnimationDef objects for 7 animation states across up to 4
 * directions each. The "waiting" state reuses idle frames with looping
 * playback. The "hurt" state has only 3 directions (no down variant).
 *
 * @param skinKey - Skin identifier (e.g. 'scout'), used for reference only
 * @param sheetKey - Sprite sheet texture key (e.g. 'char-scout'), used in animation keys
 * @returns Array of 27 AnimationDef objects with exact frame indices
 */
export function getAnimationDefs(
  skinKey: string,
  sheetKey: string
): AnimationDef[] {
  const colsPerRow = computeColumnsPerRow(TEXTURE_WIDTH, FRAME_WIDTH);
  const defs: AnimationDef[] = [];

  for (const config of ANIM_STATES) {
    defs.push(...buildStateAnimations(sheetKey, config, colsPerRow));
  }

  // "waiting" reuses idle frames with looping playback
  const idleConfig = ANIM_STATES.find((c) => c.state === 'idle');
  if (!idleConfig) {
    throw new Error('idle state not found in ANIM_STATES');
  }
  const idleBase = idleConfig.row * colsPerRow;

  for (let dirIndex = 0; dirIndex < idleConfig.directions.length; dirIndex++) {
    const dir = idleConfig.directions[dirIndex];
    defs.push({
      key: animKey(sheetKey, 'waiting', dir),
      frames: generateFrames(
        idleBase + dirIndex * idleConfig.frameCount,
        idleConfig.frameCount
      ),
      frameRate: ANIMATION_FPS,
      repeat: -1,
    });
  }

  return defs;
}
