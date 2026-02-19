import { eq, desc, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { gameObjects } from '../schema/game-objects';
import type { GameObjectLayer, CollisionZone } from '../schema/game-objects';
import { atlasFrames } from '../schema/atlas-frames';

export interface CreateGameObjectData {
  name: string;
  description?: string | null;
  category?: string | null;
  objectType?: string | null;
  layers: GameObjectLayer[];
  collisionZones?: CollisionZone[] | null;
  tags?: unknown | null;
  metadata?: unknown | null;
}

export interface UpdateGameObjectData {
  name?: string;
  description?: string | null;
  category?: string | null;
  objectType?: string | null;
  layers?: GameObjectLayer[];
  collisionZones?: CollisionZone[] | null;
  tags?: unknown | null;
  metadata?: unknown | null;
}

export async function createGameObject(
  db: DrizzleClient,
  data: CreateGameObjectData
) {
  const [obj] = await db.insert(gameObjects).values(data).returning();
  return obj;
}

export async function getGameObject(db: DrizzleClient, id: string) {
  const [obj] = await db
    .select()
    .from(gameObjects)
    .where(eq(gameObjects.id, id));
  return obj ?? null;
}

export async function listGameObjects(
  db: DrizzleClient,
  params?: { limit?: number; offset?: number }
) {
  const query = db
    .select()
    .from(gameObjects)
    .orderBy(desc(gameObjects.createdAt));
  if (params?.limit !== undefined) {
    query.limit(params.limit);
  }
  if (params?.offset !== undefined) {
    query.offset(params.offset);
  }
  return query;
}

export async function updateGameObject(
  db: DrizzleClient,
  id: string,
  data: UpdateGameObjectData
) {
  const [updated] = await db
    .update(gameObjects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(gameObjects.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteGameObject(db: DrizzleClient, id: string) {
  const [deleted] = await db
    .delete(gameObjects)
    .where(eq(gameObjects.id, id))
    .returning();
  return deleted ?? null;
}

export async function getDistinctValues(
  db: DrizzleClient,
  field: 'category' | 'objectType'
): Promise<string[]> {
  const column =
    field === 'category' ? gameObjects.category : gameObjects.objectType;
  const rows = await db
    .selectDistinct({ value: column })
    .from(gameObjects)
    .where(sql`${column} IS NOT NULL AND ${column} != ''`)
    .orderBy(column);
  return rows.map((r) => r.value).filter((v): v is string => v !== null);
}

export async function validateFrameReferences(
  db: DrizzleClient,
  layers: GameObjectLayer[]
): Promise<string[]> {
  if (!layers || layers.length === 0) {
    return [];
  }

  const uniqueFrameIds = [...new Set(layers.map((l) => l.frameId))];

  const existingFrames = await db
    .select({ id: atlasFrames.id })
    .from(atlasFrames)
    .where(inArray(atlasFrames.id, uniqueFrameIds));

  const existingIds = new Set(existingFrames.map((f) => f.id));

  return uniqueFrameIds.filter((id) => !existingIds.has(id));
}
