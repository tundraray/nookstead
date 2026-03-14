import { and, count as drizzleCount, desc, eq, notInArray } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import {
  npcMemories,
  type NpcMemoryRow,
} from '../schema/npc-memories';

export interface CreateMemoryData {
  botId: string;
  userId: string;
  type: string;
  content: string;
  importance: number;
  dialogueSessionId?: string;
}

export interface ListMemoriesAdminParams {
  limit?: number;
  offset?: number;
}

/**
 * Insert a single memory record.
 * Errors propagate to caller (fail-fast principle).
 */
export async function createMemory(
  db: DrizzleClient,
  data: CreateMemoryData
): Promise<NpcMemoryRow> {
  const [memory] = await db.insert(npcMemories).values(data).returning();
  return memory;
}

/**
 * Fetch all memories for a specific bot-user pair.
 * Returns empty array when no memories exist.
 * Used by MemoryRetrieval for in-app scoring.
 */
export async function getMemoriesForBot(
  db: DrizzleClient,
  botId: string,
  userId: string
): Promise<NpcMemoryRow[]> {
  return db
    .select()
    .from(npcMemories)
    .where(
      and(eq(npcMemories.botId, botId), eq(npcMemories.userId, userId))
    );
}

/**
 * Count all memories for a bot (across all users).
 * Used for maxMemoriesPerNpc enforcement.
 */
export async function getMemoryCount(
  db: DrizzleClient,
  botId: string
): Promise<number> {
  const result = await db
    .select({ count: drizzleCount() })
    .from(npcMemories)
    .where(eq(npcMemories.botId, botId));
  return result[0]?.count ?? 0;
}

/**
 * Delete oldest memories for a bot, keeping at most `keepCount` records.
 * Deletes by oldest createdAt first. No-op if count <= keepCount.
 */
export async function deleteOldestMemories(
  db: DrizzleClient,
  botId: string,
  keepCount: number
): Promise<void> {
  const total = await getMemoryCount(db, botId);
  if (total <= keepCount) return;

  // Select the newest `keepCount` memories to preserve
  const toKeep = await db
    .select({ id: npcMemories.id })
    .from(npcMemories)
    .where(eq(npcMemories.botId, botId))
    .orderBy(desc(npcMemories.createdAt))
    .limit(keepCount);

  const keepIds = toKeep.map((r) => r.id);

  if (keepIds.length === 0) {
    // No memories to keep — delete all for this bot
    await db.delete(npcMemories).where(eq(npcMemories.botId, botId));
  } else {
    // Delete all memories for this bot that are NOT in the keep list
    await db
      .delete(npcMemories)
      .where(
        and(
          eq(npcMemories.botId, botId),
          notInArray(npcMemories.id, keepIds)
        )
      );
  }
}

/**
 * Delete a single memory by id (admin operation).
 */
export async function deleteMemory(
  db: DrizzleClient,
  id: string
): Promise<void> {
  await db.delete(npcMemories).where(eq(npcMemories.id, id));
}

/**
 * List memories for a bot for admin inspection (paginated).
 * Returns memories ordered by createdAt descending (newest first).
 */
export async function listMemoriesAdmin(
  db: DrizzleClient,
  botId: string,
  params?: ListMemoriesAdminParams
): Promise<NpcMemoryRow[]> {
  return db
    .select()
    .from(npcMemories)
    .where(eq(npcMemories.botId, botId))
    .orderBy(desc(npcMemories.createdAt))
    .limit(params?.limit ?? 20)
    .offset(params?.offset ?? 0);
}
