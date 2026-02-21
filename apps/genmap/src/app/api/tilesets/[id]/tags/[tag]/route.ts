import { NextRequest, NextResponse } from 'next/server';
import { getDb, getTileset, removeTag } from '@nookstead/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tag: string }> }
) {
  const { id, tag } = await params;
  try {
    const db = getDb();

    // Check tileset exists
    const tileset = await getTileset(db, id);
    if (!tileset) {
      return NextResponse.json(
        { error: 'Tileset not found' },
        { status: 404 }
      );
    }

    await removeTag(db, id, decodeURIComponent(tag));

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[TilesetAPI] Failed to remove tag:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
