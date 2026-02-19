import type { Cell } from '@nookstead/map-lib';
import type { MapType, ZoneData } from '@nookstead/map-lib';
import type { EditorCommand } from './map-editor-commands';

/** Editor tool types. */
export type EditorTool =
  | 'brush'
  | 'fill'
  | 'rectangle'
  | 'eraser'
  | 'zone-rect'
  | 'zone-poly';

/** A single layer in the editor. */
export interface EditorLayer {
  id: string;
  name: string;
  terrainKey: string;
  visible: boolean;
  opacity: number;
  /** 2D array of autotile frame indices matching the map dimensions [y][x]. */
  frames: number[][];
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

  // Editor UI state
  activeLayerIndex: number;
  activeTool: EditorTool;
  activeTerrainKey: string;

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
  | { type: 'SET_TERRAIN'; terrainKey: string }
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

  // Layer actions
  | { type: 'ADD_LAYER'; name: string; terrainKey: string }
  | { type: 'REMOVE_LAYER'; index: number }
  | { type: 'TOGGLE_LAYER_VISIBILITY'; index: number }
  | { type: 'SET_LAYER_OPACITY'; index: number; opacity: number }
  | { type: 'REORDER_LAYERS'; fromIndex: number; toIndex: number }

  // Undo/redo
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'PUSH_COMMAND'; command: EditorCommand }

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
