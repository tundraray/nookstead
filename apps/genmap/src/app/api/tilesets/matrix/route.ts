import { NextResponse } from 'next/server';
import { getDb, getTransitionMatrix } from '@nookstead/db';

export async function GET() {
  try {
    console.log('[TilesetAPI] getTransitionMatrix called');
    const db = getDb();
    const result = await getTransitionMatrix(db);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[TilesetAPI] Failed to get transition matrix:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
