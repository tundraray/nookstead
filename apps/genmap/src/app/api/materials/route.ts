import { NextRequest, NextResponse } from 'next/server';
import { getDb, createMaterial, listMaterials } from '@nookstead/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, key, color, walkable, speedModifier, swimRequired, damaging } =
      body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    if (!color || typeof color !== 'string' || color.trim() === '') {
      return NextResponse.json(
        { error: 'color is required' },
        { status: 400 }
      );
    }

    const materialKey =
      key ||
      name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

    const db = getDb();

    const material = await createMaterial(db, {
      name: name.trim(),
      key: materialKey,
      color: color.trim(),
      ...(walkable !== undefined && { walkable }),
      ...(speedModifier !== undefined && { speedModifier }),
      ...(swimRequired !== undefined && { swimRequired }),
      ...(damaging !== undefined && { damaging }),
    });

    console.log(`[MaterialAPI] Created material: ${material.name} (${material.key})`);
    return NextResponse.json(material, { status: 201 });
  } catch (err: unknown) {
    // Handle unique constraint violation (duplicate name or key)
    if (
      err instanceof Error &&
      err.message.includes('unique')
    ) {
      return NextResponse.json(
        { error: 'Material with this name or key already exists' },
        { status: 409 }
      );
    }
    console.error('[MaterialAPI] Failed to create material:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = getDb();
    const materials = await listMaterials(db);
    return NextResponse.json(materials);
  } catch (err) {
    console.error('[MaterialAPI] Failed to list materials:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
