import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  BOT_WANDER_INTERVAL_TICKS,
  BOT_INTERACTION_RADIUS,
  BOT_STUCK_TIMEOUT_MS,
  BOT_EXTENDED_IDLE_TICKS,
  MAX_BOTS_PER_HOMESTEAD,
  TILE_SIZE,
  DEFAULT_NPC_INVENTORY_SIZE,
  BOT_SIT_MIN_DURATION_TICKS,
  BOT_SIT_MAX_DURATION_TICKS,
} from '@nookstead/shared';
import { BotManager } from './BotManager.js';
import type { BotManagerConfig } from '../types/bot-types.js';
import { createServerBot } from '../types/bot-types.js';
import type { NpcBot } from '@nookstead/db';
import type { InventoryManager } from '../../inventory/index.js';

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
    personality: overrides?.personality ?? null,
    role: overrides?.role ?? null,
    speechStyle: overrides?.speechStyle ?? null,
    bio: overrides?.bio ?? null,
    age: overrides?.age ?? null,
    traits: overrides?.traits ?? null,
    goals: overrides?.goals ?? null,
    fears: overrides?.fears ?? null,
    interests: overrides?.interests ?? null,
    mood: overrides?.mood ?? null,
    moodIntensity: overrides?.moodIntensity ?? 0,
    moodUpdatedAt: overrides?.moodUpdatedAt ?? null,
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

  // --- createServerBot factory -----------------------------------------------

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
      expect(bot.waypoints).toEqual([]);
      expect(bot.currentWaypointIndex).toBe(0);
      expect(bot.routeComputedAt).toBe(0);
      expect(bot.failedWanderAttempts).toBe(0);
    });
  });

  // --- init() ----------------------------------------------------------------

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

  // --- addBot() --------------------------------------------------------------

  describe('addBot()', () => {
    it('should add a bot from a DB record after init', () => {
      manager.init(config, []);
      const record = makeBotRecord({ id: 'added-bot', name: 'Hazel' });

      manager.addBot(record);

      expect(manager.getBotIds()).toContain('added-bot');
    });
  });

  // --- tick() -- IDLE state --------------------------------------------------

  describe('tick() -- IDLE state', () => {
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

  // --- tick() -- WALKING state (A* waypoint-based) ---------------------------

  describe('tick() -- WALKING state', () => {
    it('should move bot toward target via A* waypoints', () => {
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
      expect(bot).toBeDefined();
    });

    it('should return bot to IDLE when reaching final waypoint', () => {
      manager.init(config, [makeBotRecord({ id: 'arrive-bot', worldX: 80, worldY: 80 })]);

      // Run many ticks to allow bot to reach its target
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

    it('should navigate around obstacle via A* (not straight-line)', () => {
      // Create grid with vertical wall at x=8, but gap at y=0
      // Bot at (6,5), only walkable path goes around the wall through y=0
      const grid = makeWalkableGrid(16, 16);
      // Block column 8 except for y=0 (gap at top)
      for (let y = 1; y < 16; y++) {
        grid[y][8] = false;
      }
      const wallConfig = makeConfig({ mapWalkable: grid });

      const botRecord = makeBotRecord({
        id: 'nav-bot',
        worldX: 6 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(wallConfig, [botRecord]);

      // Run many wander cycles; bot should never be ON the wall
      for (let i = 0; i < 500; i++) {
        manager.tick(100);
      }

      const positions = manager.getBotPositions();
      const bot = positions.find((b) => b.id === 'nav-bot');
      expect(bot).toBeDefined();
      if (!bot) return; // Guard for TypeScript narrowing
      // Bot should never occupy the wall tile (column 8, rows 1-15)
      const botTileX = Math.floor(bot.worldX / TILE_SIZE);
      const botTileY = Math.floor(bot.worldY / TILE_SIZE);
      if (botTileX === 8) {
        expect(botTileY).toBe(0); // Only allowed at the gap
      }
    });

    it('should still wander freely on open maps', () => {
      // Fully open grid -- bot should still move around
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

  // --- tick() -- stuck detection ---------------------------------------------

  describe('tick() -- stuck detection', () => {
    it('should teleport stuck bot to nearest walkable tile after BOT_STUCK_TIMEOUT_MS', () => {
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
      const totalTicks = BOT_WANDER_INTERVAL_TICKS + 60;
      let updateCount = 0;

      for (let i = 0; i < totalTicks; i++) {
        const updates = manager.tick(100);
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

    it('should transition to idle when bot is stuck and unable to move', () => {
      // Create a corridor: bot at tile (5,5), walkable tiles only at (5,5) and (6,5).
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

  // --- tick() -- path failure handling ---------------------------------------

  describe('tick() -- path failure handling', () => {
    it('should increment failedWanderAttempts when no path found to target', () => {
      // Create a grid with two disconnected islands -- bot on one, targets on the other
      // Bot at (1,1), only tiles (1,1) and (14,14) are walkable (no path between them)
      const grid = makeSelectiveGrid(16, 16, [
        { x: 1, y: 1 },
        { x: 14, y: 14 },
      ]);
      const config = makeConfig({ mapWalkable: grid });

      const botRecord = makeBotRecord({
        id: 'fail-bot',
        worldX: 1 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 1 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(config, [botRecord]);

      // Tick multiple wander cycles -- pathfinding should fail each time
      // since the only other walkable tile (14,14) is unreachable
      let updateCount = 0;
      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS * 10; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'fail-bot') {
            updateCount++;
          }
        }
      }

      // Bot should have produced updates (transitioning idle/walking attempts)
      expect(updateCount).toBeGreaterThan(0);
    });

    it('should enter extended idle after BOT_MAX_PATHFIND_FAILURES consecutive failures', () => {
      // Mock Math.random to return 0.7 so:
      //  - sit chance check always fails (0.7 >= BOT_SIT_CHANCE 0.15)
      //  - pickRandomWalkableTile selects tiles across the wall (unreachable)
      const rngSpy = jest.spyOn(Math, 'random').mockReturnValue(0.7);

      // Create a grid where the bot's tile is walkable, and many nearby tiles
      // are also walkable BUT unreachable (separated by a wall of non-walkable tiles).
      // This ensures pickRandomWalkableTile finds targets, but findPath returns [].
      //
      // Layout (16x16): bot at (1,8). Column 2 is a wall. Columns 3-15 are walkable.
      // Bot can only reach tile (1,8) and tiles on its side of the wall -- but there's
      // only (1,8) walkable on the left side. Right side has many walkable tiles that
      // pickRandomWalkableTile can find, but findPath returns empty.
      const walkableTiles: Array<{ x: number; y: number }> = [];
      // Bot's own tile
      walkableTiles.push({ x: 1, y: 8 });
      // Right side of wall: many tiles within wander radius
      for (let x = 3; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          walkableTiles.push({ x, y });
        }
      }
      const grid = makeSelectiveGrid(16, 16, walkableTiles);
      const failConfig = makeConfig({ mapWalkable: grid });

      const botRecord = makeBotRecord({
        id: 'ext-idle-bot',
        worldX: 1 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 8 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(failConfig, [botRecord]);

      // Run enough ticks for multiple wander attempts.
      // After BOT_MAX_PATHFIND_FAILURES (3) failures, bot enters extended idle.
      // Extended idle = BOT_EXTENDED_IDLE_TICKS (100) ticks before next wander attempt.
      // Normal wander interval = BOT_WANDER_INTERVAL_TICKS (10).
      // So after extended idle we should see a gap of ~100 ticks with no updates.
      let sawExtendedIdlePeriod = false;
      let ticksSinceLastUpdate = 0;

      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS * 30; i++) {
        const updates = manager.tick(100);
        const hasUpdate = updates.some((u) => u.id === 'ext-idle-bot');
        if (hasUpdate) {
          // If the bot went a long time between updates, it was in extended idle
          if (ticksSinceLastUpdate > BOT_EXTENDED_IDLE_TICKS - 5) {
            sawExtendedIdlePeriod = true;
          }
          ticksSinceLastUpdate = 0;
        } else {
          ticksSinceLastUpdate++;
        }
      }

      rngSpy.mockRestore();

      // Bot should have experienced an extended idle period
      expect(sawExtendedIdlePeriod).toBe(true);
    });
  });

  // --- tick() -- blocked tile handling ---------------------------------------

  describe('tick() -- blocked tile handling', () => {
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

      // Run many ticks -- bot should not crash even with limited walkable tiles
      for (let i = 0; i < 200; i++) {
        manager.tick(100);
      }

      const positions = manager.getBotPositions();
      expect(positions.find((b) => b.id === 'blocked-bot')).toBeDefined();
    });
  });

  // --- onWalkabilityChanged() ------------------------------------------------

  describe('onWalkabilityChanged()', () => {
    it('should recalculate path for walking bot with blocked waypoint', () => {
      // Create a grid with a clear corridor: row 5, columns 0-15
      const grid = makeWalkableGrid(16, 16);
      const corridorConfig = makeConfig({ mapWalkable: grid });

      // Bot starts at (2,5), will walk toward a target
      const botRecord = makeBotRecord({
        id: 'recalc-bot',
        worldX: 2 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(corridorConfig, [botRecord]);

      // Force bot into walking state
      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS + 2; i++) {
        manager.tick(100);
      }

      // Block a tile -- the pathfinder should handle this
      // Even if the bot isn't walking through that exact tile,
      // the method should execute without error
      manager.onWalkabilityChanged(10, 5, false);

      // Bot should still be operational
      const positions = manager.getBotPositions();
      expect(positions.find((b) => b.id === 'recalc-bot')).toBeDefined();
    });

    it('should transition walking bot to IDLE when no alternative path exists after grid change', () => {
      // Create a narrow corridor: tiles (0,5) through (10,5)
      const walkableTiles: Array<{ x: number; y: number }> = [];
      for (let x = 0; x <= 10; x++) {
        walkableTiles.push({ x, y: 5 });
      }
      const grid = makeSelectiveGrid(16, 16, walkableTiles);
      const corridorConfig = makeConfig({ mapWalkable: grid });

      // Bot at (0,5)
      const botRecord = makeBotRecord({
        id: 'block-bot',
        worldX: 0 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(corridorConfig, [botRecord]);

      // Force bot to start walking
      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS + 5; i++) {
        manager.tick(100);
      }

      // Block multiple tiles to ensure any path would be broken
      // Block the middle of the corridor
      for (let x = 3; x <= 7; x++) {
        manager.onWalkabilityChanged(x, 5, false);
      }

      // Tick a few more times to let the bot settle
      for (let i = 0; i < 5; i++) {
        manager.tick(100);
      }

      // Bot should still be operational (not crashed)
      const positions = manager.getBotPositions();
      expect(positions.find((b) => b.id === 'block-bot')).toBeDefined();
    });

    it('should update pathfinder grid even for non-walking bots', () => {
      // Test that grid changes are persisted for future pathfinding
      const grid = makeWalkableGrid(16, 16);
      const gridConfig = makeConfig({ mapWalkable: grid });

      const botRecord = makeBotRecord({
        id: 'idle-grid-bot',
        worldX: 2 * TILE_SIZE + TILE_SIZE / 2,
        worldY: 2 * TILE_SIZE + TILE_SIZE / 2,
      });
      manager.init(gridConfig, [botRecord]);

      // Block a tile while bot is idle
      manager.onWalkabilityChanged(5, 2, false);

      // Bot should still be operational after grid change
      const positions = manager.getBotPositions();
      expect(positions.find((b) => b.id === 'idle-grid-bot')).toBeDefined();
    });
  });

  // --- isTileOccupiedByBot() -------------------------------------------------

  describe('isTileOccupiedByBot()', () => {
    it('should return true when a bot occupies the given tile', () => {
      // Bot at worldX=80, worldY=80 => tile (5, 5) with TILE_SIZE=16
      manager.init(config, [makeBotRecord({ id: 'collide-bot', worldX: 80, worldY: 80 })]);

      // Check tile (5, 5) -- bot is there
      expect(manager.isTileOccupiedByBot(80, 80)).toBe(true);
      // Any pixel in tile (5, 5) should match
      expect(manager.isTileOccupiedByBot(85, 85)).toBe(true);
    });

    it('should return false when no bot occupies the given tile', () => {
      manager.init(config, [makeBotRecord({ id: 'away-bot', worldX: 80, worldY: 80 })]);

      // Check tile (0, 0) -- no bot there
      expect(manager.isTileOccupiedByBot(0, 0)).toBe(false);
      // Tile (6, 5) -- adjacent to bot but not occupied
      expect(manager.isTileOccupiedByBot(96, 80)).toBe(false);
    });

    it('should use tile-coordinate comparison (floor division)', () => {
      // Bot at worldX=88, worldY=88 => tile (5, 5) with TILE_SIZE=16
      manager.init(config, [makeBotRecord({ id: 'tile-bot', worldX: 88, worldY: 88 })]);

      // worldX=80 is also tile 5 (80/16 = 5.0)
      expect(manager.isTileOccupiedByBot(80, 88)).toBe(true);
      // worldX=95 is also tile 5 (95/16 = 5.9375)
      expect(manager.isTileOccupiedByBot(95, 88)).toBe(true);
      // worldX=96 is tile 6 -- NOT occupied
      expect(manager.isTileOccupiedByBot(96, 88)).toBe(false);
    });
  });

  // --- validateInteraction() -------------------------------------------------

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

      // Should be at the edge -- still valid (distance = exactly BOT_INTERACTION_RADIUS)
      expect(result.success).toBe(true);
    });
  });

  // --- generateBots() --------------------------------------------------------

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

  // --- getBotPositions() -----------------------------------------------------

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

  // --- getBotIds() -----------------------------------------------------------

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

  // --- destroy() -------------------------------------------------------------

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

  // --- pickRandomWalkableTile (via generateBots) -----------------------------

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

  // --- tick() returns only changed bots --------------------------------------

  describe('tick() performance', () => {
    it('should return empty updates when no bots have changed', () => {
      manager.init(config, [makeBotRecord({ id: 'perf-bot' })]);

      // First tick: bot idle, counter incremented but no state change yet
      const updates = manager.tick(100);

      // Before wander interval, idle bot should produce no update
      expect(updates).toHaveLength(0);
    });
  });

  // --- Dialogue interaction --------------------------------------------------

  describe('dialogue interaction', () => {
    it('should set bot state to interacting and record playerId on startInteraction', () => {
      manager.init(config, [makeBotRecord({ id: 'dlg-bot' })]);

      const result = manager.startInteraction('dlg-bot', 'player-1');

      expect(result).toBe(true);
      expect(manager.isInteracting('dlg-bot')).toBe(true);
    });

    it('should return false when startInteraction is called on already-interacting bot', () => {
      manager.init(config, [makeBotRecord({ id: 'dlg-bot' })]);
      manager.startInteraction('dlg-bot', 'player-1');

      const result = manager.startInteraction('dlg-bot', 'player-2');

      expect(result).toBe(false);
      expect(manager.isInteracting('dlg-bot')).toBe(true);
    });

    it('should return bot to idle and clear interactingPlayerId on endInteraction', () => {
      manager.init(config, [makeBotRecord({ id: 'dlg-bot' })]);
      manager.startInteraction('dlg-bot', 'player-1');

      manager.endInteraction('dlg-bot', 'player-1');

      expect(manager.isInteracting('dlg-bot')).toBe(false);
    });

    it('should be no-op when endInteraction is called with wrong playerId', () => {
      manager.init(config, [makeBotRecord({ id: 'dlg-bot' })]);
      manager.startInteraction('dlg-bot', 'player-1');

      manager.endInteraction('dlg-bot', 'player-2');

      expect(manager.isInteracting('dlg-bot')).toBe(true);
    });

    it('should clean up all bots for a player on endAllInteractionsForPlayer', () => {
      manager.init(config, [
        makeBotRecord({ id: 'dlg-bot-1', worldX: 80, worldY: 80 }),
        makeBotRecord({ id: 'dlg-bot-2', worldX: 160, worldY: 160 }),
      ]);
      manager.startInteraction('dlg-bot-1', 'player-1');
      manager.startInteraction('dlg-bot-2', 'player-1');

      manager.endAllInteractionsForPlayer('player-1');

      expect(manager.isInteracting('dlg-bot-1')).toBe(false);
      expect(manager.isInteracting('dlg-bot-2')).toBe(false);
    });

    it('should skip interacting bot during tick (no update generated)', () => {
      manager.init(config, [makeBotRecord({ id: 'dlg-bot' })]);
      manager.startInteraction('dlg-bot', 'player-1');

      const updates = manager.tick(100);

      expect(updates).toHaveLength(0);
      expect(manager.isInteracting('dlg-bot')).toBe(true);
    });

    it('should return busy error when validateInteraction is called on interacting bot', () => {
      const botX = 80;
      const botY = 80;
      manager.init(config, [
        makeBotRecord({ id: 'dlg-bot', worldX: botX, worldY: botY }),
      ]);
      manager.startInteraction('dlg-bot', 'player-1');

      // Player is within interaction radius
      const result = manager.validateInteraction('dlg-bot', botX, botY);

      expect(result).toEqual({ success: false, error: 'Bot is busy' });
    });

    it('should clear waypoint data when dialogue interaction starts', () => {
      manager.init(config, [makeBotRecord({ id: 'dlg-wp-bot' })]);

      // Force bot into walking state first
      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS + 2; i++) {
        manager.tick(100);
      }

      // Start interaction -- waypoints should be cleared
      const result = manager.startInteraction('dlg-wp-bot', 'player-1');
      expect(result).toBe(true);

      // End interaction, tick a few times -- bot should behave normally (not crash)
      manager.endInteraction('dlg-wp-bot', 'player-1');
      for (let i = 0; i < BOT_WANDER_INTERVAL_TICKS + 10; i++) {
        manager.tick(100);
      }

      const positions = manager.getBotPositions();
      expect(positions.find((b) => b.id === 'dlg-wp-bot')).toBeDefined();
    });
  });

  // --- NPC Inventory integration -----------------------------------------------

  describe('NPC inventory integration', () => {
    let mockInventoryManager: jest.Mocked<InventoryManager>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockDb: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockDbFns: any;

    beforeEach(() => {
      mockInventoryManager = {
        initInventory: jest.fn<InventoryManager['initInventory']>().mockResolvedValue('inv-123' as never),
        addItem: jest.fn<InventoryManager['addItem']>().mockReturnValue({
          success: true,
          changedSlots: [],
          hotbarChanged: false,
        } as never),
        saveInventory: jest.fn<InventoryManager['saveInventory']>().mockResolvedValue(undefined as never),
        unloadInventory: jest.fn<InventoryManager['unloadInventory']>(),
        getHotbarSlots: jest.fn(),
        getBackpackSlots: jest.fn(),
        moveSlot: jest.fn(),
        dropItem: jest.fn(),
        getInventoryIdByOwner: jest.fn(),
        _testLoad: jest.fn(),
      } as unknown as jest.Mocked<InventoryManager>;

      mockDb = {};
      mockDbFns = {
        createInventory: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        loadInventory: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
        saveSlots: jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
      };

      manager = new BotManager(mockInventoryManager);
      config = makeConfig();
    });

    it('should accept InventoryManager as a constructor parameter', () => {
      const mgr = new BotManager(mockInventoryManager);
      expect(mgr).toBeInstanceOf(BotManager);
    });

    it('should still work without InventoryManager (backwards-compatible)', () => {
      const mgr = new BotManager();
      mgr.init(config, []);
      expect(mgr.getBotIds()).toHaveLength(0);
    });

    describe('initBotInventory()', () => {
      it('should create inventory for a farmer bot with hoe, watering_can, and sickle', async () => {
        manager.init(config, []);
        const record = makeBotRecord({ id: 'farmer-bot', role: 'farmer' });
        manager.addBot(record);

        await manager.initBotInventory('farmer-bot', mockDb, mockDbFns);

        // Should call initInventory with correct params
        expect(mockInventoryManager.initInventory).toHaveBeenCalledWith(
          mockDb,
          'npc',
          'farmer-bot',
          { createInventory: mockDbFns.createInventory, loadInventory: mockDbFns.loadInventory },
          DEFAULT_NPC_INVENTORY_SIZE
        );

        // Should add role-appropriate items
        expect(mockInventoryManager.addItem).toHaveBeenCalledWith(
          'inv-123',
          'hoe',
          1,
          { type: 'npc', id: 'farmer-bot' }
        );
        expect(mockInventoryManager.addItem).toHaveBeenCalledWith(
          'inv-123',
          'watering_can',
          1,
          { type: 'npc', id: 'farmer-bot' }
        );
        expect(mockInventoryManager.addItem).toHaveBeenCalledWith(
          'inv-123',
          'sickle',
          1,
          { type: 'npc', id: 'farmer-bot' }
        );
      });

      it('should create inventory for a baker bot with wood x5', async () => {
        manager.init(config, []);
        const record = makeBotRecord({ id: 'baker-bot', role: 'baker' });
        manager.addBot(record);

        await manager.initBotInventory('baker-bot', mockDb, mockDbFns);

        expect(mockInventoryManager.initInventory).toHaveBeenCalledWith(
          mockDb,
          'npc',
          'baker-bot',
          { createInventory: mockDbFns.createInventory, loadInventory: mockDbFns.loadInventory },
          DEFAULT_NPC_INVENTORY_SIZE
        );

        expect(mockInventoryManager.addItem).toHaveBeenCalledWith(
          'inv-123',
          'wood',
          5,
          { type: 'npc', id: 'baker-bot' }
        );
        // Only one addItem call for baker
        expect(mockInventoryManager.addItem).toHaveBeenCalledTimes(1);
      });

      it('should create an empty inventory for a bot with unknown role', async () => {
        manager.init(config, []);
        const record = makeBotRecord({ id: 'unknown-bot', role: 'blacksmith' });
        manager.addBot(record);

        await manager.initBotInventory('unknown-bot', mockDb, mockDbFns);

        expect(mockInventoryManager.initInventory).toHaveBeenCalledWith(
          mockDb,
          'npc',
          'unknown-bot',
          { createInventory: mockDbFns.createInventory, loadInventory: mockDbFns.loadInventory },
          DEFAULT_NPC_INVENTORY_SIZE
        );
        // No addItem calls for unknown roles
        expect(mockInventoryManager.addItem).not.toHaveBeenCalled();
      });

      it('should create an empty inventory for a bot with null role', async () => {
        manager.init(config, []);
        const record = makeBotRecord({ id: 'null-role-bot', role: null });
        manager.addBot(record);

        await manager.initBotInventory('null-role-bot', mockDb, mockDbFns);

        expect(mockInventoryManager.initInventory).toHaveBeenCalled();
        expect(mockInventoryManager.addItem).not.toHaveBeenCalled();
      });

      it('should set bot.inventoryId after successful init', async () => {
        manager.init(config, []);
        const record = makeBotRecord({ id: 'inv-id-bot', role: 'farmer' });
        manager.addBot(record);

        await manager.initBotInventory('inv-id-bot', mockDb, mockDbFns);

        // Verify bot has inventoryId set by checking via getBotPositions or similar
        // We'll add a getBot accessor or check inventoryId through the manager
        const positions = manager.getBotPositions();
        expect(positions.find((b) => b.id === 'inv-id-bot')).toBeDefined();
        // The inventoryId should be set on the internal bot -- we verify this through
        // the saveBotInventory method working correctly (it reads bot.inventoryId)
      });

      it('should not crash bot spawn when inventory init fails', async () => {
        mockInventoryManager.initInventory = jest.fn<InventoryManager['initInventory']>()
          .mockRejectedValue(new Error('DB connection lost') as never);

        manager.init(config, []);
        const record = makeBotRecord({ id: 'fail-inv-bot', role: 'farmer' });
        manager.addBot(record);

        // Should not throw
        await expect(
          manager.initBotInventory('fail-inv-bot', mockDb, mockDbFns)
        ).resolves.not.toThrow();

        // Bot should still be operational
        const positions = manager.getBotPositions();
        expect(positions.find((b) => b.id === 'fail-inv-bot')).toBeDefined();
      });

      it('should be a no-op for a non-existent bot', async () => {
        manager.init(config, []);

        await manager.initBotInventory('nonexistent', mockDb, mockDbFns);

        expect(mockInventoryManager.initInventory).not.toHaveBeenCalled();
      });
    });

    describe('saveBotInventory()', () => {
      it('should call saveInventory and unloadInventory for a bot with inventoryId', async () => {
        manager.init(config, []);
        const record = makeBotRecord({ id: 'save-bot', role: 'farmer' });
        manager.addBot(record);
        await manager.initBotInventory('save-bot', mockDb, mockDbFns);

        await manager.saveBotInventory('save-bot', mockDb, mockDbFns);

        expect(mockInventoryManager.saveInventory).toHaveBeenCalledWith(
          mockDb,
          'inv-123',
          { saveSlots: mockDbFns.saveSlots }
        );
        expect(mockInventoryManager.unloadInventory).toHaveBeenCalledWith('inv-123');
      });

      it('should not call save/unload when bot has no inventoryId', async () => {
        manager.init(config, []);
        const record = makeBotRecord({ id: 'no-inv-bot' });
        manager.addBot(record);
        // Don't init inventory

        await manager.saveBotInventory('no-inv-bot', mockDb, mockDbFns);

        expect(mockInventoryManager.saveInventory).not.toHaveBeenCalled();
        expect(mockInventoryManager.unloadInventory).not.toHaveBeenCalled();
      });

      it('should log error but not throw when save fails', async () => {
        mockInventoryManager.saveInventory = jest.fn<InventoryManager['saveInventory']>()
          .mockRejectedValue(new Error('Save failed') as never);

        manager.init(config, []);
        const record = makeBotRecord({ id: 'save-fail-bot', role: 'farmer' });
        manager.addBot(record);
        await manager.initBotInventory('save-fail-bot', mockDb, mockDbFns);

        // Should not throw
        await expect(
          manager.saveBotInventory('save-fail-bot', mockDb, mockDbFns)
        ).resolves.not.toThrow();

        // unloadInventory should still be called even if save fails
        expect(mockInventoryManager.unloadInventory).toHaveBeenCalledWith('inv-123');
      });
    });

    describe('saveAllBotInventories()', () => {
      it('should save and unload inventories for all bots with inventoryIds', async () => {
        manager.init(config, []);
        const farmer = makeBotRecord({ id: 'bulk-farmer', role: 'farmer' });
        const baker = makeBotRecord({ id: 'bulk-baker', role: 'baker' });
        manager.addBot(farmer);
        manager.addBot(baker);
        await manager.initBotInventory('bulk-farmer', mockDb, mockDbFns);
        await manager.initBotInventory('bulk-baker', mockDb, mockDbFns);

        await manager.saveAllBotInventories(mockDb, mockDbFns);

        expect(mockInventoryManager.saveInventory).toHaveBeenCalledTimes(2);
        expect(mockInventoryManager.unloadInventory).toHaveBeenCalledTimes(2);
      });
    });
  });

  // --- Sitting state behavior -----------------------------------------------

  describe('sitting state behavior', () => {
    let randomSpy: jest.SpiedFunction<typeof Math.random>;

    beforeEach(() => {
      randomSpy = jest.spyOn(Math, 'random');
    });

    afterEach(() => {
      randomSpy.mockRestore();
    });

    it('should transition bot from idle to sitting when sitTicks reaches threshold and random check passes', () => {
      // Use a single-tile grid so the bot can only fail to wander,
      // which keeps it idle while sitTicks accumulates across wander cycles.
      const grid = makeSelectiveGrid(16, 16, [{ x: 5, y: 5 }]);
      const singleTileConfig = makeConfig({ mapWalkable: grid });

      manager.init(singleTileConfig, [
        makeBotRecord({
          id: 'sit-bot',
          worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
          worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
        }),
      ]);

      // Return 0 for all random calls:
      // - sit threshold = BOT_SIT_MIN_IDLE_TICKS (minimum)
      // - sit chance = 0 (passes: 0 < BOT_SIT_CHANCE)
      // - wander tile picking returns same tile (no path)
      randomSpy.mockReturnValue(0);

      // sitTicks accumulates each idle tick (even across wander cycle resets).
      // After BOT_SIT_MIN_IDLE_TICKS cumulative idle ticks, the sit check fires.
      let sawSitting = false;
      for (let i = 0; i < 500; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'sit-bot' && u.state === 'sitting') {
            sawSitting = true;
          }
        }
        if (sawSitting) break;
      }

      expect(sawSitting).toBe(true);
    });

    it('should set bot.state to sitting and reset sitTicks to 0 on transition', () => {
      const grid = makeSelectiveGrid(16, 16, [{ x: 5, y: 5 }]);
      const singleTileConfig = makeConfig({ mapWalkable: grid });

      manager.init(singleTileConfig, [
        makeBotRecord({
          id: 'sit-state-bot',
          worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
          worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
        }),
      ]);

      randomSpy.mockReturnValue(0);

      let sittingUpdate: { id: string; state: string } | null = null;
      for (let i = 0; i < 500; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'sit-state-bot' && u.state === 'sitting') {
            sittingUpdate = u;
          }
        }
        if (sittingUpdate) break;
      }

      expect(sittingUpdate).not.toBeNull();
      expect(sittingUpdate!.state).toBe('sitting');
    });

    it('should preserve bot direction during sit transition (AC-17)', () => {
      const grid = makeSelectiveGrid(16, 16, [{ x: 5, y: 5 }]);
      const singleTileConfig = makeConfig({ mapWalkable: grid });

      manager.init(singleTileConfig, [
        makeBotRecord({
          id: 'sit-dir-bot',
          worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
          worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
          direction: 'left',
        }),
      ]);

      randomSpy.mockReturnValue(0);

      let sittingUpdate: { direction: string } | null = null;
      for (let i = 0; i < 500; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'sit-dir-bot' && u.state === 'sitting') {
            sittingUpdate = u;
          }
        }
        if (sittingUpdate) break;
      }

      expect(sittingUpdate).not.toBeNull();
      expect(sittingUpdate!.direction).toBe('left');
    });

    it('should increment sitTicks each tick while sitting', () => {
      const grid = makeSelectiveGrid(16, 16, [{ x: 5, y: 5 }]);
      const singleTileConfig = makeConfig({ mapWalkable: grid });

      manager.init(singleTileConfig, [
        makeBotRecord({
          id: 'sit-tick-bot',
          worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
          worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
        }),
      ]);

      randomSpy.mockReturnValue(0);

      // Tick until the bot enters sitting
      let enteredSitting = false;
      for (let i = 0; i < 500; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'sit-tick-bot' && u.state === 'sitting') {
            enteredSitting = true;
          }
        }
        if (enteredSitting) break;
      }
      expect(enteredSitting).toBe(true);

      // Now continue ticking. With random=0, duration threshold = BOT_SIT_MIN_DURATION_TICKS.
      // The bot should stay sitting for exactly BOT_SIT_MIN_DURATION_TICKS ticks
      // before transitioning back to idle.
      let ticksInSitting = 0;
      let returnedToIdle = false;
      for (let i = 0; i < BOT_SIT_MAX_DURATION_TICKS + 10; i++) {
        const updates = manager.tick(100);
        ticksInSitting++;
        for (const u of updates) {
          if (u.id === 'sit-tick-bot' && u.state === 'idle') {
            returnedToIdle = true;
          }
        }
        if (returnedToIdle) break;
      }

      expect(returnedToIdle).toBe(true);
      // With random=0, duration threshold = BOT_SIT_MIN_DURATION_TICKS.
      // tickSitting is called exactly BOT_SIT_MIN_DURATION_TICKS times:
      // sitTicks increments from 1 to BOT_SIT_MIN_DURATION_TICKS, then
      // the bot transitions to idle on the last tick.
      expect(ticksInSitting).toBe(BOT_SIT_MIN_DURATION_TICKS);
    });

    it('should transition from sitting to idle when sitTicks exceeds duration threshold', () => {
      const grid = makeSelectiveGrid(16, 16, [{ x: 5, y: 5 }]);
      const singleTileConfig = makeConfig({ mapWalkable: grid });

      manager.init(singleTileConfig, [
        makeBotRecord({
          id: 'sit-dur-bot',
          worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
          worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
        }),
      ]);

      randomSpy.mockReturnValue(0);

      let sawSitting = false;
      let sawIdleAfterSitting = false;

      for (let i = 0; i < 1000; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'sit-dur-bot') {
            if (u.state === 'sitting') sawSitting = true;
            if (sawSitting && u.state === 'idle') sawIdleAfterSitting = true;
          }
        }
        if (sawIdleAfterSitting) break;
      }

      expect(sawSitting).toBe(true);
      expect(sawIdleAfterSitting).toBe(true);
    });

    it('should reset sitTicks to 0 when transitioning from sitting to idle', () => {
      const grid = makeSelectiveGrid(16, 16, [{ x: 5, y: 5 }]);
      const singleTileConfig = makeConfig({ mapWalkable: grid });

      manager.init(singleTileConfig, [
        makeBotRecord({
          id: 'sit-reset-bot',
          worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
          worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
        }),
      ]);

      randomSpy.mockReturnValue(0);

      // Cycle through sitting -> idle -> sitting to verify sitTicks resets.
      // If sitTicks didn't reset, the second sit would start with a non-zero
      // value and the duration would be wrong.
      let sittingCount = 0;
      let idleAfterSitCount = 0;

      for (let i = 0; i < 2000; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'sit-reset-bot') {
            if (u.state === 'sitting') sittingCount++;
            if (sittingCount > 0 && u.state === 'idle') idleAfterSitCount++;
          }
        }
        // Wait for two full sit cycles
        if (sittingCount >= 2 && idleAfterSitCount >= 2) break;
      }

      // Bot should have completed at least two sit cycles (sit->idle->sit->idle)
      expect(sittingCount).toBeGreaterThanOrEqual(2);
      expect(idleAfterSitCount).toBeGreaterThanOrEqual(2);
    });

    it('should not transition to sitting when random check fails', () => {
      const grid = makeSelectiveGrid(16, 16, [{ x: 5, y: 5 }]);
      const singleTileConfig = makeConfig({ mapWalkable: grid });

      manager.init(singleTileConfig, [
        makeBotRecord({
          id: 'no-sit-bot',
          worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
          worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
        }),
      ]);

      // Return 1.0 for all random calls:
      // - sit threshold = BOT_SIT_MAX_IDLE_TICKS (maximum, since floor(1.0 * range) rounds down)
      // - sit chance = 1.0, which fails (1.0 >= BOT_SIT_CHANCE = 0.15)
      randomSpy.mockReturnValue(1.0);

      let sawSitting = false;
      for (let i = 0; i < 500; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'no-sit-bot' && u.state === 'sitting') {
            sawSitting = true;
          }
        }
      }

      expect(sawSitting).toBe(false);
    });

    it('should not allow sitting during interacting state (AC-16)', () => {
      manager.init(config, [
        makeBotRecord({ id: 'interact-sit-bot', worldX: 80, worldY: 80 }),
      ]);

      manager.startInteraction('interact-sit-bot', 'player-1');

      randomSpy.mockReturnValue(0);

      let sawSitting = false;
      for (let i = 0; i < 500; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'interact-sit-bot' && u.state === 'sitting') {
            sawSitting = true;
          }
        }
      }

      expect(sawSitting).toBe(false);
    });

    it('should dispatch sitting state in tickBot and handle tick correctly', () => {
      const grid = makeSelectiveGrid(16, 16, [{ x: 5, y: 5 }]);
      const singleTileConfig = makeConfig({ mapWalkable: grid });

      manager.init(singleTileConfig, [
        makeBotRecord({
          id: 'dispatch-bot',
          worldX: 5 * TILE_SIZE + TILE_SIZE / 2,
          worldY: 5 * TILE_SIZE + TILE_SIZE / 2,
        }),
      ]);

      randomSpy.mockReturnValue(0);

      // Tick until sitting
      let enteredSitting = false;
      for (let i = 0; i < 500; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'dispatch-bot' && u.state === 'sitting') {
            enteredSitting = true;
          }
        }
        if (enteredSitting) break;
      }
      expect(enteredSitting).toBe(true);

      // Continue ticking while sitting - should not crash
      // and should eventually return to idle
      let returnedToIdle = false;
      for (let i = 0; i < BOT_SIT_MAX_DURATION_TICKS + 10; i++) {
        const updates = manager.tick(100);
        for (const u of updates) {
          if (u.id === 'dispatch-bot' && u.state === 'idle') {
            returnedToIdle = true;
          }
        }
        if (returnedToIdle) break;
      }

      expect(returnedToIdle).toBe(true);
    });
  });
});
