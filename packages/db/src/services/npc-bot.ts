import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { npcBots, type NpcBot } from '../schema/npc-bots';

/**
 * Data required to create a new NPC bot in the database.
 */
export interface CreateBotData {
  mapId: string;
  name: string;
  skin: string;
  worldX: number;
  worldY: number;
  direction: string;
}

/**
 * Position update for a single bot (used in saveBotPositions).
 */
export interface BotPositionUpdate {
  id: string;
  worldX: number;
  worldY: number;
  direction: string;
}

/**
 * Create a new bot in the database.
 * Assigns a random UUID as the bot id (via schema default).
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param data - Bot creation data
 * @returns The created NpcBot record
 */
export async function createBot(
  db: DrizzleClient,
  data: CreateBotData
): Promise<NpcBot> {
  const result = await db.insert(npcBots).values(data).returning();

  if (result.length === 0) {
    throw new Error('[npc-bot] createBot: insert returned no rows');
  }

  return result[0];
}

/**
 * Load all bots belonging to a given map.
 * Returns an empty array when the map has no bots.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param mapId - Map ID (maps.userId foreign key)
 * @returns Array of NpcBot records (may be empty)
 */
export async function loadBots(
  db: DrizzleClient,
  mapId: string
): Promise<NpcBot[]> {
  return await db.select().from(npcBots).where(eq(npcBots.mapId, mapId));
}

/**
 * Update the positions of multiple bots in a single operation.
 * Uses Promise.allSettled so that one bot's failure does not lose all positions.
 * Called when the last player leaves a homestead to persist bot positions.
 *
 * @param db - Drizzle database instance
 * @param positions - Array of bot position updates
 * @throws When ALL updates fail (partial failures are logged but not thrown)
 */
export async function saveBotPositions(
  db: DrizzleClient,
  positions: BotPositionUpdate[]
): Promise<void> {
  if (positions.length === 0) return;

  const results = await Promise.allSettled(
    positions.map((pos) =>
      db
        .update(npcBots)
        .set({
          worldX: pos.worldX,
          worldY: pos.worldY,
          direction: pos.direction,
          updatedAt: new Date(),
        })
        .where(eq(npcBots.id, pos.id))
    )
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(
      `[npc-bot] saveBotPositions: ${failures.length}/${positions.length} updates failed`
    );
    if (failures.length === positions.length) {
      throw new Error(
        `[npc-bot] saveBotPositions: all ${positions.length} updates failed`
      );
    }
  }
}
