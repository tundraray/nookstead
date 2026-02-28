import { NextRequest, NextResponse } from 'next/server';
import { getDb, createSprite, listSprites, batchSaveFrames } from '@nookstead/db';
import type { FrameInput } from '@nookstead/db';
import { uploadToS3, buildS3Url, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@nookstead/s3';
import { generateS3Key } from '@/lib/s3-key';
import { withSignedUrl, withSignedUrls } from '@/lib/signed-url';

interface AtlasFrame {
  filename: string;
  rotated?: boolean;
  trimmed?: boolean;
  sourceSize?: { w: number; h: number };
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
  frame: { x: number; y: number; w: number; h: number };
  pivot?: { x: number; y: number };
}

interface TexturePackerAtlas {
  textures?: Array<{ frames: AtlasFrame[] }>;
  frames?: AtlasFrame[];
}

function toBemName(filename: string): string {
  // Strip file extension
  const name = filename.replace(/\.[^/.]+$/, '');
  const parts = name.split('_');
  if (parts.length === 0) return name;

  const block = parts[0];

  // Check if the last part is a dimension like "16x16"
  const lastPart = parts[parts.length - 1];
  const hasDimension = /^\d+x\d+$/.test(lastPart);

  const elementParts = hasDimension ? parts.slice(1, -1) : parts.slice(1);
  const modifier = hasDimension ? lastPart : '';

  let result = block;
  if (elementParts.length > 0) result += `_${elementParts.join('-')}`;
  if (modifier) result += `--${modifier}`;
  return result;
}

function parseAtlasFrames(atlas: TexturePackerAtlas): FrameInput[] {
  // Support both formats: { textures: [{ frames }] } and { frames }
  const rawFrames = atlas.textures?.[0]?.frames ?? atlas.frames ?? [];

  return rawFrames.map((f) => ({
    filename: toBemName(f.filename),
    frameX: f.frame.x,
    frameY: f.frame.y,
    frameW: f.frame.w,
    frameH: f.frame.h,
    rotated: f.rotated ?? false,
    trimmed: f.trimmed ?? false,
    spriteSourceSizeX: f.spriteSourceSize?.x ?? 0,
    spriteSourceSizeY: f.spriteSourceSize?.y ?? 0,
    spriteSourceSizeW: f.spriteSourceSize?.w ?? f.frame.w,
    spriteSourceSizeH: f.spriteSourceSize?.h ?? f.frame.h,
    sourceSizeW: f.sourceSize?.w ?? f.frame.w,
    sourceSizeH: f.sourceSize?.h ?? f.frame.h,
    pivotX: f.pivot?.x ?? 0.5,
    pivotY: f.pivot?.y ?? 0.5,
  }));
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string | null)?.trim();
  const atlasFile = formData.get('atlas') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
      { status: 400 }
    );
  }

  // Parse atlas JSON if provided
  let atlasFrames: FrameInput[] = [];
  if (atlasFile) {
    try {
      const atlasText = await atlasFile.text();
      const atlasData = JSON.parse(atlasText) as TexturePackerAtlas;
      atlasFrames = parseAtlasFrames(atlasData);
    } catch {
      return NextResponse.json(
        { error: 'Invalid atlas JSON file' },
        { status: 400 }
      );
    }
  }

  const s3Key = generateS3Key(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadToS3(s3Key, buffer, file.type);

  const s3Url = buildS3Url(s3Key);

  // Extract dimensions from the image using a simple PNG/JPEG/WebP header parser
  const { width, height } = parseImageDimensions(buffer, file.type);

  const db = getDb();
  const sprite = await createSprite(db, {
    name,
    s3Key,
    s3Url,
    width,
    height,
    fileSize: file.size,
    mimeType: file.type,
  });

  // Auto-create frames from atlas JSON
  if (atlasFrames.length > 0) {
    await batchSaveFrames(db, sprite.id, atlasFrames);
  }

  const signed = await withSignedUrl(sprite);
  return NextResponse.json(signed, { status: 201 });
}

function parseImageDimensions(
  buffer: Buffer,
  mimeType: string
): { width: number; height: number } {
  if (mimeType === 'image/png') {
    // PNG IHDR chunk starts at byte 16, width at 16-19, height at 20-23
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  if (mimeType === 'image/jpeg') {
    // Scan JPEG for SOF0/SOF2 markers (0xFFC0 or 0xFFC2)
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const segLen = buffer.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }

  if (mimeType === 'image/webp') {
    // WebP VP8 or VP8L header
    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    if (riff === 'RIFF' && webp === 'WEBP') {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8 ') {
        // Lossy: width at 26-27, height at 28-29 (little-endian)
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (chunk === 'VP8L') {
        // Lossless: dimensions packed in 4 bytes starting at offset 21
        const bits = buffer.readUInt32LE(21);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height };
      }
    }
  }

  // Fallback: return 0 if we can't parse
  return { width: 0, height: 0 };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const params: { limit?: number; offset?: number } = {};

  if (limitParam !== null) {
    const limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'limit must be a positive integer' },
        { status: 400 }
      );
    }
    params.limit = limit;
  }

  if (offsetParam !== null) {
    const offset = parseInt(offsetParam, 10);
    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'offset must be a non-negative integer' },
        { status: 400 }
      );
    }
    params.offset = offset;
  }

  const db = getDb();
  const sprites = await listSprites(
    db,
    Object.keys(params).length > 0 ? params : undefined
  );
  const signed = await withSignedUrls(sprites);
  return NextResponse.json(signed);
}
