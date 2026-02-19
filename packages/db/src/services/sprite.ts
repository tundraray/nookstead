import { eq, desc, sql, count } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { sprites } from '../schema/sprites';
import { atlasFrames } from '../schema/atlas-frames';
import { gameObjects } from '../schema/game-objects';

export interface CreateSpriteData {
  name: string;
  s3Key: string;
  s3Url: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export interface ListSpritesParams {
  limit?: number;
  offset?: number;
}

export async function createSprite(db: DrizzleClient, data: CreateSpriteData) {
  const [sprite] = await db.insert(sprites).values(data).returning();
  return sprite;
}

export async function getSprite(db: DrizzleClient, id: string) {
  const [sprite] = await db
    .select()
    .from(sprites)
    .where(eq(sprites.id, id));
  return sprite ?? null;
}

export async function listSprites(
  db: DrizzleClient,
  params?: ListSpritesParams
) {
  const query = db
    .select()
    .from(sprites)
    .orderBy(desc(sprites.createdAt));
  if (params?.limit !== undefined) {
    query.limit(params.limit);
  }
  if (params?.offset !== undefined) {
    query.offset(params.offset);
  }
  return query;
}

export async function deleteSprite(db: DrizzleClient, id: string) {
  const [deleted] = await db
    .delete(sprites)
    .where(eq(sprites.id, id))
    .returning();
  return deleted ?? null;
}

export async function countFramesBySprite(
  db: DrizzleClient,
  spriteId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(atlasFrames)
    .where(eq(atlasFrames.spriteId, spriteId));
  return result?.count ?? 0;
}

export async function findGameObjectsReferencingSprite(
  db: DrizzleClient,
  spriteId: string
) {
  return db
    .select({ id: gameObjects.id, name: gameObjects.name })
    .from(gameObjects)
    .where(
      sql`${gameObjects.layers} @> ${JSON.stringify([{ spriteId }])}::jsonb`
    );
}
