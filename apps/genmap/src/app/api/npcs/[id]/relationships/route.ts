import { NextRequest, NextResponse } from 'next/server';
import { getDb, listRelationshipsForBot } from '@nookstead/db';

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
    const relationships = await listRelationshipsForBot(db, id, {
      limit,
      offset,
    });
    return NextResponse.json(
      relationships.map((r) => ({
        ...r,
        hiredAt: r.hiredAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error('[relationships] GET failed:', err);
    return NextResponse.json(
      { error: 'Failed to load relationships' },
      { status: 500 }
    );
  }
}
