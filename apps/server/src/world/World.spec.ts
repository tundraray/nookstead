import { describe, it, expect, beforeEach } from '@jest/globals';
import { World, computeChunkId } from './World.js';
import { createServerPlayer } from '../models/Player.js';
import { CHUNK_SIZE, MAX_SPEED, WORLD_BOUNDS } from '@nookstead/shared';

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('Player management', () => {
    it('should register player with addPlayer and retrieve with getPlayer', () => {
      const player = createServerPlayer({
        id: 'player-1',
        userId: 'user-1',
        worldX: 100,
        worldY: 200,
        chunkId: computeChunkId(100, 200),
        direction: 'down',
        skin: 'default',
        name: 'TestPlayer',
      });

      world.addPlayer(player);

      const retrieved = world.getPlayer('player-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.worldX).toBe(100);
      expect(retrieved?.worldY).toBe(200);
    });

    it('should register player and retrieve via getPlayersInChunk', () => {
      const chunkId = computeChunkId(50, 50);
      const player = createServerPlayer({
        id: 'player-2',
        userId: 'user-2',
        worldX: 50,
        worldY: 50,
        chunkId,
        direction: 'up',
        skin: 'default',
        name: 'ForestPlayer',
      });

      world.addPlayer(player);

      const playersInChunk = world.getPlayersInChunk(chunkId);
      expect(playersInChunk).toHaveLength(1);
      expect(playersInChunk[0].id).toBe('player-2');
    });

    it('should remove player with removePlayer', () => {
      const player = createServerPlayer({
        id: 'player-3',
        userId: 'user-3',
        worldX: 100,
        worldY: 100,
        chunkId: computeChunkId(100, 100),
        direction: 'down',
        skin: 'default',
        name: 'RemoveTest',
      });

      world.addPlayer(player);
      expect(world.getPlayer('player-3')).toBeDefined();

      const removed = world.removePlayer('player-3');
      expect(removed).toBeDefined();
      expect(removed?.id).toBe('player-3');
      expect(world.getPlayer('player-3')).toBeUndefined();
    });
  });

  describe('Movement validation', () => {
    it('should move player correctly with basic movement (dx=3, dy=0)', () => {
      const player = createServerPlayer({
        id: 'player-4',
        userId: 'user-4',
        worldX: 100,
        worldY: 100,
        chunkId: computeChunkId(100, 100),
        direction: 'down',
        skin: 'default',
        name: 'MoveTest',
      });

      world.addPlayer(player);

      const result = world.movePlayer('player-4', 3, 0);
      expect(result.worldX).toBe(103);
      expect(result.worldY).toBe(100);
      expect(result.chunkChanged).toBe(false);
    });

    it('should clamp speed to MAX_SPEED when input exceeds limit', () => {
      const player = createServerPlayer({
        id: 'player-5',
        userId: 'user-5',
        worldX: 100,
        worldY: 100,
        chunkId: computeChunkId(100, 100),
        direction: 'down',
        skin: 'default',
        name: 'SpeedTest',
      });

      world.addPlayer(player);

      // Attempt to move dx=100 (way over MAX_SPEED)
      const result = world.movePlayer('player-5', 100, 0);

      // Movement should be clamped to MAX_SPEED magnitude
      const distance = Math.sqrt(
        (result.worldX - 100) ** 2 + (result.worldY - 100) ** 2
      );
      expect(distance).toBeLessThanOrEqual(MAX_SPEED + 0.001); // floating point tolerance
    });

    it('should clamp position to WORLD_BOUNDS when exceeding boundaries', () => {
      const player = createServerPlayer({
        id: 'player-6',
        userId: 'user-6',
        worldX: WORLD_BOUNDS.maxX - 1,
        worldY: 100,
        chunkId: computeChunkId(WORLD_BOUNDS.maxX - 1, 100),
        direction: 'down',
        skin: 'default',
        name: 'BoundsTest',
      });

      world.addPlayer(player);

      // Attempt to move beyond boundary
      const result = world.movePlayer('player-6', 10, 0);

      // Should be clamped to maxX
      expect(result.worldX).toBe(WORLD_BOUNDS.maxX);
    });
  });

  describe('Chunk detection', () => {
    it('should detect chunk change when crossing CHUNK_SIZE boundary', () => {
      const startX = CHUNK_SIZE - 1; // Just before chunk boundary
      const player = createServerPlayer({
        id: 'player-7',
        userId: 'user-7',
        worldX: startX,
        worldY: 0,
        chunkId: computeChunkId(startX, 0),
        direction: 'down',
        skin: 'default',
        name: 'ChunkCrossTest',
      });

      world.addPlayer(player);

      // Move across chunk boundary
      const result = world.movePlayer('player-7', 2, 0);

      expect(result.chunkChanged).toBe(true);
      expect(result.worldX).toBe(startX + 2);
      expect(result.oldChunkId).toBe(computeChunkId(startX, 0));
      expect(result.newChunkId).toBe(computeChunkId(startX + 2, 0));
    });

    it('should NOT detect chunk change when staying within same chunk', () => {
      const player = createServerPlayer({
        id: 'player-8',
        userId: 'user-8',
        worldX: 30,
        worldY: 30,
        chunkId: computeChunkId(30, 30),
        direction: 'down',
        skin: 'default',
        name: 'SameChunkTest',
      });

      world.addPlayer(player);

      // Move within same chunk (30 + 3 = 33, still in chunk 0)
      const result = world.movePlayer('player-8', 3, 0);

      expect(result.chunkChanged).toBe(false);
      expect(result.worldX).toBe(33);
    });
  });

  describe('Direction derivation', () => {
    it('should derive direction from dx/dy', () => {
      const player = createServerPlayer({
        id: 'player-9',
        userId: 'user-9',
        worldX: 100,
        worldY: 100,
        chunkId: computeChunkId(100, 100),
        direction: 'down',
        skin: 'default',
        name: 'DirectionTest',
      });

      world.addPlayer(player);

      // Move right (dx > 0)
      world.movePlayer('player-9', 2, 0);
      expect(world.getPlayer('player-9')?.direction).toBe('right');

      // Move up (dy < 0)
      world.movePlayer('player-9', 0, -2);
      expect(world.getPlayer('player-9')?.direction).toBe('up');

      // Move left (dx < 0)
      world.movePlayer('player-9', -2, 0);
      expect(world.getPlayer('player-9')?.direction).toBe('left');

      // Move down (dy > 0)
      world.movePlayer('player-9', 0, 2);
      expect(world.getPlayer('player-9')?.direction).toBe('down');
    });
  });

  describe('Error handling', () => {
    it('should return no-op result for unknown player', () => {
      const result = world.movePlayer('unknown-player', 5, 5);

      // Should return a result without crashing
      expect(result.worldX).toBe(0);
      expect(result.worldY).toBe(0);
      expect(result.chunkChanged).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for empty chunk', () => {
      const players = world.getPlayersInChunk('empty:chunk');
      expect(players).toEqual([]);
    });
  });
});
