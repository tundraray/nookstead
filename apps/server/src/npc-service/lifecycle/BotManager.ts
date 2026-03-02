import {
  BOT_SPEED,
  BOT_WANDER_RADIUS,
  BOT_WANDER_INTERVAL_TICKS,
  BOT_INTERACTION_RADIUS,
  BOT_STUCK_TIMEOUT_MS,
  MAX_WANDER_TARGET_ATTEMPTS,
  TILE_SIZE,
  BOT_NAMES,
  MAX_BOTS_PER_HOMESTEAD,
  AVAILABLE_SKINS,
} from '@nookstead/shared';
import type {
  ServerBot,
  BotUpdate,
  BotPosition,
  InteractionResult,
  BotManagerConfig,
} from '../types/bot-types.js';
import { createServerBot } from '../types/bot-types.js';
import type { NpcBot } from '@nookstead/db';

/**
 * Manages all NPC bot companions for a single homestead (ChunkRoom instance).
 *
 * Responsibilities:
 * - Initialize bots from DB records (loadBots result)
 * - Generate new bots for first-time homestead visits
 * - Run the IDLE/WALKING state machine each tick
 * - Detect stuck bots and pick new wander targets
 * - Validate player interactions (NPC_INTERACT)
 * - Report changed bot states (BotUpdate[]) for Colyseus schema sync
 * - Provide bot positions for DB persistence on despawn
 *
 * BotManager is deliberately decoupled from Colyseus. ChunkRoom owns BotManager
 * and applies BotUpdate[] to state.bots after each tick.
 */
export class BotManager {
  private bots = new Map<string, ServerBot>();
  private config!: BotManagerConfig;

  /**
   * Initialize BotManager with map config and populate bots from DB records.
   * If records is empty (first visit), call generateBots() to create new bots.
   *
   * @param config - Map configuration (walkability grid, dimensions, mapId)
   * @param records - Bot records loaded from DB (may be empty on first visit)
   */
  init(config: BotManagerConfig, records: NpcBot[]): void {
    this.config = config;
    this.bots.clear();

    for (const record of records) {
      const bot = createServerBot(record);
      this.bots.set(bot.id, bot);
    }

    console.log(`[BotManager] init: ${this.bots.size} bots loaded`);
  }

  /**
   * Generate N new bots with unique names and random skins.
   * Does not persist to DB — ChunkRoom calls createBot() for each result.
   *
   * Returns an array of partial bot data for ChunkRoom to persist.
   * Count is capped at MAX_BOTS_PER_HOMESTEAD.
   */
  generateBots(
    count: number,
    spawnCenterX?: number,
    spawnCenterY?: number
  ): Array<{ name: string; skin: string; worldX: number; worldY: number }> {
    const safeCount = Math.min(count, MAX_BOTS_PER_HOMESTEAD);
    const results: Array<{
      name: string;
      skin: string;
      worldX: number;
      worldY: number;
    }> = [];
    const usedNames = new Set<string>();

    // Use provided spawn center (player's spawn pixel position) or fall back to map center
    const centerTileX =
      spawnCenterX !== undefined
        ? Math.floor(spawnCenterX / TILE_SIZE)
        : Math.floor(this.config.mapWidth / 2);
    const centerTileY =
      spawnCenterY !== undefined
        ? Math.floor(spawnCenterY / TILE_SIZE)
        : Math.floor(this.config.mapHeight / 2);

    for (let i = 0; i < safeCount; i++) {
      const name = this.pickUniqueName(usedNames);
      const skin =
        AVAILABLE_SKINS[Math.floor(Math.random() * AVAILABLE_SKINS.length)];

      // Try near spawn center first, then fall back to a broader scan
      let spawnTile = this.pickRandomWalkableTile(centerTileX, centerTileY);
      if (!spawnTile) {
        spawnTile = this.findAnyWalkableTile();
      }

      if (!spawnTile) {
        console.warn(
          '[BotManager] generateBots: no walkable tile found for bot',
          i
        );
        continue;
      }

      usedNames.add(name);
      results.push({
        name,
        skin,
        worldX: spawnTile.tileX * TILE_SIZE + TILE_SIZE / 2,
        worldY: spawnTile.tileY * TILE_SIZE + TILE_SIZE / 2,
      });
    }

    return results;
  }

  /**
   * Add a bot to the manager after it has been persisted to DB.
   * Called by ChunkRoom after createBot() returns a DB record.
   */
  addBot(record: NpcBot): void {
    const bot = createServerBot(record);
    this.bots.set(bot.id, bot);
    console.log(`[BotManager] Bot spawned: ${bot.id} "${bot.name}"`);
  }

  /**
   * Run one simulation tick for all bots.
   * Returns an array of BotUpdate for bots whose state changed.
   * Called by ChunkRoom's setSimulationInterval callback.
   *
   * @param deltaMs - Milliseconds since last tick
   */
  tick(deltaMs: number): BotUpdate[] {
    const updates: BotUpdate[] = [];
    const now = Date.now();

    for (const bot of this.bots.values()) {
      const changed = this.tickBot(bot, deltaMs, now);
      if (changed) {
        updates.push({
          id: bot.id,
          worldX: bot.worldX,
          worldY: bot.worldY,
          direction: bot.direction,
          state: bot.state,
        });
      }
    }

    return updates;
  }

  /**
   * Check whether a given world position is occupied by any bot.
   * Converts pixel coordinates to tile coordinates and compares.
   *
   * @param worldX - Player's new world X position (pixels)
   * @param worldY - Player's new world Y position (pixels)
   */
  isTileOccupiedByBot(worldX: number, worldY: number): boolean {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);

    for (const bot of this.bots.values()) {
      const botTileX = Math.floor(bot.worldX / TILE_SIZE);
      const botTileY = Math.floor(bot.worldY / TILE_SIZE);
      if (botTileX === tileX && botTileY === tileY) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate an NPC_INTERACT request from a player.
   *
   * @param botId - ID of the bot the player is interacting with
   * @param playerX - Player's current world X (pixels)
   * @param playerY - Player's current world Y (pixels)
   */
  validateInteraction(
    botId: string,
    playerX: number,
    playerY: number
  ): InteractionResult {
    const bot = this.bots.get(botId);

    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    if (this.isInteracting(botId)) {
      return { success: false, error: 'Bot is busy' };
    }

    const dx = (playerX - bot.worldX) / TILE_SIZE;
    const dy = (playerY - bot.worldY) / TILE_SIZE;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > BOT_INTERACTION_RADIUS) {
      return {
        success: false,
        error: `Too far from bot (distance: ${distance.toFixed(1)} tiles, max: ${BOT_INTERACTION_RADIUS})`,
      };
    }

    return {
      success: true,
      botId: bot.id,
      name: bot.name,
      state: bot.state,
    };
  }

  /**
   * Get current positions of all bots for DB persistence.
   * Called by ChunkRoom when the last player leaves.
   */
  getBotPositions(): BotPosition[] {
    return Array.from(this.bots.values()).map((bot) => ({
      id: bot.id,
      worldX: bot.worldX,
      worldY: bot.worldY,
      direction: bot.direction,
    }));
  }

  /**
   * Get all bot IDs currently managed.
   */
  getBotIds(): string[] {
    return Array.from(this.bots.keys());
  }

  /**
   * Start a dialogue interaction between a player and a bot.
   * Sets bot state to 'interacting' and records the player session ID.
   *
   * @returns true if interaction started, false if bot is busy or not found
   */
  startInteraction(botId: string, playerId: string): boolean {
    const bot = this.bots.get(botId);
    if (!bot || bot.state === 'interacting') {
      return false;
    }

    bot.state = 'interacting';
    bot.interactingPlayerId = playerId;
    bot.targetX = null;
    bot.targetY = null;
    bot.idleTicks = 0;
    bot.walkStartTime = null;

    return true;
  }

  /**
   * End a dialogue interaction. Transitions bot back to idle.
   * No-op if playerId doesn't match the current interacting player.
   */
  endInteraction(botId: string, playerId: string): void {
    const bot = this.bots.get(botId);
    if (!bot || bot.interactingPlayerId !== playerId) {
      return;
    }

    this.transitionToIdle(bot);
    bot.interactingPlayerId = null;
  }

  /**
   * Check whether a bot is currently in a dialogue interaction.
   */
  isInteracting(botId: string): boolean {
    const bot = this.bots.get(botId);
    return bot?.state === 'interacting';
  }

  /**
   * End all interactions for a given player (e.g., on disconnect).
   */
  endAllInteractionsForPlayer(playerId: string): void {
    for (const bot of this.bots.values()) {
      if (bot.interactingPlayerId === playerId) {
        this.endInteraction(bot.id, playerId);
      }
    }
  }

  /**
   * Clear all bots. Called when room is cleaned up.
   */
  destroy(): void {
    this.bots.clear();
    console.log('[BotManager] destroyed');
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private tickBot(bot: ServerBot, deltaMs: number, now: number): boolean {
    if (bot.state === 'interacting') return false;
    if (bot.state === 'idle') {
      return this.tickIdle(bot);
    } else {
      return this.tickWalking(bot, deltaMs, now);
    }
  }

  private tickIdle(bot: ServerBot): boolean {
    bot.idleTicks += 1;
    if (bot.idleTicks >= BOT_WANDER_INTERVAL_TICKS) {
      return this.startWander(bot);
    }
    return false;
  }

  private tickWalking(bot: ServerBot, deltaMs: number, now: number): boolean {
    if (bot.targetX === null || bot.targetY === null) {
      this.transitionToIdle(bot);
      return true;
    }

    // Stuck detection: compare actual distance traveled, not just elapsed time
    if (bot.walkStartTime !== null) {
      const elapsed = now - bot.walkStartTime;
      if (elapsed > BOT_STUCK_TIMEOUT_MS) {
        const distFromStart = Math.sqrt(
          (bot.worldX - bot.lastKnownX) ** 2 +
            (bot.worldY - bot.lastKnownY) ** 2
        );
        if (distFromStart < TILE_SIZE) {
          // Bot hasn't moved more than 1 tile — truly stuck
          console.log(
            `[BotManager] Bot ${bot.id} stuck (moved ${distFromStart.toFixed(1)}px in ${elapsed}ms) — going idle`
          );
          this.transitionToIdle(bot);
          return true;
        }
        // Bot has moved — reset checkpoint
        bot.walkStartTime = now;
        bot.lastKnownX = bot.worldX;
        bot.lastKnownY = bot.worldY;
      }
    }

    const dx = bot.targetX - bot.worldX;
    const dy = bot.targetY - bot.worldY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Reached target
    if (distance < 2) {
      this.transitionToIdle(bot);
      return true;
    }

    // Move toward target
    const speed = (BOT_SPEED * deltaMs) / 1000;
    const ratio = Math.min(speed / distance, 1);
    const newX = bot.worldX + dx * ratio;
    const newY = bot.worldY + dy * ratio;

    // Check walkability of new position
    const tileX = Math.floor(newX / TILE_SIZE);
    const tileY = Math.floor(newY / TILE_SIZE);
    if (!this.isTileWalkable(tileX, tileY)) {
      return this.startWander(bot);
    }

    const moved =
      Math.abs(newX - bot.worldX) > 0.1 ||
      Math.abs(newY - bot.worldY) > 0.1;

    bot.worldX = newX;
    bot.worldY = newY;
    bot.direction = this.getDirection(dx, dy);

    return moved;
  }

  private startWander(bot: ServerBot): boolean {
    const centerTileX = Math.floor(bot.worldX / TILE_SIZE);
    const centerTileY = Math.floor(bot.worldY / TILE_SIZE);
    const target = this.pickRandomWalkableTile(centerTileX, centerTileY);

    if (!target) {
      this.transitionToIdle(bot);
      return true;
    }

    // Only reset stuck timer when transitioning from IDLE to WALKING.
    // When re-targeting while already walking (e.g. hit obstacle),
    // keep the original timer so stuck detection still fires.
    const wasIdle = bot.state === 'idle';

    bot.state = 'walking';
    bot.targetX = target.tileX * TILE_SIZE + TILE_SIZE / 2;
    bot.targetY = target.tileY * TILE_SIZE + TILE_SIZE / 2;
    bot.idleTicks = 0;

    if (wasIdle) {
      bot.walkStartTime = Date.now();
      bot.lastKnownX = bot.worldX;
      bot.lastKnownY = bot.worldY;
    }

    return true;
  }

  private transitionToIdle(bot: ServerBot): void {
    bot.state = 'idle';
    bot.targetX = null;
    bot.targetY = null;
    bot.idleTicks = 0;
    bot.walkStartTime = null;
  }

  private pickRandomWalkableTile(
    centerTileX: number,
    centerTileY: number
  ): { tileX: number; tileY: number } | null {
    for (let attempt = 0; attempt < MAX_WANDER_TARGET_ATTEMPTS; attempt++) {
      const offsetX =
        Math.floor(Math.random() * (BOT_WANDER_RADIUS * 2 + 1)) -
        BOT_WANDER_RADIUS;
      const offsetY =
        Math.floor(Math.random() * (BOT_WANDER_RADIUS * 2 + 1)) -
        BOT_WANDER_RADIUS;
      const tileX = centerTileX + offsetX;
      const tileY = centerTileY + offsetY;

      if (
        this.isTileWalkable(tileX, tileY) &&
        this.hasLineOfSight(centerTileX, centerTileY, tileX, tileY)
      ) {
        return { tileX, tileY };
      }
    }
    return null;
  }

  /**
   * Brute-force scan for any walkable tile on the map.
   * Used as fallback when pickRandomWalkableTile fails (e.g., walkable area
   * is far from the search center).
   */
  private findAnyWalkableTile(): { tileX: number; tileY: number } | null {
    const { mapWalkable, mapWidth, mapHeight } = this.config;
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (mapWalkable[y]?.[x] === true) {
          return { tileX: x, tileY: y };
        }
      }
    }
    return null;
  }

  /**
   * Check if there is a clear straight-line path between two tiles.
   * Uses Bresenham's line algorithm to trace every tile along the path
   * and verify each one is walkable.
   */
  private hasLineOfSight(
    fromTileX: number,
    fromTileY: number,
    toTileX: number,
    toTileY: number
  ): boolean {
    let x0 = fromTileX;
    let y0 = fromTileY;
    const x1 = toTileX;
    const y1 = toTileY;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (!this.isTileWalkable(x0, y0)) return false;
      if (x0 === x1 && y0 === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    return true;
  }

  private isTileWalkable(tileX: number, tileY: number): boolean {
    const { mapWalkable, mapWidth, mapHeight } = this.config;
    if (tileX < 0 || tileY < 0 || tileX >= mapWidth || tileY >= mapHeight) {
      return false;
    }
    return mapWalkable[tileY]?.[tileX] === true;
  }

  private getDirection(dx: number, dy: number): string {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  private pickUniqueName(usedNames: Set<string>): string {
    const available = BOT_NAMES.filter((n) => !usedNames.has(n));
    if (available.length === 0) {
      // Fallback: generate numbered name if all names exhausted
      return `Bot-${Math.floor(Math.random() * 9000) + 1000}`;
    }
    return available[Math.floor(Math.random() * available.length)];
  }
}
