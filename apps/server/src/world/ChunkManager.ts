import { CHUNK_TRANSITION_COOLDOWN_MS } from '@nookstead/shared';

/**
 * ChunkManager - manages ChunkRoom lifecycle tracking and prevents
 * boundary oscillation (rapid back-and-forth chunk transitions).
 *
 * Regular class (instantiable for testing). A default module-level
 * instance is exported for production use.
 */
export class ChunkManager {
  /** Active chunk rooms keyed by chunkId. Type is `any` to avoid circular deps with ChunkRoom. */
  private rooms: Map<string, any> = new Map();

  /** Last transition timestamp per playerId (for oscillation cooldown). */
  private lastTransition: Map<string, number> = new Map();

  /**
   * Register a ChunkRoom instance for a chunk.
   */
  registerRoom(chunkId: string, room: any): void {
    this.rooms.set(chunkId, room);
  }

  /**
   * Unregister a ChunkRoom instance when it is disposed.
   */
  unregisterRoom(chunkId: string): void {
    this.rooms.delete(chunkId);
  }

  /**
   * Get ChunkRoom instance for a chunk (if exists).
   */
  getRoom(chunkId: string): any | undefined {
    return this.rooms.get(chunkId);
  }

  /**
   * Get count of active ChunkRooms.
   */
  getActiveRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Check if player can transition to a new chunk (respects cooldown).
   *
   * Returns true if no recent transition or enough time has elapsed
   * since the last recorded transition.
   */
  canTransition(playerId: string): boolean {
    const last = this.lastTransition.get(playerId);
    if (last === undefined) {
      return true;
    }
    return Date.now() - last >= CHUNK_TRANSITION_COOLDOWN_MS;
  }

  /**
   * Record a chunk transition for oscillation prevention.
   * Sets the current timestamp as the last transition time for the player.
   */
  recordTransition(playerId: string): void {
    this.lastTransition.set(playerId, Date.now());
  }
}

/** Default module-level instance for production use. */
export const chunkManager = new ChunkManager();
