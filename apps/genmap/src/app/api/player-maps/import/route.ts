import { NextRequest, NextResponse } from 'next/server';
import { getDb, importPlayerMap } from '@nookstead/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required and must be a string' },
        { status: 400 }
      );
    }

    const db = getDb();
    const created = await importPlayerMap(db, userId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('No map found') ? 404 : 500;
    console.error('Failed to import player map:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
