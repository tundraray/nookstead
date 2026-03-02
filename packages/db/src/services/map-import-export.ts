import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { maps } from '../schema/maps';
import type { MapRecord } from '../schema/maps';
import { users } from '../schema/users';
import { editorMaps } from '../schema/editor-maps';
import type { EditorMap } from '../schema/editor-maps';

/**
 * List all player maps with owner info.
 */
export async function listPlayerMaps(db: DrizzleClient) {
  return db
    .select({
      id: maps.id,
      name: maps.name,
      mapType: maps.mapType,
      userId: maps.userId,
      seed: maps.seed,
      updatedAt: maps.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(maps)
    .leftJoin(users, eq(maps.userId, users.id));
}

/**
 * Import a player map into the editor by mapId.
 */
export async function importPlayerMap(
  db: DrizzleClient,
  mapId: string
): Promise<EditorMap> {
  const map = await db
    .select()
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (!map[0]) {
    throw new Error(`Map not found: ${mapId}`);
  }

  const result = await db
    .insert(editorMaps)
    .values({
      name: map[0].name ?? 'Imported Map',
      mapType: 'homestead',
      seed: map[0].seed,
      width: map[0].width,
      height: map[0].height,
      grid: map[0].grid,
      layers: map[0].layers,
      walkable: map[0].walkable,
    })
    .returning();

  return result[0];
}

/**
 * Export an editor map to an existing player map by mapId.
 * Pure UPDATE — throws if target map not found.
 * Use createMap first if the map doesn't exist yet.
 */
export async function exportToPlayerMap(
  db: DrizzleClient,
  editorMapId: string,
  mapId: string
): Promise<void> {
  // Verify editor map exists
  const editorMap = await db
    .select()
    .from(editorMaps)
    .where(eq(editorMaps.id, editorMapId))
    .limit(1);

  if (!editorMap[0]) {
    throw new Error(`Editor map not found: ${editorMapId}`);
  }

  // Verify target map exists
  const targetMap = await db
    .select({ id: maps.id })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (!targetMap[0]) {
    throw new Error(`Target map not found: ${mapId}`);
  }

  // Pure UPDATE — only overwrite grid data, never map_type or user_id
  await db
    .update(maps)
    .set({
      seed: editorMap[0].seed,
      width: editorMap[0].width,
      height: editorMap[0].height,
      grid: editorMap[0].grid,
      layers: editorMap[0].layers,
      walkable: editorMap[0].walkable,
      updatedAt: new Date(),
    })
    .where(eq(maps.id, mapId));
}

/**
 * Load a player map for direct editing by mapId.
 */
export async function editPlayerMapDirect(
  db: DrizzleClient,
  mapId: string
): Promise<MapRecord | null> {
  const result = await db
    .select()
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Data required to save a player map directly.
 */
export interface SavePlayerMapDirectData {
  mapId: string;
  seed?: number;
  width: number;
  height: number;
  grid: unknown;
  layers: unknown;
  walkable: unknown;
}

/**
 * Save player map data directly by mapId. Throws if map not found.
 */
export async function savePlayerMapDirect(
  db: DrizzleClient,
  data: SavePlayerMapDirectData
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
