import { NextResponse } from 'next/server';
import { getDb, listMaterials, listTilesets } from '@nookstead/db';
import { generatePresignedGetUrl } from '@/lib/s3';

export async function GET() {
  try {
    const db = getDb();
    const [rawMaterials, rawTilesets] = await Promise.all([
      listMaterials(db),
      listTilesets(db),
    ]);

    const materials = rawMaterials.map((m) => ({
      key: m.key,
      walkable: m.walkable,
      speedModifier: m.speedModifier,
      swimRequired: m.swimRequired,
      damaging: m.damaging,
    }));

    const tilesets = await Promise.all(
      rawTilesets.map(async (t) => ({
        key: t.key,
        name: t.name,
        s3Url: await generatePresignedGetUrl(t.s3Key),
      }))
    );

    return NextResponse.json({ materials, tilesets });
  } catch (err) {
    console.error('[GameDataAPI] Failed to build game data:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
