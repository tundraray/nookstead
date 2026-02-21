import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  countFramesBySprite,
  findGameObjectsReferencingSprite,
} from '@nookstead/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const [frameCount, affectedObjects] = await Promise.all([
    countFramesBySprite(db, id),
    findGameObjectsReferencingSprite(db, id),
  ]);

  return NextResponse.json({ frameCount, affectedObjects });
}
