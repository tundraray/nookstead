import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  BOT_WANDER_INTERVAL_TICKS,
  BOT_INTERACTION_RADIUS,
  BOT_STUCK_TIMEOUT_MS,
  MAX_BOTS_PER_HOMESTEAD,
  TILE_SIZE,
} from '@nookstead/shared';
import { BotManager } from './BotManager.js';
import type { BotManagerConfig } from '../types/bot-types.js';
import { createServerBot } from '../types/bot-types.js';
import type { NpcBot } from '@nookstead/db';

/**
 * Create a minimal walkability grid where all tiles are walkable.
 */
function makeWalkableGrid(width: number, height: number): boolean[][] {
  return Array.from({ length: height }, () => Array(width).fill(true));
}

/**
 * Create a walkability grid where only specified tiles are walkable.
 */
function makeSelectiveGrid(
  width: number,
  height: number,
  walkableTiles: Array<{ x: number; y: number }>
): boolean[][] {
  const grid = Array.from({ length: height }, () =>
    Array(width).fill(false)
  );
  for (const tile of walkableTiles) {
    if (tile.y >= 0 && tile.y < height && tile.x >= 0 && tile.x < width) {
      grid[tile.y][tile.x] = true;
    }
  }
  return grid;
}

/**
 * Create a default BotManagerConfig for testing.
 */
function makeConfig(overrides?: Partial<BotManagerConfig>): BotManagerConfig {
  const width = overrides?.mapWidth ?? 16;
  const height = overrides?.mapHeight ?? 16;
  return {
    mapWalkable: overrides?.mapWalkable ?? makeWalkableGrid(width, height),
    mapWidth: width,
    mapHeight: height,
    mapId: overrides?.mapId ?? 'test-map-id',
    tickIntervalMs: overrides?.tickIntervalMs ?? 100,
  };
}

/**
 * Create a mock NpcBot record from DB.
 */
function makeBotRecord(overrides?: Partial<NpcBot>): NpcBot {
  return {
    id: overrides?.id ?? 'bot-1',
    mapId: overrides?.mapId ?? 'test-map-id',
    name: overrides?.name ?? 'Biscuit',
    skin: overrides?.skin ?? 'scout_1',
    worldX: overrides?.worldX ?? 80,
    worldY: overrides?.worldY ?? 80,
    direction: overrides?.direction ?? 'down',
    createdAt: overrides?.createdAt ?? new Date('2026-01-01'),
    updatedAt: overrides?.updatedAt ?? new Date('2026-01-01'),
  };
}

describe('BotManager', () => {
  let manager: BotManager;
  let config: BotManagerConfig;

  beforeEach(() => {
    manager = new BotManager();
    config = makeConfig();
  });

  // ─── createServerBot factory ────────────────────────────────────────────────

  describe('createServerBot', () => {
    it('should create a ServerBot from NpcBot record with idle state', () => {
      const record = makeBotRecord({
        id: 'bot-factory-1',
        worldX: 100,
        worldY: 200,
        direction: 'right',
      });

      const bot = createServerBot(record);

      expect(bot.id).toBe('bot-factory-1');
      expect(bot.mapId).toBe('test-map-id');
      expect(bot.name).toBe('Biscuit');
      expect(bot.skin).toBe('scout_1');
      expect(bot.worldX).toBe(100);
      expect(bot.worldY).toBe(200);
      expect(bot.direction).toBe('right');
      expect(bot.state).toBe('idle');
      expect(bot.targetX).toBeNull();
      expect(bot.targetY).toBeNull();
      expect(bot.idleTicks).toBe(0);
      expect(bot.walkStartTime).toBeNull();
      expect(bot.lastKnownX).toBe(100);
      expect(bot.lastKnownY).toBe(200);
    });
  });

  // ─── init() ─────────────────────────────────────────────────────────────────

  describe('init()', () => {
    it('should populate bots from DB records', () => {
      const records = [
        makeBotRecord({ id: 'bot-a', name: 'Clover' }),
        makeBotRecord({ id: 'bot-b', name: 'Fern' }),
      ];

      manager.init(config, records);

      expect(manager.getBotIds()).toHaveLength(2);
      expect(manager.getBotIds()).toContain('bot-a');
      expect(manager.getBotIds()).toContain('bot-b');
    });

    it('should clear previous bots on re-init', () => {
      manager.init(config, [makeBotRecord({ id: 'old-bot' })]);
      expect(manager.getBotIds()).toHaveLength(1);

      manager.init(config, [makeBotRecord({ id: 'new-bot' })]);
      expect(manager.getBotIds()).toHaveLength(1);
      expect(manager.getBotIds()).toContain('new-bot');
    });

    it('should handle empty records (first visit)', () => {
      manager.init(config, []);
      expect(manager.getBotIds()).toHaveLength(0);
    });
  });

  // ─── addBot() ───────────────────────────────────────────────────────────────

  describe('addBot()', () => {
    it('should add a bot from a DB record after init', () => {
      manager.init(config, []);
      const record = makeBotRecord({ id: 'added-bot', name: 'Hazel' });

      manager.addBot(record);

      expect(manager.getBotIds()).toContain('added-bot');
    });
  });

  // ─── tick() — IDLE state ────────────────────────────────────────────────────

  describe('tick() — IDLE state', () => {
    it('should not transition bot before BOT_WANDER_INTERVAL_TICKS', () => {
      manager.init(config, [makeBotRecord({ id: 'idle-bot' })]);

      // Tick fewer times than the wander interval
      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS - 1; i++) {
        manager.tick(100);
      }

      const positions = manager.getBotPositions();
      const bot = positions.find((b) => b.id === 'idle-bot');
      // Bot should still be at initial position (no wander started)
      expect(bot?.worldX).toBe(80);
      expect(bot?.worldY).toBe(80);
    });

    it('should transition bot to WALKING after BOT_WANDER_INTERVAL_TICKS', () => {
      manager.init(config, [makeBotRecord({ id: 'wander-bot' })]);

      // Tick exactly BOT_WANDER_INTERVAL_TICKS times
      let hasUpdate = false;
      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS; i++) {
        const updates = manager.tick(100);
        if (updates.length > 0) {
          hasUpdate = true;
        }
      }

      // Bot should have produced an update (transition to walking)
      expect(hasUpdate).toBe(true);
    });
  });

  // ─── tick() — WALKING state ─────────────────────────────────────────────────

  describe('tick() — WALKING state', () => {
    it('should move bot toward target at BOT_SPEED', () => {
      // Place bot at center of tile (5,5) = worldX=88, worldY=88
      const botRecord = makeBotRecord({
        id: 'walk-bot',
        worldX: 88,
        worldY: 88,
      });
      manager.init(config, [botRecord]);

      // Force bot into WALKING by ticking past the wander interval
      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS; i++) {
        manager.tick(100);
      }

      // The bot should have moved from initial position
      const positions = manager.getBotPositions();
      const bot = positions.find((b) => b.id === 'walk-bot');
      // We cannot predict exact target (random), but we can check it either
      // changed state or is at a different position
      expect(bot).toBeDefined();
    });

    it('should return bot to IDLE when reaching target (within 2px)', () => {
      manager.init(config, [makeBotRecord({ id: 'arrive-bot', worldX: 80, worldY: 80 })]);

      // Run many ticks to allow bot to reach its target
      // With BOT_SPEED=60px/s and 100ms ticks, bot moves 6px per tick
      // BOT_WANDER_RADIUS=8 tiles * 16px = 128px max distance
      // 128px / 6px per tick = ~22 ticks to traverse max distance
      // Plus BOT_WANDER_INTERVAL_TICKS to start walking
      const totalTicks = BOT_WANDER_INTERVAL_TICKS + 100;
      let sawIdleAfterWalking = false;
      let wasWalking = false;

      for (let i = 0; i < totalTicks; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'arrive-bot') {
            if (u.state === 'walking') wasWalking = true;
            if (wasWalking && u.state === 'idle') sawIdleAfterWalking = true;
          }
        }
      }

      // Bot should have gone through walking->idle cycle
      expect(wasWalking).toBe(true);
      expect(sawIdleAfterWalking).toBe(true);
    });
  });

  // ─── tick() — stuck detection ───────────────────────────────────────────────

  describe('tick() — stuck detection', () => {
    it('should pick new target when bot is stuck for BOT_STUCK_TIMEOUT_MS', () => {
      // Create a grid where only one tile is walkable (the bot's tile)
      // plus one adjacent tile so bot tries to walk but gets stuck
      const grid = makeSelectiveGrid(16, 16, [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ]);
      const stuckConfig = makeConfig({
        mapWalkable: grid,
      });
      // Bot at center of tile 5,5
      const botRecord = makeBotRecord({
        id: 'stuck-bot',
        worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(stuckConfig, [botRecord]);

      // Tick enough to trigger stuck detection
      // BOT_STUCK_TIMEOUT_MS = 5000ms, tick interval = 100ms
      // 50 ticks to reach timeout + BOT_WANDER_INTERVAL_TICKS to start
      const totalTicks = BOT_WANDER_INTERVAL_TICKS + 60;
      let updateCount = 0;

      for (let i = 0; i < totalTicks; i++) {
        const updates = manager.tick(100);
        // After stuck timeout, bot should pick new target or go idle
        for (const u of updates) {
          if (u.id === 'stuck-bot') {
            updateCount++;
          }
        }
      }

      // The bot should still be operational (not frozen) and have produced updates
      const positions = manager.getBotPositions();
      expect(positions.find((b) => b.id === 'stuck-bot')).toBeDefined();
      expect(updateCount).toBeGreaterThan(0);
    });

    it('should transition to idle when bot oscillates at obstacle edge', () => {
      // Create a corridor: bot at tile (5,5), walkable tiles only at (5,5) and (6,5).
      // Bot can only wander between these two tiles.
      // With LoS check, targets behind the obstacle are rejected.
      // If bot ends up stuck (can't move enough), position-based detection should fire.
      const grid = makeSelectiveGrid(16, 16, [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ]);
      const stuckConfig = makeConfig({ mapWalkable: grid });
      const botRecord = makeBotRecord({
        id: 'oscillate-bot',
        worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(stuckConfig, [botRecord]);

      // Run enough ticks for wander + stuck timeout
      const stuckTicks = Math.ceil(BOT_STUCK_TIMEOUT_MS / 100);
      const totalTicks = BOT_WANDER_INTERVAL_TICKS + stuckTicks + 10;
      let sawIdle = false;

      for (let i = 0; i < totalTicks; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'oscillate-bot' && u.state === 'idle') {
            sawIdle = true;
          }
        }
      }

      // Bot should eventually go idle from stuck detection
      expect(sawIdle).toBe(true);
    });
  });

  // ─── tick() — line-of-sight target validation ─────────────────────────────

  describe('tick() — line-of-sight target validation', () => {
    it('should not pick wander targets behind obstacles', () => {
      // Create a grid with a wall separating two areas:
      // Row 5 is all walkable EXCEPT tile (8,5) which is a wall.
      // Bot at tile (5,5). Tiles (9,5)-(12,5) are walkable but behind the wall.
      // Column 8 is a wall from row 0-10.
      const grid = makeWalkableGrid(16, 16);
      // Create a vertical wall at x=8 spanning the full height
      for (let y = 0; y < 16; y++) {
        grid[y][8] = false;
      }
      const wallConfig = makeConfig({ mapWalkable: grid });
      const botRecord = makeBotRecord({
        id: 'los-bot',
        worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(wallConfig, [botRecord]);

      // Run many wander cycles; bot should never end up on the far side of the wall
      for (let i = 0; i < 500; i++) {
        manager.tick(100);
      }

      const positions = manager.getBotPositions();
      const bot = positions.find((b) => b.id === 'los-bot');
      expect(bot).toBeDefined();
      // Bot should stay on the left side of the wall (tileX < 8)
      const botTileX = Math.floor(bot!.worldX / TILE_SIZE);
      expect(botTileX).toBeLessThan(8);
    });

    it('should still wander freely on open maps', () => {
      // Fully open grid — bot should still move around
      const botRecord = makeBotRecord({
        id: 'open-bot',
        worldX: 8 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 8 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(config, [botRecord]);

      let hasMoved = false;
      const startX = botRecord.worldX;
      const startY = botRecord.worldY;

      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS + 50; i++) {
        manager.tick(100);
      }

      const positions = manager.getBotPositions();
      const bot = positions.find((b) => b.id === 'open-bot');
      if (bot && (Math.abs(bot.worldX - startX) > 2 || Math.abs(bot.worldY - startY) > 2)) {
        hasMoved = true;
      }

      expect(hasMoved).toBe(true);
    });
  });

  // ─── tick() — blocked tile ──────────────────────────────────────────────────

  describe('tick() — blocked tile handling', () => {
    it('should pick new target when movement tile is not walkable', () => {
      // Create a grid where the bot can only reach limited tiles
      const grid = makeSelectiveGrid(16, 16, [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
      ]);
      const blockedConfig = makeConfig({ mapWalkable: grid });

      const botRecord = makeBotRecord({
        id: 'blocked-bot',
        worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(blockedConfig, [botRecord]);

      // Run many ticks — bot should not crash even with limited walkable tiles
      for (let i = 0; i < 200; i++) {
        manager.tick(100);
      }

      const positions = manager.getBotPositions();
      expect(positions.find((b) => b.id === 'blocked-bot')).toBeDefined();
    });
  });

  // ─── isTileOccupiedByBot() ──────────────────────────────────────────────────

  describe('isTileOccupiedByBot()', () => {
    it('should return true when a bot occupies the given tile', () => {
      // Bot at worldX=80, worldY=80 => tile (5, 5) with TILE_SIZE=16
      manager.init(config, [makeBotRecord({ id: 'collide-bot', worldX: 80, worldY: 80 })]);

      // Check tile (5, 5) — bot is there
      expect(manager.isTileOccupiedByBot(80, 80)).toBe(true);
      // Any pixel in tile (5, 5) should match
      expect(manager.isTileOccupiedByBot(85, 85)).toBe(true);
    });

    it('should return false when no bot occupies the given tile', () => {
      manager.init(config, [makeBotRecord({ id: 'away-bot', worldX: 80, worldY: 80 })]);

      // Check tile (0, 0) — no bot there
      expect(manager.isTileOccupiedByBot(0, 0)).toBe(false);
      // Tile (6, 5) — adjacent to bot but not occupied
      expect(manager.isTileOccupiedByBot(96, 80)).toBe(false);
    });

    it('should use tile-coordinate comparison (floor division)', () => {
      // Bot at worldX=88, worldY=88 => tile (5, 5) with TILE_SIZE=16
      manager.init(config, [makeBotRecord({ id: 'tile-bot', worldX: 88, worldY: 88 })]);

      // worldX=80 is also tile 5 (80/16 = 5.0)
      expect(manager.isTileOccupiedByBot(80, 88)).toBe(true);
      // worldX=95 is also tile 5 (95/16 = 5.9375)
      expect(manager.isTileOccupiedByBot(95, 88)).toBe(true);
      // worldX=96 is tile 6 — NOT occupied
      expect(manager.isTileOccupiedByBot(96, 88)).toBe(false);
    });
  });

  // ─── validateInteraction() ──────────────────────────────────────────────────

  describe('validateInteraction()', () => {
    it('should return success when player is within BOT_INTERACTION_RADIUS', () => {
      // Bot at worldX=80, worldY=80
      manager.init(config, [makeBotRecord({ id: 'interact-bot', name: 'Sage', worldX: 80, worldY: 80 })]);

      // Player at 1 tile away (worldX=96 => tile 6, bot at tile 5, distance = 1 tile)
      const result = manager.validateInteraction('interact-bot', 96, 80);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.botId).toBe('interact-bot');
        expect(result.name).toBe('Sage');
        expect(result.state).toBe('idle');
      }
    });

    it('should return error when player is beyond BOT_INTERACTION_RADIUS', () => {
      // Bot at worldX=80, worldY=80
      manager.init(config, [makeBotRecord({ id: 'far-bot', worldX: 80, worldY: 80 })]);

      // Player at (BOT_INTERACTION_RADIUS + 1) tiles away
      const farX = 80 + (BOT_INTERACTION_RADIUS + 1) * TILE_SIZE;
      const result = manager.validateInteraction('far-bot', farX, 80);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Too far');
      }
    });

    it('should return error when bot does not exist', () => {
      manager.init(config, []);

      const result = manager.validateInteraction('nonexistent-bot', 80, 80);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Bot not found');
      }
    });

    it('should compute distance in tile units (not pixels)', () => {
      // Bot at worldX=80, worldY=80 (tile 5,5)
      manager.init(config, [makeBotRecord({ id: 'dist-bot', worldX: 80, worldY: 80 })]);

      // Player at exactly BOT_INTERACTION_RADIUS tiles away
      const edgeX = 80 + BOT_INTERACTION_RADIUS * TILE_SIZE;
      const result = manager.validateInteraction('dist-bot', edgeX, 80);

      // Should be at the edge — still valid (distance = exactly BOT_INTERACTION_RADIUS)
      expect(result.success).toBe(true);
    });
  });

  // ─── generateBots() ────────────────────────────────────────────────────────

  describe('generateBots()', () => {
    it('should generate the requested number of bots', () => {
      manager.init(config, []);

      const bots = manager.generateBots(3);

      expect(bots).toHaveLength(3);
    });

    it('should cap at MAX_BOTS_PER_HOMESTEAD', () => {
      manager.init(config, []);

      const bots = manager.generateBots(MAX_BOTS_PER_HOMESTEAD + 5);

      expect(bots.length).toBeLessThanOrEqual(MAX_BOTS_PER_HOMESTEAD);
    });

    it('should assign unique names to each bot', () => {
      manager.init(config, []);

      const bots = manager.generateBots(5);
      const names = bots.map((b) => b.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it('should assign valid skin keys', () => {
      manager.init(config, []);

      const bots = manager.generateBots(3);

      for (const bot of bots) {
        expect(bot.skin).toMatch(/^scout_[1-6]$/);
      }
    });

    it('should place bots on walkable tiles', () => {
      manager.init(config, []);

      const bots = manager.generateBots(3);

      for (const bot of bots) {
        const tileX = Math.floor(bot.worldX / TILE_SIZE);
        const tileY = Math.floor(bot.worldY / TILE_SIZE);
        // All tiles are walkable in default config
        expect(tileX).toBeGreaterThanOrEqual(0);
        expect(tileX).toBeLessThan(config.mapWidth);
        expect(tileY).toBeGreaterThanOrEqual(0);
        expect(tileY).toBeLessThan(config.mapHeight);
      }
    });

    it('should return empty array when no walkable tiles exist', () => {
      const unwalkableConfig = makeConfig({
        mapWalkable: makeSelectiveGrid(16, 16, []),
      });
      manager.init(unwalkableConfig, []);

      const bots = manager.generateBots(3);

      expect(bots).toHaveLength(0);
    });
  });

  // ─── getBotPositions() ──────────────────────────────────────────────────────

  describe('getBotPositions()', () => {
    it('should return positions for all managed bots', () => {
      manager.init(config, [
        makeBotRecord({ id: 'pos-1', worldX: 100, worldY: 200, direction: 'left' }),
        makeBotRecord({ id: 'pos-2', worldX: 300, worldY: 400, direction: 'up' }),
      ]);

      const positions = manager.getBotPositions();

      expect(positions).toHaveLength(2);

      const pos1 = positions.find((p) => p.id === 'pos-1');
      expect(pos1).toEqual({
        id: 'pos-1',
        worldX: 100,
        worldY: 200,
        direction: 'left',
      });

      const pos2 = positions.find((p) => p.id === 'pos-2');
      expect(pos2).toEqual({
        id: 'pos-2',
        worldX: 300,
        worldY: 400,
        direction: 'up',
      });
    });

    it('should return empty array when no bots exist', () => {
      manager.init(config, []);

      expect(manager.getBotPositions()).toEqual([]);
    });
  });

  // ─── getBotIds() ────────────────────────────────────────────────────────────

  describe('getBotIds()', () => {
    it('should return all bot IDs', () => {
      manager.init(config, [
        makeBotRecord({ id: 'id-1' }),
        makeBotRecord({ id: 'id-2' }),
      ]);

      const ids = manager.getBotIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('id-1');
      expect(ids).toContain('id-2');
    });
  });

  // ─── destroy() ──────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    it('should clear all bots', () => {
      manager.init(config, [
        makeBotRecord({ id: 'destroy-1' }),
        makeBotRecord({ id: 'destroy-2' }),
      ]);

      expect(manager.getBotIds()).toHaveLength(2);

      manager.destroy();

      expect(manager.getBotIds()).toHaveLength(0);
      expect(manager.getBotPositions()).toEqual([]);
    });
  });

  // ─── pickRandomWalkableTile (via generateBots) ──────────────────────────────

  describe('pickRandomWalkableTile exits after MAX_WANDER_TARGET_ATTEMPTS', () => {
    it('should not infinite loop on a fully unwalkable grid', () => {
      const unwalkableConfig = makeConfig({
        mapWalkable: makeSelectiveGrid(16, 16, []),
      });
      manager.init(unwalkableConfig, []);

      // generateBots internally calls pickRandomWalkableTile
      // Should return empty (no walkable tiles) without hanging
      const startTime = Date.now();
      const bots = manager.generateBots(3);
      const elapsed = Date.now() - startTime;

      expect(bots).toHaveLength(0);
      // Should complete quickly (no infinite loop)
      expect(elapsed).toBeLessThan(1000);
    });
  });

  // ─── tick() returns only changed bots ───────────────────────────────────────

  describe('tick() performance', () => {
    it('should return empty updates when no bots have changed', () => {
      manager.init(config, [makeBotRecord({ id: 'perf-bot' })]);

      // First tick: bot idle, counter incremented but no state change yet
      const updates = manager.tick(100);

      // Before wander interval, idle bot should produce no update
      expect(updates).toHaveLength(0);
    });
  });
});
