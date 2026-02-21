import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getGameObject,
  updateGameObject,
  deleteGameObject,
  validateFrameReferences,
} from '@nookstead/db';
import { isGameObjectCategory, isGameObjectType } from '@nookstead/shared';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const obj = await getGameObject(db, id);

  if (!obj) {
    return NextResponse.json({ error: 'Object not found' }, { status: 404 });
  }

  return NextResponse.json(obj);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const obj = await getGameObject(db, id);

  if (!obj) {
    return NextResponse.json({ error: 'Object not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, description, category, objectType, layers, collisionZones, tags, metadata } = body;

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

  if (collisionZones !== undefined) {
    const zonesError = validateCollisionZones(collisionZones);
    if (zonesError) {
      return NextResponse.json({ error: zonesError }, { status: 400 });
    }
  }

  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category?.trim().toLowerCase() || null;
  if (objectType !== undefined) updates.objectType = objectType?.trim().toLowerCase() || null;
  if (collisionZones !== undefined) updates.collisionZones = collisionZones;
  if (tags !== undefined) updates.tags = tags;
  if (metadata !== undefined) updates.metadata = metadata;

  if (layers !== undefined) {
    if (!Array.isArray(layers)) {
      return NextResponse.json(
        { error: 'layers must be an array' },
        { status: 400 }
      );
    }
    if (layers.length > 0) {
      const invalidIds = await validateFrameReferences(db, layers);
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: 'Invalid frame references', invalidFrameIds: invalidIds },
          { status: 400 }
        );
      }
    }
    updates.layers = layers;
  }

  const updated = await updateGameObject(db, id, updates);

  if (updated?.category && !isGameObjectCategory(updated.category)) {
    console.warn('Non-standard game object category used', {
      category: updated.category,
      objectId: updated.id,
    });
  }
  if (
    updated?.objectType &&
    updated?.category &&
    isGameObjectCategory(updated.category) &&
    !isGameObjectType(updated.category, updated.objectType)
  ) {
    console.warn('Non-standard game object type used', {
      objectType: updated.objectType,
      category: updated.category,
      objectId: updated.id,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const obj = await getGameObject(db, id);

  if (!obj) {
    return NextResponse.json({ error: 'Object not found' }, { status: 404 });
  }

  await deleteGameObject(db, id);
  return new NextResponse(null, { status: 204 });
}
