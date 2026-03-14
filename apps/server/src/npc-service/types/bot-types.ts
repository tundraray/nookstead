import type { NpcBot } from '@nookstead/db';
import type { BotAnimState } from '@nookstead/shared';

/**
 * Runtime representation of a bot on the server.
 * Created from NpcBot DB records at bot spawn time.
 * Mutable — fields are updated each tick by BotManager.
 */
export interface ServerBot {
  id: string;
  mapId: string;
  name: string;
  skin: string;
  worldX: number;
  worldY: number;
  direction: string;
  state: BotAnimState;
  /** Target position for WALKING state. null when IDLE. */
  targetX: number | null;
  targetY: number | null;
  /** Tick counter for IDLE -> WALKING transition. */
  idleTicks: number;
  /** Timestamp when current WALKING state started (for stuck detection). */
  walkStartTime: number | null;
  /** Position at walkStartTime (for stuck detection). */
  lastKnownX: number;
  lastKnownY: number;
  /** Session ID of player currently in dialogue, or null if free. */
  interactingPlayerId: string | null;
  /** NPC personality description (nullable, from DB). */
  personality: string | null;
  /** NPC role (nullable, from DB). */
  role: string | null;
  /** NPC speech style (nullable, from DB). */
  speechStyle: string | null;
  /** NPC biography (nullable, from DB). */
  bio: string | null;
  /** NPC age (nullable, from DB). */
  age: number | null;
  /** NPC personality traits array (nullable, from DB). */
  traits: string[] | null;
  /** NPC personal goals array (nullable, from DB). */
  goals: string[] | null;
  /** NPC fears array (nullable, from DB). */
  fears: string[] | null;
  /** NPC interests array (nullable, from DB). */
  interests: string[] | null;
  /** Ordered list of A* waypoints the bot is currently following. */
  waypoints: Array<{ x: number; y: number }>;
  /** Index into `waypoints` of the next waypoint to walk toward. */
  currentWaypointIndex: number;
  /** Timestamp (Date.now()) when the current route was computed. 0 = no active route. */
  routeComputedAt: number;
  /** Consecutive wander pathfinding failures since the last successful path. */
  failedWanderAttempts: number;
}

/**
 * A bot state update to be applied to the Colyseus ChunkBot schema.
 * Returned by BotManager.tick() for bots whose state changed this tick.
 */
export interface BotUpdate {
  id: string;
  worldX: number;
  worldY: number;
  direction: string;
  state: BotAnimState;
}

/**
 * Bot position for DB persistence (used in saveBotPositions).
 */
export interface BotPosition {
  id: string;
  worldX: number;
  worldY: number;
  direction: string;
}

/**
 * Result of a NPC_INTERACT validation.
 */
export type InteractionResult =
  | { success: true; botId: string; name: string; state: BotAnimState }
  | { success: false; error: string };

/**
 * Configuration for BotManager initialization.
 */
export interface BotManagerConfig {
  /** 2D boolean walkability grid. walkable[y][x] = true means walkable. */
  mapWalkable: boolean[][];
  /** Width of the map in tiles. */
  mapWidth: number;
  /** Height of the map in tiles. */
  mapHeight: number;
  /** ID of the map the bots belong to. */
  mapId: string;
  /** Tick interval in milliseconds (used for stuck detection timing). */
  tickIntervalMs: number;
}

/**
 * Factory function to create a ServerBot from a DB NpcBot record.
 */
export function createServerBot(record: NpcBot): ServerBot {
  return {
    id: record.id,
    mapId: record.mapId,
    name: record.name,
    skin: record.skin,
    worldX: record.worldX,
    worldY: record.worldY,
    direction: record.direction,
    state: 'idle',
    targetX: null,
    targetY: null,
    idleTicks: 0,
    walkStartTime: null,
    lastKnownX: record.worldX,
    lastKnownY: record.worldY,
    interactingPlayerId: null,
    personality: record.personality ?? null,
    role: record.role ?? null,
    speechStyle: record.speechStyle ?? null,
    bio: record.bio ?? null,
    age: record.age ?? null,
    traits: (record.traits as string[] | null) ?? null,
    goals: (record.goals as string[] | null) ?? null,
    fears: (record.fears as string[] | null) ?? null,
    interests: (record.interests as string[] | null) ?? null,
    waypoints: [],
    currentWaypointIndex: 0,
    routeComputedAt: 0,
    failedWanderAttempts: 0,
  };
}
