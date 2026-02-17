import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { playerPositions } from '../schema/player-positions';

/**
 * Parameters for saving player position.
 * Uses object parameter pattern (3+ params -> object).
 */
export interface SavePositionData {
  userId: string;
  worldX: number;
  worldY: number;
  chunkId: string;
  direction: string;
}

/**
 * Result from loading a player position.
 * Does not include userId (caller already knows it).
 */
export interface LoadPositionResult {
  worldX: number;
  worldY: number;
  chunkId: string;
  direction: string;
}

/**
 * Save or update player position using upsert.
 * Uses INSERT ... ON CONFLICT DO UPDATE to handle both new and existing users.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param data - Position data to save
 */
export async function savePosition(
  db: DrizzleClient,
  data: SavePositionData
): Promise<void> {
  const { userId, worldX, worldY, chunkId, direction } = data;

  await db
    .insert(playerPositions)
    .values({
      userId,
      worldX,
      worldY,
      chunkId,
      direction,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: playerPositions.userId,
      set: {
        worldX,
        worldY,
        chunkId,
        direction,
        updatedAt: new Date(),
      },
    });
}

/**
 * Load player position from database.
 * Returns position data or null if user has no saved position.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param userId - User ID to load position for
 * @returns Position data or null if not found
 */
export async function loadPosition(
  db: DrizzleClient,
  userId: string
): Promise<LoadPositionResult | null> {
  const result = await db
    .select({
      worldX: playerPositions.worldX,
      worldY: playerPositions.worldY,
      chunkId: playerPositions.chunkId,
      direction: playerPositions.direction,
    })
    .from(playerPositions)
    .where(eq(playerPositions.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
