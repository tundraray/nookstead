import { NextResponse } from 'next/server';
import { getDb, listPlayerMaps } from '@nookstead/db';

export async function GET() {
  try {
    const db = getDb();
    const playerMaps = await listPlayerMaps(db);
    return NextResponse.json(playerMaps);
  } catch (error) {
    console.error('Failed to list player maps:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
