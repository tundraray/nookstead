import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  createMapZone,
  getZonesForMap,
} from '@nookstead/db';
import type { ZoneType, ZoneShape } from '@nookstead/map-lib';

const VALID_ZONE_TYPES: ZoneType[] = [
  'crop_field', 'path', 'water_feature', 'decoration', 'spawn_point',
  'transition', 'npc_location', 'animal_pen', 'building_footprint',
  'transport_point', 'lighting',
];

const VALID_SHAPES: ZoneShape[] = ['rectangle', 'polygon'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const zones = await getZonesForMap(db, id);
    return NextResponse.json(zones);
  } catch (error) {
    console.error('Failed to get zones:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { name, zoneType, shape, bounds, vertices, zIndex, properties } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!VALID_ZONE_TYPES.includes(zoneType)) {
      return NextResponse.json({ error: `Invalid zoneType: ${zoneType}` }, { status: 400 });
    }
    if (!VALID_SHAPES.includes(shape)) {
      return NextResponse.json({ error: `Invalid shape: ${shape}` }, { status: 400 });
    }
    if (shape === 'rectangle' && (!bounds || typeof bounds.x !== 'number')) {
      return NextResponse.json({ error: 'Rectangle zones require bounds' }, { status: 400 });
    }
    if (shape === 'polygon' && (!Array.isArray(vertices) || vertices.length < 3)) {
      return NextResponse.json(
        { error: 'Polygon zones require at least 3 vertices' },
        { status: 400 }
      );
    }

    const db = getDb();
    const zone = await createMapZone(db, {
      mapId: id,
      name,
      zoneType,
      shape,
      bounds: bounds ?? undefined,
      vertices: vertices ?? undefined,
      properties: properties ?? {},
      zIndex: typeof zIndex === 'number' ? zIndex : 0,
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error('Failed to create zone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
