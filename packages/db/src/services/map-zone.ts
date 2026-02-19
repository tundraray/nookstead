import { eq, asc } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { editorMaps } from '../schema/editor-maps';
import { mapZones } from '../schema/map-zones';
import type { MapZone } from '../schema/map-zones';

export interface CreateMapZoneData {
  mapId: string;
  name: string;
  zoneType: string;
  shape: string;
  bounds?: unknown;
  vertices?: unknown;
  properties?: unknown;
  zIndex?: number;
}

export interface UpdateMapZoneData {
  name?: string;
  zoneType?: string;
  shape?: string;
  bounds?: unknown;
  vertices?: unknown;
  properties?: unknown;
  zIndex?: number;
}

export async function createMapZone(
  db: DrizzleClient,
  data: CreateMapZoneData
): Promise<MapZone> {
  const [map] = await db
    .select()
    .from(editorMaps)
    .where(eq(editorMaps.id, data.mapId));

  if (!map) {
    throw new Error(`Editor map not found: ${data.mapId}`);
  }

  const [created] = await db
    .insert(mapZones)
    .values({
      mapId: data.mapId,
      name: data.name,
      zoneType: data.zoneType,
      shape: data.shape,
      bounds: data.bounds ?? null,
      vertices: data.vertices ?? null,
      properties: data.properties ?? null,
      zIndex: data.zIndex ?? 0,
    })
    .returning();
  return created;
}

export async function getZonesForMap(
  db: DrizzleClient,
  mapId: string
): Promise<MapZone[]> {
  return db
    .select()
    .from(mapZones)
    .where(eq(mapZones.mapId, mapId))
    .orderBy(asc(mapZones.zIndex));
}

export async function updateMapZone(
  db: DrizzleClient,
  id: string,
  data: UpdateMapZoneData
): Promise<MapZone | null> {
  const [updated] = await db
    .update(mapZones)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(mapZones.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteMapZone(
  db: DrizzleClient,
  id: string
): Promise<void> {
  await db.delete(mapZones).where(eq(mapZones.id, id));
}
