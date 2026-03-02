import { describe, it, expect, beforeEach } from '@jest/globals';
import { World, computeChunkId } from './World.js';
import { createServerPlayer } from '../models/Player.js';
import { CHUNK_SIZE } from '@nookstead/shared';

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

  describe('Movement', () => {
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

    it('should apply large deltas without clamping (client-side validation)', () => {
      const player = createServerPlayer({
        id: 'player-5',
        userId: 'user-5',
        worldX: 100,
        worldY: 100,
        chunkId: computeChunkId(100, 100),
        direction: 'down',
        skin: 'default',
        name: 'NoClamping',
      });

      world.addPlayer(player);

      const result = world.movePlayer('player-5', 100, 0);
      expect(result.worldX).toBe(200);
      expect(result.worldY).toBe(100);
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

  describe('Non-positional chunk behavior (map: prefix)', () => {
    it('should NOT trigger chunk change for map:{uuid} chunks', () => {
      const player = createServerPlayer({
        id: 'player-map-1',
        userId: 'user-map-1',
        worldX: 100,
        worldY: 100,
        chunkId: 'map:some-uuid-here',
        direction: 'down',
        skin: 'default',
        name: 'MapChunkTest',
      });

      world.addPlayer(player);

      // Move within a map: chunk — should never trigger chunk change
      const result = world.movePlayer('player-map-1', 3, 0);

      expect(result.chunkChanged).toBe(false);
      expect(result.oldChunkId).toBeUndefined();
      expect(result.newChunkId).toBeUndefined();
      // Player should keep original map: chunkId
      expect(world.getPlayer('player-map-1')?.chunkId).toBe(
        'map:some-uuid-here'
      );
    });

    it('should NOT trigger chunk change for city:capital alias', () => {
      const player = createServerPlayer({
        id: 'player-city-1',
        userId: 'user-city-1',
        worldX: 100,
        worldY: 100,
        chunkId: 'city:capital',
        direction: 'down',
        skin: 'default',
        name: 'CityChunkTest',
      });

      world.addPlayer(player);

      const result = world.movePlayer('player-city-1', 5, 0);

      expect(result.chunkChanged).toBe(false);
      expect(world.getPlayer('player-city-1')?.chunkId).toBe('city:capital');
    });

    it('should trigger chunk change for world:{x}:{y} chunks when crossing boundary', () => {
      const startX = CHUNK_SIZE - 1;
      const player = createServerPlayer({
        id: 'player-world-1',
        userId: 'user-world-1',
        worldX: startX,
        worldY: 0,
        chunkId: computeChunkId(startX, 0),
        direction: 'down',
        skin: 'default',
        name: 'WorldChunkTest',
      });

      world.addPlayer(player);

      const result = world.movePlayer('player-world-1', 2, 0);

      expect(result.chunkChanged).toBe(true);
      expect(result.oldChunkId).toBe(computeChunkId(startX, 0));
      expect(result.newChunkId).toBe(computeChunkId(startX + 2, 0));
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
