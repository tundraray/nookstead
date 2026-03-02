import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { maps } from '../schema/maps';

/** Valid map types. */
export type MapType = 'homestead' | 'city' | 'open_world';

/** Data required to create a new map. */
export interface CreateMapData {
  name?: string;
  mapType: MapType;
  userId?: string | null;
  seed?: number | null;
  width: number;
  height: number;
  grid: unknown;
  layers: unknown;
  walkable: unknown;
  metadata?: unknown;
}

/** Data required to save (update) an existing map by mapId. */
export interface SaveMapData {
  mapId: string;
  seed?: number | null;
  width: number;
  height: number;
  grid: unknown;
  layers: unknown;
  walkable: unknown;
}

/** Result of loading a map. */
export interface LoadMapResult {
  id: string;
  name: string | null;
  mapType: string;
  userId: string | null;
  seed: number | null;
  width: number;
  height: number;
  grid: unknown;
  layers: unknown;
  walkable: unknown;
  metadata: unknown;
}

/**
 * Create a new map. Returns the created record with generated UUID.
 */
export async function createMap(
  db: DrizzleClient,
  data: CreateMapData
): Promise<LoadMapResult> {
  const [created] = await db
    .insert(maps)
    .values({
      name: data.name ?? 'Untitled',
      mapType: data.mapType,
      userId: data.userId ?? null,
      seed: data.seed ?? null,
      width: data.width,
      height: data.height,
      grid: data.grid,
      layers: data.layers,
      walkable: data.walkable,
      metadata: data.metadata ?? null,
    })
    .returning({
      id: maps.id,
      name: maps.name,
      mapType: maps.mapType,
      userId: maps.userId,
      seed: maps.seed,
      width: maps.width,
      height: maps.height,
      grid: maps.grid,
      layers: maps.layers,
      walkable: maps.walkable,
      metadata: maps.metadata,
    });

  return created as LoadMapResult;
}

/**
 * Save (update) an existing map by mapId. Throws if map not found.
 * Map id, map_type, and user_id are never modified by saveMap.
 */
export async function saveMap(
  db: DrizzleClient,
  data: SaveMapData
): Promise<void> {
  const result = await db
    .update(maps)
    .set({
      seed: data.seed,
      width: data.width,
      height: data.height,
      grid: data.grid,
      layers: data.layers,
      walkable: data.walkable,
      updatedAt: new Date(),
    })
    .where(eq(maps.id, data.mapId))
    .returning({ id: maps.id });

  if (result.length === 0) {
    throw new Error(`Map not found: ${data.mapId}`);
  }
}

/**
 * Load a map by id. Returns null if not found.
 */
export async function loadMap(
  db: DrizzleClient,
  mapId: string
): Promise<LoadMapResult | null> {
  const result = await db
    .select({
      id: maps.id,
      name: maps.name,
      mapType: maps.mapType,
      userId: maps.userId,
      seed: maps.seed,
      width: maps.width,
      height: maps.height,
      grid: maps.grid,
      layers: maps.layers,
      walkable: maps.walkable,
      metadata: maps.metadata,
    })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  return result.length > 0 ? (result[0] as LoadMapResult) : null;
}

/**
 * Find a single map by user id and type. Returns null if not found.
 * Useful for looking up a user's homestead.
 */
export async function findMapByUser(
  db: DrizzleClient,
  userId: string,
  mapType: MapType
): Promise<LoadMapResult | null> {
  const result = await db
    .select({
      id: maps.id,
      name: maps.name,
      mapType: maps.mapType,
      userId: maps.userId,
      seed: maps.seed,
      width: maps.width,
      height: maps.height,
      grid: maps.grid,
      layers: maps.layers,
      walkable: maps.walkable,
      metadata: maps.metadata,
    })
    .from(maps)
    .where(and(eq(maps.userId, userId), eq(maps.mapType, mapType)))
    .limit(1);

  return result.length > 0 ? (result[0] as LoadMapResult) : null;
}

/**
 * List all maps owned by a user.
 */
export async function listMapsByUser(
  db: DrizzleClient,
  userId: string
): Promise<LoadMapResult[]> {
  const result = await db
    .select({
      id: maps.id,
      name: maps.name,
      mapType: maps.mapType,
      userId: maps.userId,
      seed: maps.seed,
      width: maps.width,
      height: maps.height,
      grid: maps.grid,
      layers: maps.layers,
      walkable: maps.walkable,
      metadata: maps.metadata,
    })
    .from(maps)
    .where(eq(maps.userId, userId));

  return result as LoadMapResult[];
}

/**
 * Find a map by type (and optional name). Returns null if not found.
 * Useful for resolving well-known aliases like city:capital.
 */
export async function findMapByType(
  db: DrizzleClient,
  mapType: MapType,
  name?: string
): Promise<LoadMapResult | null> {
  const conditions = [eq(maps.mapType, mapType)];
  if (name) {
    conditions.push(eq(maps.name, name));
  }

  const result = await db
    .select({
      id: maps.id,
      name: maps.name,
      mapType: maps.mapType,
      userId: maps.userId,
      seed: maps.seed,
      width: maps.width,
      height: maps.height,
      grid: maps.grid,
      layers: maps.layers,
      walkable: maps.walkable,
      metadata: maps.metadata,
    })
    .from(maps)
    .where(and(...conditions))
    .limit(1);

  return result.length > 0 ? (result[0] as LoadMapResult) : null;
}

/**
 * List maps by user and type.
 */
export async function listMapsByUserAndType(
  db: DrizzleClient,
  userId: string,
  mapType: MapType
): Promise<LoadMapResult[]> {
  const result = await db
    .select({
      id: maps.id,
      name: maps.name,
      mapType: maps.mapType,
      userId: maps.userId,
      seed: maps.seed,
      width: maps.width,
      height: maps.height,
      grid: maps.grid,
      layers: maps.layers,
      walkable: maps.walkable,
      metadata: maps.metadata,
    })
    .from(maps)
    .where(and(eq(maps.userId, userId), eq(maps.mapType, mapType)));

  return result as LoadMapResult[];
}
