import {
  BOT_SPEED,
  BOT_WANDER_RADIUS,
  BOT_WANDER_INTERVAL_TICKS,
  BOT_INTERACTION_RADIUS,
  BOT_STUCK_TIMEOUT_MS,
  BOT_MAX_PATHFIND_FAILURES,
  BOT_EXTENDED_IDLE_TICKS,
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
import type { SeedPersona } from '../ai/DialogueService.js';
import { Pathfinder, NPCMovementEngine } from '../movement/index.js';

/**
 * Manages all NPC bot companions for a single homestead (ChunkRoom instance).
 *
 * Responsibilities:
 * - Initialize bots from DB records (loadBots result)
 * - Generate new bots for first-time homestead visits
 * - Run the IDLE/WALKING state machine each tick
 * - Compute A* waypoint paths for bot navigation
 * - Detect stuck bots and teleport to nearest walkable tile
 * - Handle dynamic walkability grid changes
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
  private pathfinder!: Pathfinder;
  private engines = new Map<string, NPCMovementEngine>();

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
    this.engines.clear();

    this.pathfinder = new Pathfinder(config.mapWalkable);

    for (const record of records) {
      const bot = createServerBot(record);
      this.bots.set(bot.id, bot);
      this.engines.set(bot.id, new NPCMovementEngine());
    }

    console.log(`[BotManager] init: ${this.bots.size} bots loaded`);
  }

  /**
   * Generate N new bots with unique names and random skins.
   * Does not persist to DB -- ChunkRoom calls createBot() for each result.
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
    this.engines.set(bot.id, new NPCMovementEngine());
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
   * Get the full seed persona for a bot.
   * Returns SeedPersona extracted from bot's persona fields.
   * Returns null only if bot not found by botId.
   */
  getBotPersona(botId: string): SeedPersona | null {
    const bot = this.bots.get(botId);
    if (!bot) return null;
    return {
      personality: bot.personality ?? null,
      role: bot.role ?? null,
      speechStyle: bot.speechStyle ?? null,
      bio: bot.bio ?? null,
      age: bot.age ?? null,
      traits: bot.traits ?? null,
      goals: bot.goals ?? null,
      fears: bot.fears ?? null,
      interests: bot.interests ?? null,
    };
  }

  /**
   * Update persona fields for a bot in memory.
   * Called after AI character generation completes asynchronously.
   * Accepts a partial SeedPersona -- only provided (non-undefined) fields are updated.
   */
  updateBotPersona(
    botId: string,
    persona: Partial<SeedPersona>
  ): void {
    const bot = this.bots.get(botId);
    if (!bot) return;
    if (persona.personality !== undefined) bot.personality = persona.personality;
    if (persona.role !== undefined) bot.role = persona.role;
    if (persona.speechStyle !== undefined) bot.speechStyle = persona.speechStyle;
    if (persona.bio !== undefined) bot.bio = persona.bio;
    if (persona.age !== undefined) bot.age = persona.age;
    if (persona.traits !== undefined) bot.traits = persona.traits;
    if (persona.goals !== undefined) bot.goals = persona.goals;
    if (persona.fears !== undefined) bot.fears = persona.fears;
    if (persona.interests !== undefined) bot.interests = persona.interests;
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
    bot.waypoints = [];
    bot.currentWaypointIndex = 0;
    bot.routeComputedAt = 0;
    this.engines.get(botId)?.clearPath();

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
   * Handle a walkability grid change at a specific tile coordinate.
   * Updates the Pathfinder's internal grid and, if the tile became non-walkable,
   * checks each walking bot's remaining waypoints for blockages.
   * Affected bots get their path recomputed or transition to IDLE.
   *
   * @param x - Tile X coordinate that changed
   * @param y - Tile Y coordinate that changed
   * @param walkable - New walkability state of the tile
   */
  onWalkabilityChanged(x: number, y: number, walkable: boolean): void {
    this.pathfinder.setWalkableAt(x, y, walkable);

    if (!walkable) {
      for (const bot of this.bots.values()) {
        if (bot.state !== 'walking') continue;
        const engine = this.engines.get(bot.id);
        if (!engine) continue;
        if (engine.isWaypointBlocked(x, y)) {
          // Recompute path from current position to original target
          const currentTileX = Math.floor(bot.worldX / TILE_SIZE);
          const currentTileY = Math.floor(bot.worldY / TILE_SIZE);
          if (bot.targetX !== null && bot.targetY !== null) {
            const targetTileX = Math.floor(bot.targetX / TILE_SIZE);
            const targetTileY = Math.floor(bot.targetY / TILE_SIZE);
            const newPath = this.pathfinder.findPath(
              currentTileX,
              currentTileY,
              targetTileX,
              targetTileY
            );
            if (newPath.length > 0) {
              bot.waypoints = newPath;
              bot.currentWaypointIndex = 0;
              engine.setPath(newPath);
              console.log(
                `[BotManager] path recalculated for bot ${bot.id} after grid change`
              );
            } else {
              this.transitionToIdle(bot);
              console.log(
                `[BotManager] path invalidated for bot ${bot.id}, transitioning to IDLE`
              );
            }
          } else {
            this.transitionToIdle(bot);
            console.log(
              `[BotManager] path invalidated for bot ${bot.id}, transitioning to IDLE`
            );
          }
        }
      }
    }
  }

  /**
   * Clear all bots. Called when room is cleaned up.
   */
  destroy(): void {
    this.bots.clear();
    this.engines.clear();
    console.log('[BotManager] destroyed');
  }

  // --- Private helpers -------------------------------------------------------

  private tickBot(bot: ServerBot, deltaMs: number, now: number): boolean {
    if (bot.state === 'interacting') return false;
    if (bot.state === 'idle') {
      return this.tickIdle(bot);
    } else {
      return this.tickWalkingWaypoint(bot, deltaMs, now);
    }
  }

  private tickIdle(bot: ServerBot): boolean {
    bot.idleTicks += 1;
    if (bot.idleTicks >= BOT_WANDER_INTERVAL_TICKS) {
      return this.startWander(bot);
    }
    return false;
  }

  private tickWalkingWaypoint(
    bot: ServerBot,
    deltaMs: number,
    now: number
  ): boolean {
    const engine = this.engines.get(bot.id);
    if (!engine || !engine.hasPath()) {
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
          // Bot hasn't moved more than 1 tile -- truly stuck
          // Teleport to nearest walkable tile
          const safeTile = this.findAnyWalkableTile();
          if (safeTile) {
            bot.worldX = safeTile.tileX * TILE_SIZE + TILE_SIZE / 2;
            bot.worldY = safeTile.tileY * TILE_SIZE + TILE_SIZE / 2;
          }
          console.log(
            `[BotManager] Bot ${bot.id} stuck (moved ${distFromStart.toFixed(1)}px in ${elapsed}ms) -- teleporting to nearest walkable tile`
          );
          this.transitionToIdle(bot);
          return true;
        }
        // Bot has moved -- reset checkpoint
        bot.walkStartTime = now;
        bot.lastKnownX = bot.worldX;
        bot.lastKnownY = bot.worldY;
      }
    }

    // Delegate movement to the engine
    const result = engine.tick(
      bot.worldX,
      bot.worldY,
      deltaMs,
      BOT_SPEED,
      TILE_SIZE
    );

    if (result.moved) {
      bot.worldX = result.newWorldX;
      bot.worldY = result.newWorldY;
      bot.direction = result.direction;
    }

    if (result.reachedWaypoint) {
      bot.currentWaypointIndex++;
    }

    if (result.reachedDestination) {
      this.transitionToIdle(bot);
      return true;
    }

    return result.moved;
  }

  private startWander(bot: ServerBot): boolean {
    const centerTileX = Math.floor(bot.worldX / TILE_SIZE);
    const centerTileY = Math.floor(bot.worldY / TILE_SIZE);
    const target = this.pickRandomWalkableTile(centerTileX, centerTileY);

    if (!target) {
      this.transitionToIdle(bot);
      return true;
    }

    // Compute A* path to target
    const waypoints = this.pathfinder.findPath(
      centerTileX,
      centerTileY,
      target.tileX,
      target.tileY
    );

    if (waypoints.length > 0) {
      const engine = this.engines.get(bot.id);
      if (!engine) {
        this.transitionToIdle(bot);
        return true;
      }

      bot.waypoints = waypoints;
      bot.currentWaypointIndex = 0;
      bot.routeComputedAt = Date.now();
      bot.failedWanderAttempts = 0;
      engine.setPath(waypoints);

      bot.state = 'walking';
      bot.targetX = target.tileX * TILE_SIZE + TILE_SIZE / 2;
      bot.targetY = target.tileY * TILE_SIZE + TILE_SIZE / 2;
      bot.idleTicks = 0;
      bot.walkStartTime = Date.now();
      bot.lastKnownX = bot.worldX;
      bot.lastKnownY = bot.worldY;

      console.log(
        `[BotManager] path computed for bot ${bot.id}: ${waypoints.length} waypoints`
      );
      return true;
    }

    // No path found
    bot.failedWanderAttempts++;
    console.log(
      `[BotManager] no path found for bot ${bot.id}, attempt ${bot.failedWanderAttempts}`
    );

    if (bot.failedWanderAttempts >= BOT_MAX_PATHFIND_FAILURES) {
      bot.state = 'idle';
      bot.idleTicks = BOT_WANDER_INTERVAL_TICKS - BOT_EXTENDED_IDLE_TICKS;
      bot.failedWanderAttempts = 0;
      console.log(
        `[BotManager] bot ${bot.id} entering extended idle after ${BOT_MAX_PATHFIND_FAILURES} pathfind failures`
      );
      return true;
    }

    // Stay idle, will retry on next tickIdle trigger
    this.transitionToIdle(bot);
    return true;
  }

  private transitionToIdle(bot: ServerBot): void {
    bot.state = 'idle';
    bot.targetX = null;
    bot.targetY = null;
    bot.idleTicks = 0;
    bot.walkStartTime = null;
    bot.waypoints = [];
    bot.currentWaypointIndex = 0;
    bot.routeComputedAt = 0;
    this.engines.get(bot.id)?.clearPath();
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

      if (this.isTileWalkable(tileX, tileY)) {
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

  private isTileWalkable(tileX: number, tileY: number): boolean {
    const { mapWalkable, mapWidth, mapHeight } = this.config;
    if (tileX < 0 || tileY < 0 || tileX >= mapWidth || tileY >= mapHeight) {
      return false;
    }
    return mapWalkable[tileY]?.[tileX] === true;
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
