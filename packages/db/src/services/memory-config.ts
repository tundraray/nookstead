import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import {
  memoryStreamConfig,
  npcMemoryOverrides,
  type MemoryStreamConfigRow,
  type NpcMemoryOverrideRow,
} from '../schema/memory-stream-config';

export interface MemoryConfigValues {
  topK: number;
  halfLifeHours: number;
  recencyWeight: number;
  importanceWeight: number;
  semanticWeight: number;
  maxMemoriesPerNpc: number;
  tokenBudget: number;
  importanceFirstMeeting: number;
  importanceNormalDialogue: number;
  importanceEmotionalDialogue: number;
  importanceGiftReceived: number;
  importanceQuestRelated: number;
}

function rowToConfig(row: MemoryStreamConfigRow): MemoryConfigValues {
  return {
    topK: row.topK,
    halfLifeHours: row.halfLifeHours,
    recencyWeight: row.recencyWeight,
    importanceWeight: row.importanceWeight,
    semanticWeight: row.semanticWeight,
    maxMemoriesPerNpc: row.maxMemoriesPerNpc,
    tokenBudget: row.tokenBudget,
    importanceFirstMeeting: row.importanceFirstMeeting,
    importanceNormalDialogue: row.importanceNormalDialogue,
    importanceEmotionalDialogue: row.importanceEmotionalDialogue,
    importanceGiftReceived: row.importanceGiftReceived,
    importanceQuestRelated: row.importanceQuestRelated,
  };
}

/**
 * Get the global memory stream config row.
 * Creates a default config row if none exists (first-access initialization).
 */
export async function getGlobalConfig(
  db: DrizzleClient
): Promise<MemoryConfigValues> {
  const rows = await db.select().from(memoryStreamConfig).limit(1);
  if (rows.length > 0) return rowToConfig(rows[0]);

  const [inserted] = await db
    .insert(memoryStreamConfig)
    .values({})
    .returning();
  return rowToConfig(inserted);
}

/**
 * Update the global memory stream config.
 * Ensures a config row exists first, then updates it.
 */
export async function updateGlobalConfig(
  db: DrizzleClient,
  data: Partial<MemoryConfigValues>
): Promise<MemoryConfigValues> {
  // Ensure the row exists
  await getGlobalConfig(db);

  const rows = await db.select().from(memoryStreamConfig).limit(1);
  const [updated] = await db
    .update(memoryStreamConfig)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(memoryStreamConfig.id, rows[0].id))
    .returning();
  return rowToConfig(updated);
}

/**
 * Get per-NPC override for a specific bot.
 * Returns null if no override exists.
 */
export async function getNpcOverride(
  db: DrizzleClient,
  botId: string
): Promise<NpcMemoryOverrideRow | null> {
  const rows = await db
    .select()
    .from(npcMemoryOverrides)
    .where(eq(npcMemoryOverrides.botId, botId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create or update a per-NPC config override.
 * Uses upsert on the unique botId constraint.
 */
export async function upsertNpcOverride(
  db: DrizzleClient,
  botId: string,
  data: Partial<
    Omit<NpcMemoryOverrideRow, 'id' | 'botId' | 'updatedAt'>
  >
): Promise<NpcMemoryOverrideRow> {
  const [result] = await db
    .insert(npcMemoryOverrides)
    .values({ botId, ...data })
    .onConflictDoUpdate({
      target: npcMemoryOverrides.botId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return result;
}

/**
 * Delete the per-NPC override for a bot (reverts to global defaults).
 */
export async function deleteNpcOverride(
  db: DrizzleClient,
  botId: string
): Promise<void> {
  await db
    .delete(npcMemoryOverrides)
    .where(eq(npcMemoryOverrides.botId, botId));
}

/**
 * Get the effective config for a bot by merging global config with per-NPC override.
 * For each field: null override = use global value; non-null override = use override value.
 * IMPORTANT: Uses ?? (nullish coalescing), NOT || — 0 is a valid override value.
 */
export async function getEffectiveConfig(
  db: DrizzleClient,
  botId: string
): Promise<MemoryConfigValues> {
  const global = await getGlobalConfig(db);
  const override = await getNpcOverride(db, botId);

  if (!override) return global;

  return {
    ...global,
    topK: override.topK ?? global.topK,
    halfLifeHours: override.halfLifeHours ?? global.halfLifeHours,
    recencyWeight: override.recencyWeight ?? global.recencyWeight,
    importanceWeight: override.importanceWeight ?? global.importanceWeight,
    semanticWeight: override.semanticWeight ?? global.semanticWeight,
    maxMemoriesPerNpc:
      override.maxMemoriesPerNpc ?? global.maxMemoriesPerNpc,
    tokenBudget: override.tokenBudget ?? global.tokenBudget,
  };
}
