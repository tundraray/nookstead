import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getMaterial,
  updateMaterial,
  deleteMaterial,
  getTilesetsReferencingMaterial,
} from '@nookstead/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const db = getDb();
    const material = await getMaterial(db, id);

    if (!material) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(material);
  } catch (err) {
    console.error('[MaterialAPI] Failed to get material:', err);
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
    const { name, key, color, walkable, speedModifier, swimRequired, damaging } =
      body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (key !== undefined) updateData.key = key;
    if (color !== undefined) updateData.color = color;
    if (walkable !== undefined) updateData.walkable = walkable;
    if (speedModifier !== undefined) updateData.speedModifier = speedModifier;
    if (swimRequired !== undefined) updateData.swimRequired = swimRequired;
    if (damaging !== undefined) updateData.damaging = damaging;

    const db = getDb();
    const updated = await updateMaterial(db, id, updateData);

    if (!updated) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Material with this name or key already exists' },
        { status: 409 }
      );
    }
    console.error('[MaterialAPI] Failed to update material:', err);
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

    const material = await getMaterial(db, id);
    if (!material) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    // Get affected tilesets before deletion (FKs will be set to null by cascade)
    const affectedTilesets = await getTilesetsReferencingMaterial(db, id);

    await deleteMaterial(db, id);

    console.log(
      `[MaterialAPI] Deleted material: ${material.name} (${material.key}), affected ${affectedTilesets.length} tilesets`
    );

    return NextResponse.json({
      deleted: material,
      affectedTilesets,
    });
  } catch (err) {
    console.error('[MaterialAPI] Failed to delete material:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
