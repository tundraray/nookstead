import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSprite, getFramesBySprite } from '@nookstead/db';
import { withSignedUrl } from '@/lib/signed-url';

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

  const signedSprite = await withSignedUrl(sprite);
  const frames = await getFramesBySprite(db, id);

  const atlasJson = {
    frames: frames.map((f) => ({
      filename: f.filename,
      frame: { x: f.frameX, y: f.frameY, w: f.frameW, h: f.frameH },
      rotated: f.rotated,
      trimmed: f.trimmed,
      spriteSourceSize: {
        x: f.spriteSourceSizeX,
        y: f.spriteSourceSizeY,
        w: f.spriteSourceSizeW,
        h: f.spriteSourceSizeH,
      },
      sourceSize: { w: f.sourceSizeW, h: f.sourceSizeH },
      pivot: { x: f.pivotX, y: f.pivotY },
      ...(f.customData ? { customData: f.customData } : {}),
    })),
    meta: {
      app: 'nookstead-genmap',
      version: '1.0',
      image: signedSprite.s3Url,
      format: 'RGBA8888',
      size: { w: sprite.width, h: sprite.height },
      scale: '1',
    },
  };

  return NextResponse.json(atlasJson);
}
