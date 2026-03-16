import type { Cell } from '@nookstead/shared';
import type { CellTrigger } from '@nookstead/shared';
import type { MapType, ZoneData } from './map-types';
import type { TilesetInfo, MaterialInfo } from './material-types';
import type { FenceCellData } from '@nookstead/shared';

/** Brush shape for the brush and eraser tools. */
export type BrushShape = 'circle' | 'square';

/** Editor tool types. */
export type EditorTool =
  | 'brush'
  | 'fill'
  | 'rectangle'
  | 'eraser'
  | 'zone-rect'
  | 'zone-poly'
  | 'object-place'
  | 'fence'
  | 'fence-eraser'
  | 'interaction-place'
  | 'interaction-eraser';

/** Sidebar tab identifiers. */
export type SidebarTab =
  | 'terrain'
  | 'layers'
  | 'properties'
  | 'zones'
  | 'frames'
  | 'game-objects'
  | 'fence-types'
  | 'interactions';

/** All sidebar tab values as a runtime-accessible constant array. */
export const SIDEBAR_TABS: SidebarTab[] = [
  'terrain',
  'layers',
  'properties',
  'zones',
  'frames',
  'game-objects',
  'fence-types',
  'interactions',
];

/** Common fields shared by all layer types. */
export interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

/** A tile-based layer with terrain data and autotile frames. */
export interface TileLayer extends BaseLayer {
  type: 'tile';
  terrainKey: string;
  /** 2D array of autotile frame indices matching the map dimensions [y][x]. */
  frames: number[][];
  /** Per-cell tileset key for rendering, determined by material pair at transition boundary [y][x]. */
  tilesetKeys?: string[][];
}

/** An object representing a game object placed on the map. */
export interface PlacedObject {
  id: string;
  objectId: string;
  objectName: string;
  gridX: number;
  gridY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

/** A layer containing placed game objects. */
export interface ObjectLayer extends BaseLayer {
  type: 'object';
  objects: PlacedObject[];
}

/**
 * A fence layer with per-cell connection data and derived frame indices.
 * Design Doc Section 4.2: Each fence layer is associated with exactly one
 * fence type (identified by fenceTypeKey). Connection detection operates
 * within a single layer -- cells from different fence layers do not interact.
 */
export interface FenceLayer extends BaseLayer {
  type: 'fence';
  /** Programmatic fence type key (e.g., "wooden_fence") */
  fenceTypeKey: string;
  /** [y][x] authoritative cell data. null = empty cell. */
  cells: (FenceCellData | null)[][];
  /** [y][x] derived frame indices. 0 = empty (FENCE_EMPTY_FRAME). */
  frames: number[][];
}

/**
 * A layer storing sparse interaction triggers per tile.
 * ADR-0017 Decision 1.
 */
export interface InteractionLayer extends BaseLayer {
  type: 'interaction';
  /**
   * Sparse trigger storage. Key = "x,y" string.
   * Most tiles are empty — only tiles with triggers appear in the map.
   */
  triggers: Map<string, CellTrigger[]>;
}

/**
 * Discriminated union of all editor layer types.
 *
 * Narrowing via the `type` field:
 * - `'tile'`        -> TileLayer
 * - `'object'`      -> ObjectLayer
 * - `'fence'`       -> FenceLayer
 * - `'interaction'` -> InteractionLayer
 */
export type EditorLayerUnion = TileLayer | ObjectLayer | FenceLayer | InteractionLayer;

/**
 * A single tile layer in the editor (backward-compatible flat structure).
 *
 * Existing code that only works with tile layers can continue to use
 * EditorLayer directly. The discriminated union allows narrowing via
 * the `type` field when both layer kinds need to be handled.
 *
 * Layers loaded from the DB without a `type` field are normalized
 * to TileLayer in the LOAD_MAP handler.
 */
export interface EditorLayer {
  id: string;
  name: string;
  terrainKey: string;
  visible: boolean;
  opacity: number;
  /** 2D array of autotile frame indices matching the map dimensions [y][x]. */
  frames: number[][];
  /** Per-cell tileset key for rendering, determined by material pair at transition boundary [y][x]. */
  tilesetKeys?: string[][];
}

/** A cell-level delta entry for undo/redo. */
export interface CellDelta {
  layerIndex: number;
  x: number;
  y: number;
  oldTerrain: string;
  newTerrain: string;
  oldFrame: number;
  newFrame: number;
}

/** A reversible editor command. */
export interface EditorCommand {
  readonly description: string;
  execute(state: MapEditorState): MapEditorState;
  undo(state: MapEditorState): MapEditorState;
}

/** Complete editor state. */
export interface MapEditorState {
  // Map data
  mapId: string | null;
  name: string;
  mapType: MapType | null;
  width: number;
  height: number;
  seed: number;
  grid: Cell[][];
  layers: EditorLayerUnion[];
  walkable: boolean[][];

  // Tileset / material runtime config (used by autotile computation)
  tilesets: ReadonlyArray<TilesetInfo>;
  materials: ReadonlyMap<string, MaterialInfo>;

  // Editor UI state
  activeLayerIndex: number;
  activeTool: EditorTool;
  activeMaterialKey: string;
  activeFenceTypeKey: string;
  activeTriggerType: CellTrigger['type'];
  brushSize: number;
  brushShape: BrushShape;

  // Undo/redo
  undoStack: EditorCommand[];
  redoStack: EditorCommand[];

  // Metadata
  metadata: Record<string, string>;

  // Status
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;

  // Zones
  zones: ZoneData[];
  zoneVisibility: boolean;
}

/** Action types for the editor reducer. */
export type MapEditorAction =
  // Tool and selection actions
  | { type: 'SET_TOOL'; tool: EditorTool }
  | { type: 'SET_MATERIAL'; materialKey: string }
  | { type: 'SET_ACTIVE_LAYER'; index: number }

  // Map data actions
  | { type: 'LOAD_MAP'; map: LoadMapPayload }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_SEED'; seed: number }
  | { type: 'RESIZE_MAP'; newWidth: number; newHeight: number }
  | { type: 'SET_METADATA'; metadata: Record<string, string> }

  // Status actions
  | { type: 'SET_SAVING'; isSaving: boolean }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_DIRTY' }

  // Layer actions
  | { type: 'ADD_LAYER'; name: string; terrainKey: string }
  | { type: 'REMOVE_LAYER'; index: number }
  | { type: 'TOGGLE_LAYER_VISIBILITY'; index: number }
  | { type: 'SET_LAYER_OPACITY'; index: number; opacity: number }
  | { type: 'REORDER_LAYERS'; fromIndex: number; toIndex: number }

  // Object layer actions
  | { type: 'ADD_OBJECT_LAYER'; name: string }
  | { type: 'PLACE_OBJECT'; layerIndex: number; object: PlacedObject }
  | { type: 'REMOVE_OBJECT'; layerIndex: number; objectId: string }
  | {
      type: 'MOVE_OBJECT';
      layerIndex: number;
      objectId: string;
      gridX: number;
      gridY: number;
    }

  // Fence layer actions
  | { type: 'ADD_FENCE_LAYER'; name: string; fenceTypeKey: string }
  | {
      type: 'PLACE_FENCE';
      layerIndex: number;
      positions: { x: number; y: number }[];
    }
  | {
      type: 'ERASE_FENCE';
      layerIndex: number;
      positions: { x: number; y: number }[];
    }
  | { type: 'TOGGLE_GATE'; layerIndex: number; x: number; y: number }
  | { type: 'SET_FENCE_TYPE'; fenceTypeKey: string }

  // Undo/redo
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'PUSH_COMMAND'; command: EditorCommand }

  // Brush settings
  | { type: 'SET_BRUSH_SIZE'; size: number }
  | { type: 'ADJUST_BRUSH_SIZE'; delta: number }
  | { type: 'SET_BRUSH_SHAPE'; shape: BrushShape }

  // Tileset / material config
  | { type: 'SET_TILESETS'; tilesets: ReadonlyArray<TilesetInfo> }
  | { type: 'SET_MATERIALS'; materials: ReadonlyMap<string, MaterialInfo> }

  // Zone actions
  | { type: 'SET_ZONES'; zones: ZoneData[] }
  | { type: 'ADD_ZONE'; zone: ZoneData }
  | { type: 'UPDATE_ZONE'; zoneId: string; data: Partial<ZoneData> }
  | { type: 'DELETE_ZONE'; zoneId: string }
  | { type: 'TOGGLE_ZONE_VISIBILITY' }

  // Interaction layer actions (ADR-0017)
  | { type: 'ADD_INTERACTION_LAYER'; name: string }
  | {
      type: 'PLACE_TRIGGER';
      layerIndex: number;
      x: number;
      y: number;
      trigger: CellTrigger;
    }
  | {
      type: 'REMOVE_TRIGGER';
      layerIndex: number;
      x: number;
      y: number;
      triggerIndex?: number;
    }
  | {
      type: 'UPDATE_TRIGGER';
      layerIndex: number;
      x: number;
      y: number;
      triggerIndex: number;
      trigger: CellTrigger;
    }
  | { type: 'SET_TRIGGER_TYPE'; triggerType: CellTrigger['type'] };

/** Payload shape for LOAD_MAP action, matching API response. */
export interface LoadMapPayload {
  id: string;
  name: string;
  mapType: string;
  width: number;
  height: number;
  seed: number | null;
  grid: Cell[][];
  layers: EditorLayer[] | unknown[];
  walkable: boolean[][];
  metadata?: unknown;
  zones?: ZoneData[];
  /** Fence layers from persisted map data. Empty array if no fences. */
  fenceLayers: unknown[];
  /** Interaction layers from persisted map data. */
  interactionLayers?: unknown[];
}
