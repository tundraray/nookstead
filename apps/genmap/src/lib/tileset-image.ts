import sharp from 'sharp';

export interface SplitResult {
  buffer: Buffer;
  index: number;
  fileSize: number;
}

/**
 * Validate tileset image dimensions.
 * Width must be exactly 192, height must be a non-zero multiple of 64.
 */
export function validateTilesetDimensions(
  width: number,
  height: number
): { valid: boolean; error?: string; tilesetCount: number } {
  if (width !== 192) {
    return {
      valid: false,
      error: `Width must be exactly 192 (12 columns of 16px tiles). Got: ${width}`,
      tilesetCount: 0,
    };
  }

  if (height === 0 || height % 64 !== 0) {
    return {
      valid: false,
      error: `Height must be a multiple of 64 (4 rows of 16px tiles). Got: ${height}`,
      tilesetCount: 0,
    };
  }

  return { valid: true, tilesetCount: height / 64 };
}

/**
 * Split a 192x(N*64) tileset image into N separate 192x64 PNG buffers.
 */
export async function splitTilesetImage(
  buffer: Buffer,
  tilesetCount: number
): Promise<SplitResult[]> {
  const results: SplitResult[] = [];

  for (let i = 0; i < tilesetCount; i++) {
    const splitBuffer = await sharp(buffer)
      .extract({ left: 0, top: i * 64, width: 192, height: 64 })
      .png()
      .toBuffer();
    results.push({
      buffer: splitBuffer,
      index: i,
      fileSize: splitBuffer.length,
    });
  }

  return results;
}

/**
 * Validate frame content in a 192x64 tileset image.
 * Checks each of 48 frames (12 columns x 4 rows of 16x16 tiles)
 * for non-zero alpha channel pixels.
 */
export async function validateFrameContent(
  buffer: Buffer
): Promise<{ valid: number[]; empty: number[] }> {
  const valid: number[] = [];
  const empty: number[] = [];

  for (let frame = 0; frame < 48; frame++) {
    const col = frame % 12;
    const row = Math.floor(frame / 12);
    const frameBuffer = await sharp(buffer)
      .extract({ left: col * 16, top: row * 16, width: 16, height: 16 })
      .ensureAlpha()
      .raw()
      .toBuffer();

    let hasContent = false;
    for (let i = 3; i < frameBuffer.length; i += 4) {
      if (frameBuffer[i] > 0) {
        hasContent = true;
        break;
      }
    }

    if (hasContent) valid.push(frame);
    else empty.push(frame);
  }

  return { valid, empty };
}
