import { NextRequest, NextResponse } from 'next/server';
import { getDb, getTileset, addTag } from '@nookstead/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { tag } = body;

    // Validate tag
    if (!tag || typeof tag !== 'string' || tag.trim() === '') {
      return NextResponse.json(
        { error: 'tag is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (tag.length > 50) {
      return NextResponse.json(
        { error: 'tag must be 50 characters or fewer' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check tileset exists
    const tileset = await getTileset(db, id);
    if (!tileset) {
      return NextResponse.json(
        { error: 'Tileset not found' },
        { status: 404 }
      );
    }

    const inserted = await addTag(db, id, tag.trim());

    if (inserted) {
      // Tag was newly added
      return NextResponse.json({ tag: inserted.tag }, { status: 201 });
    }

    // Tag already existed (idempotent, no error)
    return NextResponse.json({ tag: tag.trim() });
  } catch (err) {
    console.error('[TilesetAPI] Failed to add tag:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
