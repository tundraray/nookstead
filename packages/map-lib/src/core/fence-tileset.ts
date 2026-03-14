/// <reference lib="dom" />

/**
 * Virtual fence tileset generation.
 *
 * Composes individual atlas frame images into a single canvas that serves as
 * the fence tileset texture. The canvas layout is 4 columns x 5 rows = 64x80
 * pixels at 16px per tile.
 *
 * Layout:
 *   Frame 0 (slot 0): empty sentinel -- left transparent (not drawn)
 *   Frames 1-16 (slots 1-16): 16 cardinal connection states (bitmask 0-15)
 *   Frames 17-20 (slots 17-20): 4 gate variants
 *
 * @see Design Doc Section 6.4
 */

import {
  FENCE_TOTAL_FRAMES,
  FENCE_TILESET_COLS,
  FENCE_EMPTY_FRAME,
} from './fence-autotile';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRAME_SIZE = 16;
const TILESET_WIDTH = FENCE_TILESET_COLS * FRAME_SIZE; // 64
const TILESET_HEIGHT =
  (FENCE_TOTAL_FRAMES / FENCE_TILESET_COLS) * FRAME_SIZE; // 80

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Describes a single frame image to be drawn into the virtual tileset.
 *
 * Each entry specifies a 1-based frame index (1-20), a source image (or null
 * to skip), and the source rectangle within that image.
 */
export interface FrameImageSource {
  /** 1-based frame index in the tileset (1-20). Frame 0 is the empty sentinel. */
  frameIndex: number;
  /** Source image to draw from, or null to skip this frame gracefully. */
  image: CanvasImageSource | null;
  /** X offset in the source image. */
  srcX: number;
  /** Y offset in the source image. */
  srcY: number;
  /** Width of the source rectangle. */
  srcW: number;
  /** Height of the source rectangle. */
  srcH: number;
}

/** Factory function that creates the output canvas. */
type CanvasFactory = () => HTMLCanvasElement | OffscreenCanvas;

// ---------------------------------------------------------------------------
// Default canvas factory
// ---------------------------------------------------------------------------

function defaultCanvasFactory(): HTMLCanvasElement {
  return document.createElement('canvas');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a virtual fence tileset canvas from individual atlas frame images.
 *
 * The returned canvas is 64x80 pixels (4 columns x 5 rows at 16px per tile).
 * Each frame in `frameImages` is drawn at the position determined by its
 * 1-based `frameIndex`:
 *
 * ```
 * idx = frameIndex - 1
 * destX = (idx % 4) * 16
 * destY = Math.floor(idx / 4) * 16
 * ```
 *
 * Frame 0 (the empty sentinel) and entries with a null `image` are silently
 * skipped -- the corresponding slot remains transparent.
 *
 * @param frameImages - Array of frame image sources to compose into the tileset
 * @param canvasFactory - Optional factory for creating the output canvas.
 *   Defaults to `document.createElement('canvas')`. Pass a custom factory for
 *   OffscreenCanvas support or test environment injection.
 * @returns The composed tileset canvas
 *
 * @see Design Doc Section 6.4
 */
export function generateFenceTileset(
  frameImages: FrameImageSource[],
  canvasFactory: CanvasFactory = defaultCanvasFactory,
): HTMLCanvasElement | OffscreenCanvas {
  const canvas = canvasFactory();
  canvas.width = TILESET_WIDTH;
  canvas.height = TILESET_HEIGHT;

  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas');
  }

  for (const { frameIndex, image, srcX, srcY, srcW, srcH } of frameImages) {
    // Skip the empty sentinel frame
    if (frameIndex === FENCE_EMPTY_FRAME) continue;
    // Skip missing images gracefully
    if (!image) continue;

    // Compute destination position from 1-based frame index
    const idx = frameIndex - 1;
    const destX = (idx % FENCE_TILESET_COLS) * FRAME_SIZE;
    const destY = Math.floor(idx / FENCE_TILESET_COLS) * FRAME_SIZE;

    ctx.drawImage(
      image as CanvasImageSource,
      srcX,
      srcY,
      srcW,
      srcH,
      destX,
      destY,
      FRAME_SIZE,
      FRAME_SIZE,
    );
  }

  return canvas;
}
