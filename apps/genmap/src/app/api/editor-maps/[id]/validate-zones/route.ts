import { NextRequest, NextResponse } from 'next/server';
import { getDb, getZonesForMap } from '@nookstead/db';
import type { ZoneData } from '@nookstead/map-lib';
import { validateAllZones } from '@nookstead/map-lib';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const dbZones = await getZonesForMap(db, id);

    // Convert DB records to ZoneData for validation
    const zones: ZoneData[] = dbZones.map((z) => ({
      id: z.id,
      name: z.name,
      zoneType: z.zoneType as ZoneData['zoneType'],
      shape: z.shape as ZoneData['shape'],
      bounds: z.bounds as ZoneData['bounds'],
      vertices: z.vertices as ZoneData['vertices'],
      properties: (z.properties as Record<string, unknown>) ?? {},
      zIndex: z.zIndex ?? 0,
    }));

    const errors = validateAllZones(zones);
    return NextResponse.json({ errors });
  } catch (error) {
    console.error('Failed to validate zones:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
