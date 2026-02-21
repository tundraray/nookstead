import type { SerializedFenceLayer } from './fence-layer';

// ============================================================
// Core map types (moved from apps/game/src/game/mapgen/types.ts)
// ============================================================

/** Terrain classification for each cell in the grid. All 26 terrain types. */
export type TerrainCellType =
  | 'deep_water' | 'water' | 'grass'
  | 'dirt_light_grass' | 'orange_grass' | 'pale_sage' | 'forest_edge'
  | 'lush_green' | 'grass_orange' | 'grass_alpha' | 'grass_fenced'
  | 'water_grass' | 'grass_water' | 'deep_water_water'
  | 'light_sand_grass' | 'light_sand_water'
  | 'orange_sand_light_sand' | 'sand_alpha'
  | 'clay_ground' | 'alpha_props_fence'
  | 'ice_blue' | 'light_stone' | 'warm_stone' | 'gray_cobble'
  | 'slate' | 'dark_brick' | 'steel_floor'
  | 'asphalt_white_line' | 'asphalt_yellow_line';

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
  terrainKey: string; // Phaser spritesheet key
  frames: number[][]; // [y][x] frame index (0 = empty, 1-47 = autotile)
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

/** Interface for composable generation passes. */
export interface GenerationPass {
  readonly name: string;
  execute(
    grid: Grid,
    width: number,
    height: number,
    rng: () => number
  ): void;
}

/** Interface for passes that produce rendering layers. */
export interface LayerPass {
  readonly name: string;
  buildLayers(grid: Grid, width: number, height: number): LayerData[];
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
  /** Fence layers for the map. Empty array if no fences. */
  fenceLayers: SerializedFenceLayer[];
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
