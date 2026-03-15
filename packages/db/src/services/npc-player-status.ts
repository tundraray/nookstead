import { and, eq, gt, lte } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import {
  npcPlayerStatuses,
  type NpcPlayerStatus,
} from '../schema/npc-player-statuses';

/**
 * Returns true if a non-expired status row exists for the (botId, userId, statusType) triple.
 * Returns false on any DB error (fail-open per Design Doc -- reject is worse than allow on error).
 */
export async function hasActiveStatus(
  db: DrizzleClient,
  botId: string,
  userId: string,
  statusType: string
): Promise<boolean> {
  try {
    const row = await db
      .select({ id: npcPlayerStatuses.id })
      .from(npcPlayerStatuses)
      .where(
        and(
          eq(npcPlayerStatuses.botId, botId),
          eq(npcPlayerStatuses.userId, userId),
          eq(npcPlayerStatuses.status, statusType),
          gt(npcPlayerStatuses.expiresAt, new Date())
        )
      )
      .limit(1);
    return row.length > 0;
  } catch (error) {
    console.warn(
      `[npc-player-status] hasActiveStatus query failed (fail-open): bot=${botId}, user=${userId}, status=${statusType}`,
      error
    );
    return false;
  }
}

/**
 * Inserts a new status row with expiresAt = NOW() + durationMinutes.
 * Throws on DB error (caller handles).
 */
export async function createPlayerStatus(
  db: DrizzleClient,
  botId: string,
  userId: string,
  status: string,
  reason: string | null,
  durationMinutes: number
): Promise<NpcPlayerStatus> {
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const [created] = await db
    .insert(npcPlayerStatuses)
    .values({
      botId,
      userId,
      status,
      reason,
      expiresAt,
    })
    .returning();

  return created;
}

/**
 * List all active (non-expired) statuses for a bot.
 */
export async function listActiveStatusesForBot(
  db: DrizzleClient,
  botId: string
): Promise<NpcPlayerStatus[]> {
  return db
    .select()
    .from(npcPlayerStatuses)
    .where(
      and(
        eq(npcPlayerStatuses.botId, botId),
        gt(npcPlayerStatuses.expiresAt, new Date())
      )
    );
}

/**
 * Deletes all rows where expiresAt <= NOW(). Called periodically for housekeeping.
 * Returns count of deleted rows.
 */
export async function cleanupExpiredStatuses(
  db: DrizzleClient
): Promise<number> {
  const deleted = await db
    .delete(npcPlayerStatuses)
    .where(lte(npcPlayerStatuses.expiresAt, new Date()))
    .returning();

  return deleted.length;
}
