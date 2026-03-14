import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getFenceType,
  updateFenceType,
  deleteFenceType,
} from '@nookstead/db';
import { resolveFrameMapping } from '../resolve-frames';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid UUID format' },
      { status: 400 }
    );
  }

  const db = getDb();
  const fenceType = await getFenceType(db, id);

  if (!fenceType) {
    return NextResponse.json(
      { error: 'Fence type not found' },
      { status: 404 }
    );
  }

  const frameMapping = await resolveFrameMapping(
    db,
    fenceType.frameMapping as Record<string, string>
  );

  const gateFrameMapping = fenceType.gateFrameMapping
    ? await resolveFrameMapping(
        db,
        fenceType.gateFrameMapping as Record<string, string>
      )
    : null;

  return NextResponse.json({
    ...fenceType,
    frameMapping,
    gateFrameMapping,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, key, category, frameMapping, gateFrameMapping, sortOrder } =
    body;

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'name cannot be empty' },
        { status: 400 }
      );
    }
    updates.name = name.trim();
  }

  if (key !== undefined) {
    if (typeof key !== 'string' || key.trim() === '') {
      return NextResponse.json(
        { error: 'key cannot be empty' },
        { status: 400 }
      );
    }
    updates.key = key.trim();
  }

  if (category !== undefined) updates.category = category;
  if (frameMapping !== undefined) updates.frameMapping = frameMapping;
  if (gateFrameMapping !== undefined)
    updates.gateFrameMapping = gateFrameMapping;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  const db = getDb();

  try {
    const updated = await updateFenceType(db, id, updates);

    if (!updated) {
      return NextResponse.json(
        { error: 'Fence type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.includes('unique')) {
        return NextResponse.json(
          { error: 'key already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  await deleteFenceType(db, id);
  return new NextResponse(null, { status: 204 });
}
