import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  listGameObjects,
  createGameObject,
  validateFrameReferences,
} from '@nookstead/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const params: { limit?: number; offset?: number } = {};

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
  const objects = await listGameObjects(
    db,
    Object.keys(params).length > 0 ? params : undefined
  );
  return NextResponse.json(objects);
}

const VALID_ZONE_TYPES = ['collision', 'walkable'];

function validateCollisionZones(
  zones: unknown
): string | null {
  if (zones === null || zones === undefined) return null;
  if (!Array.isArray(zones)) return 'collisionZones must be an array';
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (!z || typeof z !== 'object') return `collisionZones[${i}] must be an object`;
    if (typeof z.label !== 'string') return `collisionZones[${i}].label must be a string`;
    if (!VALID_ZONE_TYPES.includes(z.type)) return `collisionZones[${i}].type must be "collision" or "walkable"`;
    if (z.shape !== 'rectangle') return `collisionZones[${i}].shape must be "rectangle"`;
    if (typeof z.x !== 'number') return `collisionZones[${i}].x must be a number`;
    if (typeof z.y !== 'number') return `collisionZones[${i}].y must be a number`;
    if (typeof z.width !== 'number' || z.width <= 0) return `collisionZones[${i}].width must be a positive number`;
    if (typeof z.height !== 'number' || z.height <= 0) return `collisionZones[${i}].height must be a positive number`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, category, objectType, layers, collisionZones, tags, metadata } = body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!Array.isArray(layers)) {
    return NextResponse.json(
      { error: 'layers must be an array' },
      { status: 400 }
    );
  }

  const zonesError = validateCollisionZones(collisionZones);
  if (zonesError) {
    return NextResponse.json({ error: zonesError }, { status: 400 });
  }

  const db = getDb();

  if (layers.length > 0) {
    const invalidIds = await validateFrameReferences(db, layers);
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'Invalid frame references', invalidFrameIds: invalidIds },
        { status: 400 }
      );
    }
  }

  const obj = await createGameObject(db, {
    name: name.trim(),
    description: description ?? null,
    category: category ?? null,
    objectType: objectType ?? null,
    layers,
    collisionZones: collisionZones ?? [],
    tags: tags ?? null,
    metadata: metadata ?? null,
  });

  return NextResponse.json(obj, { status: 201 });
}
