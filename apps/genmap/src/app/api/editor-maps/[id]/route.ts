import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getEditorMap,
  updateEditorMap,
  deleteEditorMap,
} from '@nookstead/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const map = await getEditorMap(db, id);

    if (!map) {
      return NextResponse.json(
        { error: 'Map not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(map);
  } catch (error) {
    console.error('Failed to get editor map:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();
    const updated = await updateEditorMap(db, id, body);

    if (!updated) {
      return NextResponse.json(
        { error: 'Map not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update editor map:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    await deleteEditorMap(db, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete editor map:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
