import { NextResponse } from 'next/server';
import { getDb, listMaterials } from '@nookstead/db';

export async function GET() {
  try {
    const db = getDb();
    const materials = await listMaterials(db);

    const result = materials.map((m) => ({
      key: m.key,
      name: m.name,
      walkable: m.walkable,
      speedModifier: m.speedModifier,
      swimRequired: m.swimRequired,
      damaging: m.damaging,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[MaterialsAPI] Failed to list materials:', err);
    return NextResponse.json(
      { error: 'Failed to load materials' },
      { status: 500 }
    );
  }
}
