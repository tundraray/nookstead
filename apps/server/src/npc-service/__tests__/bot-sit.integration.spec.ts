// Bot Sit Action Integration Test - Design Doc: design-026-player-sit-action.md
// Generated: 2026-03-26 | Budget Used: 3/3 integration (combined with player-sit-sync)
//
// Tests BotManager sit behavior through the full tick lifecycle:
//   - BotManager.tickIdle() -> sit chance check -> transitionToSitting()
//   - BotManager.tickSitting() -> duration expiry -> transitionToIdle()
//   - BotUpdate state field returned for Colyseus schema sync
//   - Interaction state blocking sit transitions
//
// System under test: BotManager + Pathfinder + NPCMovementEngine (real)
// Mock boundaries: Math.random (deterministic sit chance/threshold)

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  TILE_SIZE,
  BOT_SIT_MIN_IDLE_TICKS,
  BOT_SIT_MAX_IDLE_TICKS,
  BOT_SIT_MIN_DURATION_TICKS,
} from '@nookstead/shared';
import { BotManager } from '../lifecycle/BotManager.js';
import type { BotManagerConfig, BotUpdate } from '../types/bot-types.js';
import type { NpcBot } from '@nookstead/db';

/* ------------------------------------------------------------------ */
/*  Controlled Math.random                                             */
/*  Uses a wrapper that returns a controlled value when set,           */
/*  otherwise delegates to the real implementation. This avoids        */
/*  breaking source-map's internal quicksort which uses Math.random.   */
/* ------------------------------------------------------------------ */
const originalRandom = Math.random.bind(Math);
let controlledRandomValue: number | null = null;

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

/** Single-tile walkability grid: bot can't wander (no A* path from origin to origin). */
function makeSingleTileConfig(): BotManagerConfig {
  return {
    mapWalkable: [[true]],
    mapWidth: 1,
    mapHeight: 1,
    mapId: 'sit-integration-map',
    tickIntervalMs: 100,
  };
}

/** Create a NpcBot DB record positioned at the center of tile (0,0). */
function makeBotRecord(id: string, overrides?: Partial<NpcBot>): NpcBot {
  return {
    id,
    mapId: 'sit-integration-map',
    name: 'TestBot',
    skin: 'scout_1',
    worldX: Math.floor(TILE_SIZE / 2),
    worldY: Math.floor(TILE_SIZE / 2),
    direction: overrides?.direction ?? 'down',
    personality: null,
    role: null,
    speechStyle: null,
    bio: null,
    age: null,
    traits: null,
    goals: null,
    fears: null,
    interests: null,
    mood: null,
    moodIntensity: 0,
    moodUpdatedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/**
 * Call BotManager.tick() N times and collect all updates.
 * Returns the full list of BotUpdates produced across all ticks.
 */
function advanceTicks(manager: BotManager, n: number): BotUpdate[] {
  const allUpdates: BotUpdate[] = [];
  for (let i = 0; i < n; i++) {
    const updates = manager.tick(100);
    allUpdates.push(...updates);
  }
  return allUpdates;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe('Bot Sit Action - BotManager Integration', () => {
  const BOT_ID = 'bot-sit-int';
  let manager: BotManager;

  beforeEach(() => {
    controlledRandomValue = null;
    Math.random = () => controlledRandomValue ?? originalRandom();

    manager = new BotManager();
    manager.init(makeSingleTileConfig(), [makeBotRecord(BOT_ID)]);
  });

  afterEach(() => {
    controlledRandomValue = null;
    Math.random = originalRandom;
    manager.destroy();
    jest.restoreAllMocks();
  });

  /* ================================================================ */
  /*  INT-4: Bot idle-to-sitting transition (AC-13 + AC-14 + AC-15)  */
  /* ================================================================ */

  // AC-13: Bot transitions to sitting after random idle tick threshold with probability check
  // AC-14: ChunkBot.state set to 'sitting', direction preserved
  // AC-15: Bot returns to idle after random sitting duration
  it('should transition bot from idle to sitting after tick threshold and back to idle after duration', () => {
    // Math.random = 0 yields:
    //   sit threshold = BOT_SIT_MIN_IDLE_TICKS (floor(0 * range) = 0 + min)
    //   sit chance = 0 < 0.15 (passes BOT_SIT_CHANCE check)
    //   sit duration = BOT_SIT_MIN_DURATION_TICKS (floor(0 * range) = 0 + min)
    //   wander tile pick returns same tile -> no A* path -> stays idle
    controlledRandomValue = 0;

    // Phase 1: Advance idle ticks until sit triggers.
    // On a single-tile map the bot can't wander, so sitTicks accumulates
    // continuously. After BOT_SIT_MIN_IDLE_TICKS, the sit check fires.
    const phase1Updates = advanceTicks(manager, BOT_SIT_MIN_IDLE_TICKS);

    // Verify: bot transitioned to sitting
    const sittingUpdate = phase1Updates.find(
      (u) => u.id === BOT_ID && u.state === 'sitting'
    );
    expect(sittingUpdate).toBeDefined();
    // Direction preserved through sit transition (AC-14 / AC-17)
    expect(sittingUpdate!.direction).toBe('down');

    // Phase 2: Advance sitting ticks until auto-stand.
    // transitionToSitting resets sitTicks to 0. tickSitting increments
    // sitTicks each tick. After BOT_SIT_MIN_DURATION_TICKS, bot stands.
    const phase2Updates = advanceTicks(manager, BOT_SIT_MIN_DURATION_TICKS);

    // Verify: bot returned to idle
    const idleUpdate = phase2Updates.find(
      (u) => u.id === BOT_ID && u.state === 'idle'
    );
    expect(idleUpdate).toBeDefined();

    // Verify: the full lifecycle completed (sitting was not skipped)
    expect(sittingUpdate).toBeDefined();
    expect(idleUpdate).toBeDefined();
  });

  /* ================================================================ */
  /*  INT-5: Bot sit blocked during interaction (AC-16)               */
  /* ================================================================ */

  // AC-16: Bot in 'interacting' state shall not transition to sitting
  it('should not transition bot to sitting while in interacting state', () => {
    // Put bot into interacting state via BotManager API
    const started = manager.startInteraction(BOT_ID, 'player-1');
    expect(started).toBe(true);
    expect(manager.isInteracting(BOT_ID)).toBe(true);

    // Configure maximum sit-favorable conditions
    controlledRandomValue = 0;

    // Advance many ticks (well beyond max idle threshold)
    const updates = advanceTicks(manager, BOT_SIT_MAX_IDLE_TICKS + 10);

    // No updates should have been produced: tickBot returns false for interacting bots
    const sittingUpdates = updates.filter(
      (u) => u.id === BOT_ID && u.state === 'sitting'
    );
    expect(sittingUpdates).toHaveLength(0);

    // Bot should still be interacting
    expect(manager.isInteracting(BOT_ID)).toBe(true);
  });
});
