import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getSprite,
  deleteSprite,
} from '@nookstead/db';
import { deleteS3Object } from '@/lib/s3';
import { withSignedUrl } from '@/lib/sprite-url';

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

  const signed = await withSignedUrl(sprite);
  return NextResponse.json(signed);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const sprite = await getSprite(db, id);

  if (!sprite) {
    return NextResponse.json({ error: 'Sprite not found' }, { status: 404 });
  }

  try {
    await deleteS3Object(sprite.s3Key);
  } catch (err) {
    console.error('Failed to delete S3 object:', sprite.s3Key, err);
  }

  await deleteSprite(db, id);

  return new NextResponse(null, { status: 204 });
}
