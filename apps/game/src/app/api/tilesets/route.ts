import { NextResponse } from 'next/server';
import { getDb, listTilesets } from '@nookstead/db';
import { generatePresignedGetUrl } from '@/lib/s3';

export async function GET() {
  try {
    const db = getDb();
    const tilesets = await listTilesets(db);

    const metadata = await Promise.all(
      tilesets.map(async (t) => ({
        key: t.key,
        name: t.name,
        s3Url: await generatePresignedGetUrl(t.s3Key),
      }))
    );

    return NextResponse.json(metadata);
  } catch (err) {
    console.error('[TilesetsAPI] Failed to list tilesets:', err);
    return NextResponse.json(
      { error: 'Failed to load tilesets' },
      { status: 500 }
    );
  }
}
