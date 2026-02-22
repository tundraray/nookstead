import type { Cell } from '@nookstead/shared';
import type { MapType, ZoneData } from './map-types';
import type { TilesetInfo, MaterialInfo } from './material-types';

/** Editor tool types. */
export type EditorTool =
  | 'brush'
  | 'fill'
  | 'rectangle'
  | 'eraser'
  | 'zone-rect'
  | 'zone-poly'
  | 'object-place';

/** Sidebar tab identifiers. */
export type SidebarTab =
  | 'terrain'
  | 'layers'
  | 'properties'
  | 'zones'
  | 'frames'
  | 'game-objects';

/** All sidebar tab values as a runtime-accessible constant array. */
export const SIDEBAR_TABS: SidebarTab[] = [
  'terrain',
  'layers',
  'properties',
  'zones',
  'frames',
  'game-objects',
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
 * A single tile layer in the editor (backward-compatible flat structure).
 *
 * Existing code that only works with tile layers can continue to use
 * EditorLayer directly. The discriminated union allows narrowing via
 * the `type` field when both layer kinds need to be handled.
 *
 * Backward compatibility: layers loaded from the DB without a `type`
 * field are normalized to TileLayer in the LOAD_MAP handler.
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
  layers: EditorLayer[];
  walkable: boolean[][];

  // Tileset / material runtime config (used by autotile computation)
  tilesets: ReadonlyArray<TilesetInfo>;
  materials: ReadonlyMap<string, MaterialInfo>;

  // Editor UI state
  activeLayerIndex: number;
  activeTool: EditorTool;
  activeMaterialKey: string;

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

  // Undo/redo
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'PUSH_COMMAND'; command: EditorCommand }

  // Tileset / material config
  | { type: 'SET_TILESETS'; tilesets: ReadonlyArray<TilesetInfo> }
  | { type: 'SET_MATERIALS'; materials: ReadonlyMap<string, MaterialInfo> }

  // Zone actions
  | { type: 'SET_ZONES'; zones: ZoneData[] }
  | { type: 'ADD_ZONE'; zone: ZoneData }
  | { type: 'UPDATE_ZONE'; zoneId: string; data: Partial<ZoneData> }
  | { type: 'DELETE_ZONE'; zoneId: string }
  | { type: 'TOGGLE_ZONE_VISIBILITY' };

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
}
