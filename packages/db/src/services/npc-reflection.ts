import { and, desc, eq, gte, notInArray } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { npcBots } from '../schema/npc-bots';
import { npcMemories, type NpcMemoryRow } from '../schema/npc-memories';

/**
 * Fetch all memories for a bot within a time window (all users, all types).
 * Used by ReflectionService to gather recent experiences for summarization.
 * Errors propagate to caller (fail-fast principle).
 */
export async function getRecentMemoriesForBot(
  db: DrizzleClient,
  botId: string,
  since: Date
): Promise<NpcMemoryRow[]> {
  return db
    .select()
    .from(npcMemories)
    .where(
      and(eq(npcMemories.botId, botId), gte(npcMemories.createdAt, since))
    );
}

/**
 * Fetch reflection-type memories for a bot (newest first).
 * Default limit: 3. Used to include prior reflections in LLM context.
 * Errors propagate to caller (fail-fast principle).
 */
export async function getReflectionMemories(
  db: DrizzleClient,
  botId: string,
  limit = 3
): Promise<NpcMemoryRow[]> {
  return db
    .select()
    .from(npcMemories)
    .where(
      and(
        eq(npcMemories.botId, botId),
        eq(npcMemories.type, 'reflection')
      )
    )
    .orderBy(desc(npcMemories.createdAt))
    .limit(limit);
}

/**
 * Get bots that have no reflection since the given date.
 * Used by ReflectionScheduler to determine which NPCs need reflection today.
 * Errors propagate to caller (fail-fast principle).
 *
 * Note: The empty-array guard for notInArray is required because Drizzle
 * generates invalid SQL for `NOT IN ()` with an empty array.
 */
export async function getBotsNeedingReflection(
  db: DrizzleClient,
  since: Date
): Promise<Array<{ id: string; name: string }>> {
  const botsWithReflection = await db
    .selectDistinct({ botId: npcMemories.botId })
    .from(npcMemories)
    .where(
      and(
        eq(npcMemories.type, 'reflection'),
        gte(npcMemories.createdAt, since)
      )
    );

  const excludeIds = botsWithReflection.map((r) => r.botId);

  if (excludeIds.length === 0) {
    return db
      .select({ id: npcBots.id, name: npcBots.name })
      .from(npcBots);
  }

  return db
    .select({ id: npcBots.id, name: npcBots.name })
    .from(npcBots)
    .where(notInArray(npcBots.id, excludeIds));
}

/**
 * Insert a reflection memory record (userId is null -- system-generated).
 * Errors propagate to caller (fail-fast principle).
 */
export async function createReflectionMemory(
  db: DrizzleClient,
  data: {
    botId: string;
    content: string;
    importance: number;
  }
): Promise<NpcMemoryRow> {
  const [memory] = await db
    .insert(npcMemories)
    .values({
      botId: data.botId,
      userId: undefined, // null in DB -- no user for reflections
      type: 'reflection',
      content: data.content,
      importance: data.importance,
    })
    .returning();
  return memory;
}
