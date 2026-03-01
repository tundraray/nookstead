// ============================================================
// Core map types (moved from apps/game/src/game/mapgen/types.ts)
// ============================================================

import type { TerrainCellType } from './terrain-cell-type.generated';
export type { TerrainCellType } from './terrain-cell-type.generated';

/**
 * Action triggered when a player steps on a cell.
 *
 * - 'transition': teleport to another map/area (target = map id, data.x/y = spawn point)
 * - 'interact':   triggers an interaction (target = NPC/object id)
 * - 'damage':     deals damage while standing on it (data.amount, data.interval)
 * - 'script':     runs a named script (target = script name)
 */
export interface CellAction {
  type: 'transition' | 'interact' | 'damage' | 'script';
  /** Target identifier (map id, NPC id, script name, etc.). */
  target: string;
  /** Action-specific parameters. */
  data?: Record<string, unknown>;
}

/** A single cell in the generation grid. */
export interface Cell {
  terrain: TerrainCellType;
  elevation: number;
  /** Extensible metadata for future passes (moisture, temperature, etc.). */
  meta: Record<string, number>;
  /** Optional action triggered when a player steps on this cell. */
  action?: CellAction;
}

/** A 2D grid of cells (row-major: grid[y][x]). */
export type Grid = Cell[][];

/** Rendering layer with autotile frame data. */
export interface LayerData {
  name: string;
  terrainKey: string; // Phaser spritesheet key (fallback)
  frames: number[][]; // [y][x] frame index (0 = empty, 1-47 = autotile)
  tilesetKeys?: string[][]; // [y][x] per-cell tileset key for transition rendering
}

/** Complete output of the generation pipeline. */
export interface GeneratedMap {
  width: number;
  height: number;
  seed: number;
  grid: Grid;
  layers: LayerData[];
  /** Walkability grid: true = walkable. Derived from terrain properties. */
  walkable: boolean[][];
}

// ============================================================
// Network transfer types (new -- for MAP_DATA message over WebSocket)
// ============================================================

/**
 * Serialized cell format for network transmission.
 * Same structure as Cell but explicitly typed for network clarity.
 */
export interface SerializedCell {
  terrain: string;
  elevation: number;
  meta: Record<string, number>;
}

export type SerializedGrid = SerializedCell[][];

export interface SerializedLayer {
  name: string;
  terrainKey: string;
  frames: number[][];
  tilesetKeys?: string[][];
}

/**
 * Payload sent by server to client in the MAP_DATA message.
 * Contains all data needed to render the player's map.
 */
export interface MapDataPayload {
  seed: number;
  width: number;
  height: number;
  grid: SerializedGrid;
  layers: SerializedLayer[];
  walkable: boolean[][];
  /** Server-computed spawn pixel X (present for new players). */
  spawnX?: number;
  /** Server-computed spawn pixel Y (present for new players). */
  spawnY?: number;
}

// ============================================================
// Session types
// ============================================================

/**
 * Payload sent by server when an existing session is kicked.
 */
export interface SessionKickedPayload {
  reason: string;
}
