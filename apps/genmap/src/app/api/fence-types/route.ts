import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  listFenceTypes,
  createFenceType,
} from '@nookstead/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? undefined;

  const db = getDb();
  const fenceTypes = await listFenceTypes(db, { category });
  return NextResponse.json(fenceTypes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, key, category, frameMapping, gateFrameMapping, sortOrder } =
    body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 }
    );
  }

  if (!key || typeof key !== 'string' || key.trim() === '') {
    return NextResponse.json(
      { error: 'key is required' },
      { status: 400 }
    );
  }

  if (!frameMapping || typeof frameMapping !== 'object') {
    return NextResponse.json(
      { error: 'frameMapping is required and must be an object' },
      { status: 400 }
    );
  }

  const db = getDb();

  try {
    const fenceType = await createFenceType(db, {
      name: name.trim(),
      key: key.trim(),
      category: category ?? null,
      frameMapping,
      gateFrameMapping: gateFrameMapping ?? null,
      ...(sortOrder !== undefined && { sortOrder }),
    });

    return NextResponse.json(fenceType, { status: 201 });
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
