import { NextRequest, NextResponse } from 'next/server';
import { getDb, getTileset, getTilesetUsage } from '@nookstead/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const db = getDb();
    const tileset = await getTileset(db, id);

    if (!tileset) {
      return NextResponse.json(
        { error: 'Tileset not found' },
        { status: 404 }
      );
    }

    const usage = await getTilesetUsage(db, tileset.key);
    return NextResponse.json(usage);
  } catch (err) {
    console.error('[TilesetAPI] Failed to get tileset usage:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
