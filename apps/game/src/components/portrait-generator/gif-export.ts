import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { renderFrameToImageData } from './portrait-canvas';
import {
  SHEET_COLUMNS,
  FRAME_WIDTH,
  FRAME_HEIGHT,
  ANIMATION_FPS,
  type AnimationType,
} from './types';

/**
 * Generate an animated GIF of the portrait and return a Blob URL for download.
 *
 * @param images    - Layer images in draw order (bottom to top)
 * @param animType  - Which animation row to encode
 * @param scale     - Integer scale factor (e.g. 4 means 128x128 GIF)
 * @returns Blob URL string (caller should revoke when done)
 */
export async function exportGif(
  images: HTMLImageElement[],
  animType: AnimationType,
  scale: number
): Promise<string> {
  const w = FRAME_WIDTH * scale;
  const h = FRAME_HEIGHT * scale;
  const delay = Math.round(1000 / ANIMATION_FPS);

  const gif = GIFEncoder() as ReturnType<typeof GIFEncoder>;

  const frameCount = animType === 'idle' ? 1 : SHEET_COLUMNS;

  for (let frame = 0; frame < frameCount; frame++) {
    const imageData = renderFrameToImageData(images, frame, animType, scale);
    const { data } = imageData;

    // Convert RGBA Uint8ClampedArray to a plain "rgb" format for quantize
    const rgba = new Uint8Array(data.buffer);

    const palette = quantize(rgba, 256, { format: 'rgba4444' });
    const indexed = applyPalette(rgba, palette, 'rgba4444');

    // Find transparent-ish color index (alpha < 128) for transparency
    let transparentIndex: number | undefined;
    for (let i = 0; i < palette.length; i++) {
      const color = palette[i] as number[];
      if (color.length >= 4 && color[3] < 128) {
        transparentIndex = i;
        break;
      }
    }

    gif.writeFrame(indexed, w, h, {
      palette,
      delay,
      transparent: transparentIndex !== undefined,
      transparentIndex,
      dispose: 2, // restore to background
    });
  }

  gif.finish();

  const bytes = gif.bytes();
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'image/gif' });
  return URL.createObjectURL(blob);
}
