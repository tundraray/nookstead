import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getTileset,
  updateTileset,
  deleteTileset,
  setInverseTileset,
  removeInverseTileset,
  getTilesetUsage,
  getTags,
  setTags,
} from '@nookstead/db';
import { deleteS3Object } from '@nookstead/s3';
import { withSignedUrl } from '@/lib/signed-url';

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

    const tags = await getTags(db, id);
    const signed = await withSignedUrl(tileset);

    return NextResponse.json({ ...signed, tags });
  } catch (err) {
    console.error('[TilesetAPI] Failed to get tileset:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, fromMaterialId, toMaterialId, inverseTilesetId, tags } = body;

    const db = getDb();

    // Check tileset exists
    const existing = await getTileset(db, id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Tileset not found' },
        { status: 404 }
      );
    }

    // Validate same from/to material (only when both are in the request body)
    if (
      fromMaterialId !== undefined &&
      toMaterialId !== undefined &&
      fromMaterialId !== null &&
      toMaterialId !== null &&
      fromMaterialId === toMaterialId
    ) {
      return NextResponse.json(
        { error: 'From and To materials must be different' },
        { status: 400 }
      );
    }

    // Validate self-inverse
    if (inverseTilesetId !== undefined && inverseTilesetId === id) {
      return NextResponse.json(
        { error: 'A tileset cannot be its own inverse' },
        { status: 400 }
      );
    }

    // Handle inverse tileset link
    if (inverseTilesetId !== undefined) {
      if (inverseTilesetId === null) {
        await removeInverseTileset(db, id);
        console.log(`[TilesetAPI] Removed inverse link for tileset ${id}`);
      } else {
        await setInverseTileset(db, id, inverseTilesetId);
        console.log(
          `[TilesetAPI] Setting inverse: ${id} <-> ${inverseTilesetId}`
        );
      }
    }

    // Handle tags
    if (tags !== undefined && Array.isArray(tags)) {
      await setTags(db, id, tags);
    }

    // Handle other fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (fromMaterialId !== undefined) updateData.fromMaterialId = fromMaterialId;
    if (toMaterialId !== undefined) updateData.toMaterialId = toMaterialId;

    if (Object.keys(updateData).length > 0) {
      await updateTileset(db, id, updateData);
    }

    // Return the fresh tileset with tags
    const freshTileset = await getTileset(db, id);
    if (!freshTileset) {
      return NextResponse.json({ error: 'Tileset not found after update' }, { status: 404 });
    }
    const freshTags = await getTags(db, id);
    const signed = await withSignedUrl(freshTileset);

    return NextResponse.json({ ...signed, tags: freshTags });
  } catch (err) {
    console.error('[TilesetAPI] Failed to update tileset:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Check usage in maps
    const usage = await getTilesetUsage(db, tileset.key);

    // Clear inverse link (bidirectional)
    await removeInverseTileset(db, id);

    // Delete S3 object (best-effort)
    try {
      await deleteS3Object(tileset.s3Key);
    } catch (err) {
      console.error(
        `[TilesetAPI] Failed to delete S3 object: ${tileset.s3Key}`,
        err
      );
    }

    // Delete DB record (cascade deletes tags automatically)
    await deleteTileset(db, id);

    console.log(`[TilesetAPI] Deleted tileset: ${tileset.name} (${tileset.key})`);

    return NextResponse.json({ deleted: tileset, usage });
  } catch (err) {
    console.error('[TilesetAPI] Failed to delete tileset:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
