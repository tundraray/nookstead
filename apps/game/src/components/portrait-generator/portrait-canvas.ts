import {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  SHEET_COLUMNS,
  ANIM_ROW,
  type AnimationType,
} from './types';

// ---------------------------------------------------------------------------
// Image cache
// ---------------------------------------------------------------------------

const imageCache = new Map<string, HTMLImageElement>();
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  const existing = loadingPromises.get(src);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      loadingPromises.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      loadingPromises.delete(src);
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });

  loadingPromises.set(src, promise);
  return promise;
}

export function preloadImages(paths: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(paths.map(loadImage));
}

// ---------------------------------------------------------------------------
// Frame drawing
// ---------------------------------------------------------------------------

/**
 * Draw a single composited frame onto the given canvas context.
 *
 * @param ctx      - Destination 2D context (already sized)
 * @param images   - Layer images in draw order (bottom to top)
 * @param frameIndex - Which animation frame (0-9)
 * @param animType - Animation type determines the row
 * @param scale    - Integer scale factor (e.g. 8 = 256x256)
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  frameIndex: number,
  animType: AnimationType,
  scale: number
): void {
  const col = frameIndex % SHEET_COLUMNS;
  const row = ANIM_ROW[animType];
  const sx = col * FRAME_WIDTH;
  const sy = row * FRAME_HEIGHT;
  const dw = FRAME_WIDTH * scale;
  const dh = FRAME_HEIGHT * scale;

  ctx.clearRect(0, 0, dw, dh);
  ctx.imageSmoothingEnabled = false;

  for (const img of images) {
    ctx.drawImage(img, sx, sy, FRAME_WIDTH, FRAME_HEIGHT, 0, 0, dw, dh);
  }
}

/**
 * Draw a single composited frame to an offscreen canvas and return its
 * ImageData. Useful for GIF export.
 */
export function renderFrameToImageData(
  images: HTMLImageElement[],
  frameIndex: number,
  animType: AnimationType,
  scale: number
): ImageData {
  const w = FRAME_WIDTH * scale;
  const h = FRAME_HEIGHT * scale;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }
  drawFrame(ctx, images, frameIndex, animType, scale);
  return ctx.getImageData(0, 0, w, h);
}
