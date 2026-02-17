import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { maps } from '../schema/maps';

/**
 * Data required to save a map for a user.
 * Uses object parameter pattern (3+ params -> object).
 */
export interface SaveMapData {
  userId: string;
  seed: number;
  grid: unknown;
  layers: unknown;
  walkable: unknown;
}

/**
 * Result of loading a map from the database.
 * Does not include userId (caller already knows it).
 */
export interface LoadMapResult {
  seed: number;
  grid: unknown;
  layers: unknown;
  walkable: unknown;
}

/**
 * Save or update a player's map data using upsert.
 * Uses INSERT ... ON CONFLICT DO UPDATE to handle both new and returning players.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param data - Map data to save
 */
export async function saveMap(
  db: DrizzleClient,
  data: SaveMapData
): Promise<void> {
  const { userId, seed, grid, layers, walkable } = data;

  await db
    .insert(maps)
    .values({
      userId,
      seed,
      grid,
      layers,
      walkable,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: maps.userId,
      set: {
        seed,
        grid,
        layers,
        walkable,
        updatedAt: new Date(),
      },
    });
}

/**
 * Load a player's map data from the database.
 * Returns map data or null if no map exists for this user.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param userId - User ID to load map for
 * @returns Map data or null if not found
 */
export async function loadMap(
  db: DrizzleClient,
  userId: string
): Promise<LoadMapResult | null> {
  const result = await db
    .select({
      seed: maps.seed,
      grid: maps.grid,
      layers: maps.layers,
      walkable: maps.walkable,
    })
    .from(maps)
    .where(eq(maps.userId, userId))
    .limit(1);

  return result.length > 0 ? (result[0] as LoadMapResult) : null;
}
