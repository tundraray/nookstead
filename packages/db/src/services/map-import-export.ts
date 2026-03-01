import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { maps } from '../schema/maps';
import { users } from '../schema/users';
import { editorMaps } from '../schema/editor-maps';
import type { EditorMap } from '../schema/editor-maps';

export async function listPlayerMaps(
  db: DrizzleClient
): Promise<
  Array<{
    userId: string;
    seed: number;
    updatedAt: Date;
    userName: string | null;
    userEmail: string;
  }>
> {
  const rows = await db
    .select({
      userId: maps.userId,
      seed: maps.seed,
      updatedAt: maps.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(maps)
    .innerJoin(users, eq(maps.userId, users.id));

  return rows;
}

export async function importPlayerMap(
  db: DrizzleClient,
  userId: string
): Promise<EditorMap> {
  const [playerMap] = await db
    .select()
    .from(maps)
    .where(eq(maps.userId, userId));

  if (!playerMap) {
    throw new Error(`No map found for user: ${userId}`);
  }

  const [created] = await db
    .insert(editorMaps)
    .values({
      name: `Imported: ${userId}`,
      mapType: 'player_homestead',
      width: playerMap.width,
      height: playerMap.height,
      seed: playerMap.seed,
      grid: playerMap.grid,
      layers: playerMap.layers,
      walkable: playerMap.walkable,
      metadata: {
        importedFrom: userId,
        importedAt: new Date().toISOString(),
        originalSeed: playerMap.seed,
      },
    })
    .returning();

  return created;
}

export async function exportToPlayerMap(
  db: DrizzleClient,
  editorMapId: string,
  userId: string
): Promise<void> {
  const [editorMap] = await db
    .select()
    .from(editorMaps)
    .where(eq(editorMaps.id, editorMapId));

  if (!editorMap) {
    throw new Error(`Editor map not found: ${editorMapId}`);
  }

  await db
    .insert(maps)
    .values({
      userId,
      seed: editorMap.seed ?? 0,
      width: editorMap.width,
      height: editorMap.height,
      grid: editorMap.grid,
      layers: editorMap.layers,
      walkable: editorMap.walkable,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: maps.userId,
      set: {
        seed: editorMap.seed ?? 0,
        width: editorMap.width,
        height: editorMap.height,
        grid: editorMap.grid,
        layers: editorMap.layers,
        walkable: editorMap.walkable,
        updatedAt: new Date(),
      },
    });
}

export async function editPlayerMapDirect(
  db: DrizzleClient,
  userId: string
): Promise<{
  userId: string;
  grid: unknown;
  layers: unknown;
  walkable: unknown;
  seed: number;
  width: number;
  height: number;
}> {
  const [playerMap] = await db
    .select()
    .from(maps)
    .where(eq(maps.userId, userId));

  if (!playerMap) {
    throw new Error(`No map found for user: ${userId}`);
  }

  return {
    userId: playerMap.userId,
    grid: playerMap.grid,
    layers: playerMap.layers,
    walkable: playerMap.walkable,
    seed: playerMap.seed,
    width: playerMap.width,
    height: playerMap.height,
  };
}

export async function savePlayerMapDirect(
  db: DrizzleClient,
  data: {
    userId: string;
    grid: unknown;
    layers: unknown;
    walkable: unknown;
    seed?: number;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    grid: data.grid,
    layers: data.layers,
    walkable: data.walkable,
    updatedAt: new Date(),
  };

  if (data.seed !== undefined) {
    updateData.seed = data.seed;
  }

  await db
    .update(maps)
    .set(updateData)
    .where(eq(maps.userId, data.userId));
}
