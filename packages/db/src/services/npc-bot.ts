import { desc, eq } from 'drizzle-orm';
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
 * @param mapId - Map UUID (maps.id foreign key)
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

/**
 * Data required to create a new NPC bot via the admin editor.
 * Defaults worldX=0, worldY=0, direction='down' automatically.
 */
export interface AdminCreateBotData {
  name: string;
  skin: string;
  mapId: string;
  personality?: string;
  role?: string;
  speechStyle?: string;
  bio?: string;
  age?: number;
  traits?: string[];
  goals?: string[];
  fears?: string[];
  interests?: string[];
}

/**
 * Partial update data for an existing NPC bot.
 * Only provided fields are updated; undefined fields are left unchanged.
 * Null values explicitly clear the field.
 */
export interface UpdateBotData {
  name?: string;
  skin?: string;
  mapId?: string;
  personality?: string | null;
  role?: string | null;
  speechStyle?: string | null;
  bio?: string | null;
  age?: number | null;
  traits?: string[] | null;
  goals?: string[] | null;
  fears?: string[] | null;
  interests?: string[] | null;
}

/**
 * Create a new bot via the admin editor.
 * Sets default position (worldX=0, worldY=0, direction='down').
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param data - Admin bot creation data
 * @returns The created NpcBot record
 */
export async function createBotAdmin(
  db: DrizzleClient,
  data: AdminCreateBotData
): Promise<NpcBot> {
  const result = await db
    .insert(npcBots)
    .values({
      name: data.name,
      skin: data.skin,
      mapId: data.mapId,
      worldX: 0,
      worldY: 0,
      direction: 'down',
      personality: data.personality,
      role: data.role,
      speechStyle: data.speechStyle,
      bio: data.bio,
      age: data.age,
      traits: data.traits,
      goals: data.goals,
      fears: data.fears,
      interests: data.interests,
    })
    .returning();

  if (result.length === 0) {
    throw new Error('[npc-bot] createBotAdmin: insert returned no rows');
  }

  return result[0];
}

/**
 * Get a single bot by its ID.
 * Returns null if no bot is found.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param id - Bot UUID
 * @returns The NpcBot record or null
 */
export async function getBotById(
  db: DrizzleClient,
  id: string
): Promise<NpcBot | null> {
  const result = await db
    .select()
    .from(npcBots)
    .where(eq(npcBots.id, id));

  return result[0] ?? null;
}

/**
 * List all bots across all maps with pagination.
 * Returns bots ordered by creation date (newest first).
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param params - Pagination parameters (limit defaults to 20, offset defaults to 0)
 * @returns Array of NpcBot records
 */
export async function listAllBots(
  db: DrizzleClient,
  params?: { limit?: number; offset?: number }
): Promise<NpcBot[]> {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;

  return await db
    .select()
    .from(npcBots)
    .orderBy(desc(npcBots.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Update an existing bot's fields.
 * Only provided (non-undefined) fields are updated.
 * Always bumps updatedAt timestamp.
 * Returns null if no bot is found with the given ID.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param id - Bot UUID
 * @param data - Partial update data
 * @returns The updated NpcBot record or null
 */
export async function updateBot(
  db: DrizzleClient,
  id: string,
  data: UpdateBotData
): Promise<NpcBot | null> {
  const setValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) setValues.name = data.name;
  if (data.skin !== undefined) setValues.skin = data.skin;
  if (data.mapId !== undefined) setValues.mapId = data.mapId;
  if (data.personality !== undefined) setValues.personality = data.personality;
  if (data.role !== undefined) setValues.role = data.role;
  if (data.speechStyle !== undefined) setValues.speechStyle = data.speechStyle;
  if (data.bio !== undefined) setValues.bio = data.bio;
  if (data.age !== undefined) setValues.age = data.age;
  if (data.traits !== undefined) setValues.traits = data.traits;
  if (data.goals !== undefined) setValues.goals = data.goals;
  if (data.fears !== undefined) setValues.fears = data.fears;
  if (data.interests !== undefined) setValues.interests = data.interests;

  const result = await db
    .update(npcBots)
    .set(setValues)
    .where(eq(npcBots.id, id))
    .returning();

  return result[0] ?? null;
}

/**
 * Delete a bot by its ID.
 * Returns the deleted bot or null if not found.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param id - Bot UUID
 * @returns The deleted NpcBot record or null
 */
export async function deleteBot(
  db: DrizzleClient,
  id: string
): Promise<NpcBot | null> {
  const result = await db
    .delete(npcBots)
    .where(eq(npcBots.id, id))
    .returning();

  return result[0] ?? null;
}
