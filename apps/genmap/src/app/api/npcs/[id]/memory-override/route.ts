import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getNpcOverride,
  upsertNpcOverride,
  deleteNpcOverride,
} from '@nookstead/db';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const db = getDb();
    const override = await getNpcOverride(db, id);
    return NextResponse.json(override);
  } catch (err) {
    console.error('[memory-override] GET failed:', err);
    return NextResponse.json(
      { error: 'Failed to load override' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await req.json();
    const override = await upsertNpcOverride(db, id, body);
    return NextResponse.json({
      ...override,
      updatedAt: override.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error('[memory-override] PUT failed:', err);
    return NextResponse.json(
      { error: 'Failed to save override' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const db = getDb();
    await deleteNpcOverride(db, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[memory-override] DELETE failed:', err);
    return NextResponse.json(
      { error: 'Failed to delete override' },
      { status: 500 }
    );
  }
}
