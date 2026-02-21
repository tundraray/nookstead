import { NextResponse } from 'next/server';
import { getDb, listDistinctTags } from '@nookstead/db';

export async function GET() {
  try {
    const db = getDb();
    const tags = await listDistinctTags(db);
    return NextResponse.json(tags);
  } catch (err) {
    console.error('[TilesetAPI] Failed to list distinct tags:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
