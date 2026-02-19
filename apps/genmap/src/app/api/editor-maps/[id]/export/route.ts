import { NextRequest, NextResponse } from 'next/server';
import { getDb, exportToPlayerMap } from '@nookstead/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId } = body as { userId?: string };

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    await exportToPlayerMap(db, id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    console.error('Failed to export map:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
