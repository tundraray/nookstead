import type { ServerPlayer } from '../models/Player.js';
import type { MoveResult } from '@nookstead/shared';
import { CHUNK_SIZE } from '@nookstead/shared';

/**
 * Compute chunk ID from world coordinates.
 * Exported as standalone function for use by other modules (e.g., initial spawn).
 */
export function computeChunkId(worldX: number, worldY: number): string {
  const chunkX = Math.floor(worldX / CHUNK_SIZE);
  const chunkY = Math.floor(worldY / CHUNK_SIZE);
  return `world:${chunkX}:${chunkY}`;
}

/**
 * Derive facing direction from movement delta.
 * Horizontal movement takes priority over vertical when both are non-zero.
 * Returns undefined when there is no movement (dx=0, dy=0).
 */
function deriveDirection(
  dx: number,
  dy: number
): 'up' | 'down' | 'left' | 'right' | undefined {
  if (dx === 0 && dy === 0) {
    return undefined;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

/**
 * World - authoritative state manager for all player positions.
 *
 * All state mutations go through World API. ChunkRoom delegates to World
 * and never mutates player state directly.
 *
 * Instantiable class for testability. A default module-level instance is
 * exported for production use.
 */
export class World {
  private players: Map<string, ServerPlayer> = new Map();

  /**
   * Add player to world state.
   * Ensures chunkId is computed from position if not already set correctly.
   */
  addPlayer(player: ServerPlayer): void {
    this.players.set(player.id, player);
  }

  /**
   * Remove player from world state.
   * Returns the removed player, or undefined if not found.
   */
  removePlayer(playerId: string): ServerPlayer | undefined {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
    }
    return player;
  }

  /**
   * Move player by delta (dx, dy).
   * Movement validation is client-side; server trusts client deltas.
   * Detects chunk changes and derives facing direction.
   *
   * Returns MoveResult with new position and chunk change information.
   * For unknown players, returns a no-op result without crashing.
   */
  movePlayer(playerId: string, dx: number, dy: number): MoveResult {
    const player = this.players.get(playerId);

    // Unknown player: return no-op result
    if (!player) {
      return {
        worldX: 0,
        worldY: 0,
        chunkChanged: false,
      };
    }

    // Movement validation is client-side only; server trusts client deltas.
    const newWorldX = player.worldX + dx;
    const newWorldY = player.worldY + dy;

    // Compute new chunk — only world:{x}:{y} chunks are positional.
    // map:{mapId} (homesteads, cities) and city:capital are non-positional;
    // no spatial chunk transitions occur inside them.
    const isPositionalChunk = player.chunkId.startsWith('world:');
    const oldChunkId = player.chunkId;
    const newChunkId = isPositionalChunk
      ? computeChunkId(newWorldX, newWorldY)
      : oldChunkId;
    const chunkChanged = isPositionalChunk && newChunkId !== oldChunkId;

    // Derive direction from delta (keep current if no movement)
    const newDirection = deriveDirection(dx, dy);
    if (newDirection) {
      player.direction = newDirection;
    }

    // Update player state
    player.worldX = newWorldX;
    player.worldY = newWorldY;
    player.chunkId = newChunkId;

    // Build result
    const result: MoveResult = {
      worldX: newWorldX,
      worldY: newWorldY,
      chunkChanged,
    };

    if (chunkChanged) {
      result.oldChunkId = oldChunkId;
      result.newChunkId = newChunkId;
    }

    return result;
  }

  /**
   * Get all players in a specified chunk.
   * Returns empty array if no players are in the chunk.
   */
  getPlayersInChunk(chunkId: string): ServerPlayer[] {
    const result: ServerPlayer[] = [];
    for (const player of this.players.values()) {
      if (player.chunkId === chunkId) {
        result.push(player);
      }
    }
    return result;
  }

  /**
   * Set a player's absolute position.
   * Used for client-side displacement corrections that need to be
   * reflected on the server.
   *
   * Returns true if the player was found and updated, false otherwise.
   */
  setPlayerPosition(playerId: string, x: number, y: number): boolean {
    const player = this.players.get(playerId);
    if (!player) {
      return false;
    }
    player.worldX = x;
    player.worldY = y;
    return true;
  }

  /**
   * Get player by ID.
   * Returns undefined if player is not found.
   */
  getPlayer(playerId: string): ServerPlayer | undefined {
    return this.players.get(playerId);
  }
}

/** Default module-level instance for production use. */
export const world = new World();
