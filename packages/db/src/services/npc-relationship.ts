import { and, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import {
  npcRelationships,
  type NpcRelationshipRow,
} from '../schema/npc-relationships';

const SCORE_MIN = -50;
const SCORE_MAX = 100;

function clampScore(score: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
}

export interface UpsertRelationshipData {
  socialType?: string;
  isWorker?: boolean;
  score?: number;
  hiredAt?: Date | null;
}

/**
 * Get the relationship between a bot and user.
 * Returns null if no relationship exists (first encounter).
 */
export async function getRelationship(
  db: DrizzleClient,
  botId: string,
  userId: string
): Promise<NpcRelationshipRow | null> {
  const rows = await db
    .select()
    .from(npcRelationships)
    .where(
      and(
        eq(npcRelationships.botId, botId),
        eq(npcRelationships.userId, userId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get or create a relationship. Creates with defaults (stranger, score 0) if none exists.
 */
export async function getOrCreateRelationship(
  db: DrizzleClient,
  botId: string,
  userId: string
): Promise<NpcRelationshipRow> {
  const existing = await getRelationship(db, botId, userId);
  if (existing) return existing;

  const [created] = await db
    .insert(npcRelationships)
    .values({ botId, userId })
    .onConflictDoNothing()
    .returning();

  // In case of race condition, re-fetch
  if (!created) {
    const refetched = await getRelationship(db, botId, userId);
    if (refetched) return refetched;
    throw new Error(`[npc-relationship] Failed to create relationship for bot=${botId}, user=${userId}`);
  }

  return created;
}

/**
 * Update relationship fields. Score is clamped to [-50, 100].
 */
export async function updateRelationship(
  db: DrizzleClient,
  botId: string,
  userId: string,
  data: UpsertRelationshipData
): Promise<NpcRelationshipRow> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.socialType !== undefined) updateData['socialType'] = data.socialType;
  if (data.isWorker !== undefined) updateData['isWorker'] = data.isWorker;
  if (data.score !== undefined) updateData['score'] = clampScore(data.score);
  if (data.hiredAt !== undefined) updateData['hiredAt'] = data.hiredAt;

  const [updated] = await db
    .update(npcRelationships)
    .set(updateData)
    .where(
      and(
        eq(npcRelationships.botId, botId),
        eq(npcRelationships.userId, userId)
      )
    )
    .returning();

  return updated;
}

/**
 * Increment/decrement relationship score by delta. Clamped to [-50, 100].
 */
export async function adjustRelationshipScore(
  db: DrizzleClient,
  botId: string,
  userId: string,
  delta: number
): Promise<NpcRelationshipRow> {
  const rel = await getOrCreateRelationship(db, botId, userId);
  const newScore = clampScore(rel.score + delta);

  return updateRelationship(db, botId, userId, { score: newScore });
}

/**
 * List all relationships for a bot (admin inspection).
 */
export async function listRelationshipsForBot(
  db: DrizzleClient,
  botId: string,
  params?: { limit?: number; offset?: number }
): Promise<NpcRelationshipRow[]> {
  return db
    .select()
    .from(npcRelationships)
    .where(eq(npcRelationships.botId, botId))
    .orderBy(desc(npcRelationships.updatedAt))
    .limit(params?.limit ?? 20)
    .offset(params?.offset ?? 0);
}

/**
 * List all relationships for a user across all NPCs.
 */
export async function listRelationshipsForUser(
  db: DrizzleClient,
  userId: string
): Promise<NpcRelationshipRow[]> {
  return db
    .select()
    .from(npcRelationships)
    .where(eq(npcRelationships.userId, userId))
    .orderBy(desc(npcRelationships.updatedAt));
}
