/**
 * Core types for the procedural map generation pipeline.
 */

/** Terrain classification for each cell in the grid. */
export type TerrainCellType = 'deep_water' | 'water' | 'grass';

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
  execute(grid: Grid, width: number, height: number, rng: () => number): void;
}

/** Interface for passes that produce rendering layers. */
export interface LayerPass {
  readonly name: string;
  buildLayers(grid: Grid, width: number, height: number): LayerData[];
}
