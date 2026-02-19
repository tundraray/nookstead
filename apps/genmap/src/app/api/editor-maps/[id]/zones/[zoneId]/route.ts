import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  updateMapZone,
  deleteMapZone,
} from '@nookstead/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const db = getDb();
    const updated = await updateMapZone(db, zoneId, body);

    if (!updated) {
      return NextResponse.json(
        { error: 'Zone not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update zone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const db = getDb();
    await deleteMapZone(db, zoneId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete zone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
