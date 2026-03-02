import { NextRequest, NextResponse } from 'next/server';
import { getDb, importPlayerMap } from '@nookstead/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapId } = body;

    if (!mapId || typeof mapId !== 'string') {
      return NextResponse.json(
        { error: 'mapId is required and must be a string' },
        { status: 400 }
      );
    }

    const db = getDb();
    const created = await importPlayerMap(db, mapId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    console.error('Failed to import player map:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
