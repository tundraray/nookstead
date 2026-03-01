import type { ServerPlayer } from '../models/Player.js';
import type { MoveResult } from '@nookstead/shared';
import { CHUNK_SIZE, MAX_SPEED, WORLD_BOUNDS } from '@nookstead/shared';

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
   * Validates speed (clamps to MAX_SPEED), clamps to WORLD_BOUNDS,
   * detects chunk changes, and derives facing direction.
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

    // Speed clamping: clamp magnitude to MAX_SPEED
    let clampedDx = dx;
    let clampedDy = dy;
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > MAX_SPEED) {
      const scale = MAX_SPEED / magnitude;
      clampedDx = dx * scale;
      clampedDy = dy * scale;
    }

    // Compute new position
    let newWorldX = player.worldX + clampedDx;
    let newWorldY = player.worldY + clampedDy;

    // Bounds clamping
    newWorldX = Math.max(
      WORLD_BOUNDS.minX,
      Math.min(WORLD_BOUNDS.maxX, newWorldX)
    );
    newWorldY = Math.max(
      WORLD_BOUNDS.minY,
      Math.min(WORLD_BOUNDS.maxY, newWorldY)
    );

    // Compute new chunk (skip for non-positional chunks like player homesteads)
    const oldChunkId = player.chunkId;
    const isPositionalChunk = oldChunkId.startsWith('world:');
    const newChunkId = isPositionalChunk
      ? computeChunkId(newWorldX, newWorldY)
      : oldChunkId;
    const chunkChanged = isPositionalChunk && newChunkId !== oldChunkId;

    // Derive direction from delta (keep current if no movement)
    const newDirection = deriveDirection(clampedDx, clampedDy);
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
   * Get player by ID.
   * Returns undefined if player is not found.
   */
  getPlayer(playerId: string): ServerPlayer | undefined {
    return this.players.get(playerId);
  }
}

/** Default module-level instance for production use. */
export const world = new World();
