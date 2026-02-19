import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getSprite,
  getFramesBySprite,
  batchSaveFrames,
  deleteFramesBySprite,
} from '@nookstead/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const sprite = await getSprite(db, id);

  if (!sprite) {
    return NextResponse.json({ error: 'Sprite not found' }, { status: 404 });
  }

  const frames = await getFramesBySprite(db, id);
  return NextResponse.json(frames);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const sprite = await getSprite(db, id);

  if (!sprite) {
    return NextResponse.json({ error: 'Sprite not found' }, { status: 404 });
  }

  const body = await request.json();
  const { frames } = body;

  if (!Array.isArray(frames)) {
    return NextResponse.json(
      { error: 'frames must be an array' },
      { status: 400 }
    );
  }

  // Empty array clears all frames
  if (frames.length === 0) {
    await deleteFramesBySprite(db, id);
    return NextResponse.json([]);
  }

  // Validate filename uniqueness
  const filenames = frames.map(
    (f: { filename: string }) => f.filename
  );
  if (new Set(filenames).size !== filenames.length) {
    return NextResponse.json(
      { error: 'Frame filenames must be unique within a sprite' },
      { status: 400 }
    );
  }

  // Validate each frame
  for (const frame of frames) {
    if (
      !frame.filename ||
      typeof frame.filename !== 'string' ||
      frame.filename.trim() === ''
    ) {
      return NextResponse.json(
        { error: 'Each frame must have a non-empty filename' },
        { status: 400 }
      );
    }

    if (
      frame.frameX + frame.frameW > sprite.width ||
      frame.frameY + frame.frameH > sprite.height
    ) {
      return NextResponse.json(
        {
          error: `Frame "${frame.filename}" extends beyond sprite dimensions`,
        },
        { status: 400 }
      );
    }

    if (
      frame.pivotX !== undefined &&
      (frame.pivotX < 0 || frame.pivotX > 1)
    ) {
      return NextResponse.json(
        {
          error: `Frame "${frame.filename}" pivotX must be between 0 and 1`,
        },
        { status: 400 }
      );
    }

    if (
      frame.pivotY !== undefined &&
      (frame.pivotY < 0 || frame.pivotY > 1)
    ) {
      return NextResponse.json(
        {
          error: `Frame "${frame.filename}" pivotY must be between 0 and 1`,
        },
        { status: 400 }
      );
    }
  }

  // Populate defaults for optional fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedFrames = frames.map((f: any) => ({
    filename: f.filename.trim(),
    frameX: f.frameX,
    frameY: f.frameY,
    frameW: f.frameW,
    frameH: f.frameH,
    rotated: f.rotated ?? false,
    trimmed: f.trimmed ?? false,
    spriteSourceSizeX: f.spriteSourceSizeX ?? 0,
    spriteSourceSizeY: f.spriteSourceSizeY ?? 0,
    spriteSourceSizeW: f.spriteSourceSizeW ?? f.frameW,
    spriteSourceSizeH: f.spriteSourceSizeH ?? f.frameH,
    sourceSizeW: f.sourceSizeW ?? f.frameW,
    sourceSizeH: f.sourceSizeH ?? f.frameH,
    pivotX: f.pivotX ?? 0.5,
    pivotY: f.pivotY ?? 0.5,
    customData: f.customData ?? null,
  }));

  const saved = await batchSaveFrames(db, id, normalizedFrames);
  return NextResponse.json(saved);
}
