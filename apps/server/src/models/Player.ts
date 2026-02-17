/**
 * Server-side player entity model.
 * Represents a player in the World state and ChunkRoom schema.
 */
export interface ServerPlayer {
  /** Unique player identifier (session ID from Colyseus) */
  id: string;

  /** User ID from authentication system */
  userId: string;

  /** Current world X coordinate */
  worldX: number;

  /** Current world Y coordinate */
  worldY: number;

  /** Current chunk identifier (e.g., "city:capital") */
  chunkId: string;

  /** Current facing direction */
  direction: 'up' | 'down' | 'left' | 'right';

  /** Player skin/appearance identifier */
  skin: string;

  /** Player display name */
  name: string;

  /** Colyseus session ID (same as id, for clarity) */
  sessionId: string;
}

/**
 * Factory function parameters for creating ServerPlayer.
 */
export interface CreateServerPlayerParams {
  id: string;
  userId: string;
  worldX: number;
  worldY: number;
  chunkId: string;
  direction: 'up' | 'down' | 'left' | 'right';
  skin: string;
  name: string;
}

/**
 * Create a new ServerPlayer instance.
 * Factory function ensures all required fields are provided.
 *
 * @param params - Player creation parameters
 * @returns Initialized ServerPlayer instance
 */
export function createServerPlayer(
  params: CreateServerPlayerParams
): ServerPlayer {
  return {
    ...params,
    sessionId: params.id, // sessionId is same as id
  };
}
