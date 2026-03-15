import type { SerializedFenceLayer } from './fence-layer';
import type { SerializedInteractionLayer } from './interaction-layer';

// ============================================================
// Core map types (moved from apps/game/src/game/mapgen/types.ts)
// ============================================================

import type { TerrainCellType } from './terrain-cell-type.generated';
export type { TerrainCellType } from './terrain-cell-type.generated';

/**
 * Action triggered when a player steps on a cell.
 *
 * @deprecated Use `InteractionLayer` with `CellTrigger` instead (ADR-0017).
 * InteractionLayer supports multiple triggers per tile, distinct activation
 * modes (touch/click/proximity), and structured trigger configurations.
 * This type will be removed in a future major version.
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
  /**
   * @deprecated Use InteractionLayer with CellTrigger instead (ADR-0017).
   */
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

/** Tile layer: autotile frame data for terrain rendering. */
export interface SerializedTileLayer {
  type: 'tile';
  name: string;
  terrainKey: string;
  frames: number[][];
  tilesetKeys?: string[][];
}

/** A placed game object reference within an object layer. */
export interface SerializedPlacedObject {
  id: string;
  objectId: string;
  objectName: string;
  gridX: number;
  gridY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

/** Object layer: placed game objects on the map. */
export interface SerializedObjectLayer {
  type: 'object';
  name: string;
  objects: SerializedPlacedObject[];
}

/** Discriminated union for all layer types in network transfer. */
export type SerializedLayer = SerializedTileLayer | SerializedObjectLayer;

/**
 * Type guard: returns true if the layer is a tile layer.
 * Legacy layers without a `type` field are treated as tile layers
 * for backward compatibility.
 */
export function isTileLayer(
  layer: SerializedLayer
): layer is SerializedTileLayer {
  return !('type' in layer) || layer.type === 'tile';
}

/**
 * Type guard: returns true if the layer is an object layer.
 * Legacy layers without a `type` field return false.
 */
export function isObjectLayer(
  layer: SerializedLayer
): layer is SerializedObjectLayer {
  return 'type' in layer && layer.type === 'object';
}

/**
 * Payload sent by server to client in the MAP_DATA message.
 * Contains all data needed to render the player's map.
 */
export interface MapDataPayload {
  /** UUID of the source map entity (maps table). */
  mapId?: string;
  seed: number;
  width: number;
  height: number;
  grid: SerializedGrid;
  layers: SerializedLayer[];
  walkable: boolean[][];
  /** Server-computed spawn pixel X. */
  spawnX?: number;
  /** Server-computed spawn pixel Y. */
  spawnY?: number;
  /** Fence layers for the map. Omitted or empty array if no fences. */
  fenceLayers?: SerializedFenceLayer[];
  /** Interaction layers for the map. Omitted or empty array if no interactions. */
  interactionLayers?: SerializedInteractionLayer[];
  /** Server-computed spawn facing direction. */
  spawnDirection?: 'up' | 'down' | 'left' | 'right';
}

// ============================================================
// Game object definition types
// ============================================================

/** A single render layer within a game object definition. */
export interface GameObjectLayerDef {
  frameId: string;
  spriteId: string;
  xOffset: number;
  yOffset: number;
  layerOrder: number;
}

/** A collision zone on a game object. */
export interface CollisionZoneDef {
  id: string;
  label: string;
  type: 'collision' | 'walkable';
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Complete game object definition for client-side rendering. */
export interface GameObjectDefinition {
  id: string;
  name: string;
  layers: GameObjectLayerDef[];
  collisionZones: CollisionZoneDef[];
}

/** Sprite metadata for client-side asset loading. */
export interface SpriteMeta {
  id: string;
  name: string;
  s3Url: string;
}

/** Atlas frame metadata for client-side rendering. */
export interface AtlasFrameMeta {
  id: string;
  spriteId: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
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
