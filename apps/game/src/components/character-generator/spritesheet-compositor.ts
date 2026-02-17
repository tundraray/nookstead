/**
 * Spritesheet compositor for the character generator.
 *
 * Handles multi-layer compositing with column count mismatch:
 * body sheets are 927px wide (57 columns) while overlay sheets
 * are 896px wide (56 columns). Output is normalized to 896x656
 * (56 columns) matching the premade character format.
 *
 * Pure data module — no Phaser or React dependency.
 */

import {
  ADULT_OVERLAY_WIDTH,
  ADULT_OVERLAY_HEIGHT,
  ADULT_OVERLAY_COLUMNS,
  FRAME_WIDTH,
  FRAME_HEIGHT,
} from './types';

export interface LayerConfig {
  image: HTMLImageElement;
  columns: number;
  sheetWidth: number;
  sheetHeight: number;
}

/**
 * Extract the source rectangle for a frame at (row, col) from a layer.
 * Uses per-layer column count for correct pixel coordinates.
 */
export function extractFrame(
  layer: LayerConfig,
  row: number,
  col: number
): { sx: number; sy: number; sw: number; sh: number } {
  const sx = col * FRAME_WIDTH;
  const sy = row * FRAME_HEIGHT;
  return { sx, sy, sw: FRAME_WIDTH, sh: FRAME_HEIGHT };
}

/**
 * Draw a single composited frame to a canvas context.
 * Layers are drawn bottom-to-top in array order.
 *
 * @param ctx - Target canvas context
 * @param layers - Layers in compositing order (bottom first)
 * @param row - Row index in the frame grid
 * @param col - Column index in the frame grid
 * @param dx - Destination X on the canvas
 * @param dy - Destination Y on the canvas
 * @param scale - Integer scale multiplier (1 = native, 8 = preview)
 */
export function drawCompositeFrame(
  ctx: CanvasRenderingContext2D,
  layers: LayerConfig[],
  row: number,
  col: number,
  dx: number,
  dy: number,
  scale: number
): void {
  for (const layer of layers) {
    // Skip if this column doesn't exist in this layer
    if (col >= layer.columns) continue;

    const { sx, sy, sw, sh } = extractFrame(layer, row, col);

    // Skip if the source rectangle is outside the image bounds
    if (sx + sw > layer.image.width || sy + sh > layer.image.height) continue;

    ctx.drawImage(
      layer.image,
      sx,
      sy,
      sw,
      sh,
      dx,
      dy,
      FRAME_WIDTH * scale,
      FRAME_HEIGHT * scale
    );
  }
}

/**
 * Draw a single animation frame for the preview.
 *
 * @param ctx - Target canvas context (should be sized for scaled frame)
 * @param layers - Layer images in compositing order
 * @param row - Animation row in the spritesheet
 * @param col - Frame column within the row
 * @param scale - Integer scale multiplier
 */
export function drawPreviewFrame(
  ctx: CanvasRenderingContext2D,
  layers: LayerConfig[],
  row: number,
  col: number,
  scale: number
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  drawCompositeFrame(ctx, layers, row, col, 0, 0, scale);
}

/**
 * Pre-bake all layers into a single normalized spritesheet.
 *
 * Output is 896x656 (56 columns). For each frame position,
 * extracts the corresponding frame from each layer using that
 * layer's native column count and composites them.
 *
 * @param layers - Layer images in compositing order (body first)
 * @returns Canvas with the composited spritesheet
 */
export function prebakeSpritesheet(
  layers: LayerConfig[]
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ADULT_OVERLAY_WIDTH;
  canvas.height = ADULT_OVERLAY_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas 2D context');

  ctx.imageSmoothingEnabled = false;

  const totalRows = Math.floor(ADULT_OVERLAY_HEIGHT / FRAME_HEIGHT);

  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < ADULT_OVERLAY_COLUMNS; col++) {
      const dx = col * FRAME_WIDTH;
      const dy = row * FRAME_HEIGHT;
      drawCompositeFrame(ctx, layers, row, col, dx, dy, 1);
    }
  }

  return canvas;
}

/**
 * Pre-bake and export as a PNG data URL.
 */
export function prebakeToDataUrl(layers: LayerConfig[]): string {
  const canvas = prebakeSpritesheet(layers);
  return canvas.toDataURL('image/png');
}

/** Image loading cache (shared with portrait-canvas pattern). */
const imageCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Load an image with caching and deduplication.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

/**
 * Build LayerConfig from a loaded image and its metadata.
 */
export function buildLayerConfig(
  image: HTMLImageElement,
  columns: number,
  sheetWidth: number,
  sheetHeight: number
): LayerConfig {
  return { image, columns, sheetWidth, sheetHeight };
}
