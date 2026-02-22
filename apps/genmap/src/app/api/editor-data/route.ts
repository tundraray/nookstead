import { NextResponse } from 'next/server';
import { getDb, listMaterials, listTilesets } from '@nookstead/db';
import { buildMapEditorData } from '@nookstead/map-lib';
import { generatePresignedGetUrl } from '@/lib/s3';

export async function GET() {
  try {
    const db = getDb();
    const [rawMaterials, rawTilesets] = await Promise.all([
      listMaterials(db),
      listTilesets(db),
    ]);

    // Resolve DB UUIDs to material keys before passing to buildMapEditorData
    const idToKey = new Map<string, string>();
    for (const m of rawMaterials) {
      idToKey.set(m.id, m.key);
    }

    const resolvedTilesets = rawTilesets.map((ts) => ({
      key: ts.key,
      name: ts.name,
      fromMaterialKey: ts.fromMaterialId ? idToKey.get(ts.fromMaterialId) ?? null : null,
      toMaterialKey: ts.toMaterialId ? idToKey.get(ts.toMaterialId) ?? null : null,
    }));

    const { materials, tilesets } = buildMapEditorData(rawMaterials, resolvedTilesets);

    // Sign S3 URLs for each tileset
    const tilesetsWithUrls = await Promise.all(
      rawTilesets.map(async (raw, i) => ({
        ...tilesets[i],
        s3Url: await generatePresignedGetUrl(raw.s3Key),
      }))
    );

    return NextResponse.json({ materials, tilesets: tilesetsWithUrls });
  } catch (err) {
    console.error('[EditorDataAPI] Failed to build editor data:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
