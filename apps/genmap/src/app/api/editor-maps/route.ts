import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  listEditorMaps,
  createEditorMap,
} from '@nookstead/db';

const VALID_MAP_TYPES = ['homestead', 'city', 'open_world', 'template'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mapTypeParam = searchParams.get('mapType');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const params: { mapType?: string; limit?: number; offset?: number } = {};

  if (mapTypeParam !== null) {
    if (!VALID_MAP_TYPES.includes(mapTypeParam)) {
      return NextResponse.json(
        {
          error: `mapType must be one of: ${VALID_MAP_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }
    params.mapType = mapTypeParam;
  }

  if (limitParam !== null) {
    const limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'limit must be a positive integer' },
        { status: 400 }
      );
    }
    params.limit = limit;
  }

  if (offsetParam !== null) {
    const offset = parseInt(offsetParam, 10);
    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'offset must be a non-negative integer' },
        { status: 400 }
      );
    }
    params.offset = offset;
  }

  const db = getDb();
  const maps = await listEditorMaps(
    db,
    Object.keys(params).length > 0 ? params : undefined
  );
  return NextResponse.json(maps);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, mapType, width, height, grid, layers, walkable, seed } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    if (!mapType || !VALID_MAP_TYPES.includes(mapType)) {
      return NextResponse.json(
        {
          error: `mapType is required and must be one of: ${VALID_MAP_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (width === undefined || typeof width !== 'number' || !Number.isInteger(width) || width < 1) {
      return NextResponse.json(
        { error: 'width is required and must be a positive integer' },
        { status: 400 }
      );
    }

    if (height === undefined || typeof height !== 'number' || !Number.isInteger(height) || height < 1) {
      return NextResponse.json(
        { error: 'height is required and must be a positive integer' },
        { status: 400 }
      );
    }

    if (!Array.isArray(grid)) {
      return NextResponse.json(
        { error: 'grid is required and must be an array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(layers)) {
      return NextResponse.json(
        { error: 'layers is required and must be an array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(walkable)) {
      return NextResponse.json(
        { error: 'walkable is required and must be an array' },
        { status: 400 }
      );
    }

    const db = getDb();
    const created = await createEditorMap(db, {
      name: name.trim(),
      mapType,
      width,
      height,
      grid,
      layers,
      walkable,
      ...(seed !== undefined ? { seed } : {}),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Failed to create editor map:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
