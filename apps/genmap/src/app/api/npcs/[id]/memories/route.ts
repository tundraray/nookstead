import { NextRequest, NextResponse } from 'next/server';
import { getDb, listMemoriesAdmin, deleteMemory } from '@nookstead/db';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const db = getDb();
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const memories = await listMemoriesAdmin(db, id, { limit, offset });
    return NextResponse.json(
      memories.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error('[memories] GET failed:', err);
    return NextResponse.json(
      { error: 'Failed to load memories' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await params;
    const db = getDb();
    const body: { memoryId: string } = await req.json();
    await deleteMemory(db, body.memoryId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[memories] DELETE failed:', err);
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
