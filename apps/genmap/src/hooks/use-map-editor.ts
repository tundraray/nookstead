'use client';

import { useReducer, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type {
  Cell,
  MapType,
  MapEditorState,
  MapEditorAction,
  EditorTool,
  EditorLayer,
  EditorLayerUnion,
  TileLayer,
  LoadMapPayload,
  PlacedObject,
  ObjectLayer,
  MaterialInfo,
  InteractionLayer,
} from '@nookstead/map-lib';
import type { CellTrigger } from '@nookstead/shared';
import { serializeInteractionLayer } from '@nookstead/shared';
import {
  RetileEngine,
} from '@nookstead/map-lib';

const DEFAULT_WIDTH = 32;
const DEFAULT_HEIGHT = 32;
const DEFAULT_TERRAIN = 'deep_water' as const;
const DEFAULT_TERRAIN_KEY = 'terrain-01';
const DEFAULT_MATERIAL_KEY = 'deep_water';
const DEFAULT_LAYER_NAME = 'ground';

/**
 * Module-level RetileEngine instance.
 * Created in LOAD_MAP and reconstructed in SET_TILESETS/SET_MATERIALS.
 * Tool files access this via getRetileEngine().
 */
let currentEngine: RetileEngine | null = null;

/** Return the current RetileEngine instance (or null if no map loaded). */
export function getRetileEngine(): RetileEngine | null {
  return currentEngine;
}

/** Extract a MaterialPriorityMap from the materials config. */
function buildMaterialPriority(
  materials: ReadonlyMap<string, MaterialInfo>
): Map<string, number> {
  const m = new Map<string, number>();
  for (const [key, info] of materials) {
    m.set(key, info.renderPriority);
  }
  return m;
}

/** Maximum number of commands in the undo stack. */
export const MAX_UNDO_STACK = 50;

/** Create a single default cell. */
function createDefaultCell(): Cell {
  return {
    terrain: DEFAULT_TERRAIN,
    elevation: 0,
    meta: {},
  };
}

/** Create an empty 2D grid of the given dimensions. */
function createEmptyGrid(width: number, height: number): Cell[][] {
  const grid: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(createDefaultCell());
    }
    grid.push(row);
  }
  return grid;
}

/** Create an empty 2D array of zeros for layer frames. */
function createEmptyFrames(width: number, height: number): number[][] {
  const frames: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      row.push(0);
    }
    frames.push(row);
  }
  return frames;
}

/** Create an empty walkable grid (all false for deep_water default). */
function createEmptyWalkable(width: number, height: number): boolean[][] {
  const walkable: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(false);
    }
    walkable.push(row);
  }
  return walkable;
}

/** Create a default editor layer. */
function createDefaultLayer(
  width: number,
  height: number,
  name: string = DEFAULT_LAYER_NAME,
  terrainKey: string = DEFAULT_TERRAIN_KEY
): TileLayer {
  return {
    type: 'tile',
    id: crypto.randomUUID(),
    name,
    terrainKey,
    visible: true,
    opacity: 1,
    frames: createEmptyFrames(width, height),
  };
}

/** Build the initial editor state. */
function createInitialState(): MapEditorState {
  return {
    mapId: null,
    name: '',
    mapType: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    seed: 0,
    grid: createEmptyGrid(DEFAULT_WIDTH, DEFAULT_HEIGHT),
    layers: [createDefaultLayer(DEFAULT_WIDTH, DEFAULT_HEIGHT)],
    walkable: createEmptyWalkable(DEFAULT_WIDTH, DEFAULT_HEIGHT),
    tilesets: [],
    materials: new Map(),
    activeLayerIndex: 0,
    activeTool: 'brush',
    activeMaterialKey: DEFAULT_MATERIAL_KEY,
    activeTriggerType: 'warp' as const,
    brushSize: 1,
    brushShape: 'circle' as const,
    undoStack: [],
    redoStack: [],
    metadata: {},
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    zones: [],
    zoneVisibility: true,
  };
}

const initialState: MapEditorState = createInitialState();

/**
 * Resize a 2D grid to new dimensions.
 * Expanding adds default cells; truncating slices from right and bottom.
 */
function resizeGrid(
  grid: Cell[][],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): Cell[][] {
  const resized: Cell[][] = [];
  for (let y = 0; y < newHeight; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < newWidth; x++) {
      if (y < oldHeight && x < oldWidth) {
        row.push(grid[y][x]);
      } else {
        row.push(createDefaultCell());
      }
    }
    resized.push(row);
  }
  return resized;
}

/**
 * Resize a 2D frames array to new dimensions.
 * Expanding adds 0s; truncating slices from right and bottom.
 */
function resizeFrames(
  frames: number[][],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): number[][] {
  const resized: number[][] = [];
  for (let y = 0; y < newHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < newWidth; x++) {
      if (y < oldHeight && x < oldWidth) {
        row.push(frames[y][x]);
      } else {
        row.push(0);
      }
    }
    resized.push(row);
  }
  return resized;
}

/**
 * Resize the walkable grid to new dimensions.
 * Expanding adds false; truncating slices from right and bottom.
 */
function resizeWalkable(
  walkable: boolean[][],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): boolean[][] {
  const resized: boolean[][] = [];
  for (let y = 0; y < newHeight; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < newWidth; x++) {
      if (y < oldHeight && x < oldWidth) {
        row.push(walkable[y][x]);
      } else {
        row.push(false);
      }
    }
    resized.push(row);
  }
  return resized;
}

/**
 * Normalize a single raw layer from the API into an EditorLayerUnion.
 *
 * Layers without a `type` field (or with `type: 'tile'`) are treated as
 * TileLayer. Layers with `type: 'object'` are treated as ObjectLayer.
 */
function normalizeLayer(
  raw: unknown,
  width: number,
  height: number
): EditorLayerUnion {
  const l = raw as Record<string, unknown>;

  if (l.type === 'object') {
    const objLayer: ObjectLayer = {
      type: 'object',
      id: (l.id as string) || crypto.randomUUID(),
      name: (l.name as string) || 'objects',
      visible: l.visible !== undefined ? (l.visible as boolean) : true,
      opacity: l.opacity !== undefined ? (l.opacity as number) : 1,
      objects: (l.objects as PlacedObject[]) ?? [],
    };
    return objLayer;
  }

  if (l.type === 'interaction') {
    // Deserialize sparse trigger array back to Map
    const serializedTriggers = (l.triggers as Array<{
      x: number;
      y: number;
      triggers: CellTrigger[];
    }>) ?? [];
    const triggersMap = new Map<string, CellTrigger[]>();
    for (const entry of serializedTriggers) {
      if (entry.triggers && entry.triggers.length > 0) {
        triggersMap.set(`${entry.x},${entry.y}`, entry.triggers);
      }
    }
    const interactionLayer: InteractionLayer = {
      type: 'interaction',
      id: (l.id as string) || crypto.randomUUID(),
      name: (l.name as string) || 'Interactions',
      visible: l.visible !== undefined ? (l.visible as boolean) : true,
      opacity: l.opacity !== undefined ? (l.opacity as number) : 1,
      triggers: triggersMap,
    };
    return interactionLayer;
  }

  // Default: TileLayer
  const tileLayer: TileLayer = {
    type: 'tile',
    id: (l.id as string) || crypto.randomUUID(),
    name: (l.name as string) || 'untitled',
    terrainKey: (l.terrainKey as string) || DEFAULT_TERRAIN_KEY,
    visible: l.visible !== undefined ? (l.visible as boolean) : true,
    opacity: l.opacity !== undefined ? (l.opacity as number) : 1,
    frames:
      Array.isArray(l.frames) && (l.frames as number[][]).length === height
        ? (l.frames as number[][])
        : createEmptyFrames(width, height),
  };
  return tileLayer;
}

/** Convert API layer data to EditorLayerUnion format with normalization. */
function toEditorLayers(
  layers: EditorLayer[] | unknown[],
  width: number,
  height: number
): EditorLayerUnion[] {
  if (!layers || layers.length === 0) {
    return [createDefaultLayer(width, height)];
  }

  return layers.map((layer) => normalizeLayer(layer, width, height));
}

/** The core reducer for the map editor. */
export function mapEditorReducer(
  state: MapEditorState,
  action: MapEditorAction
): MapEditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, activeTool: action.tool };

    case 'SET_MATERIAL':
      return { ...state, activeMaterialKey: action.materialKey };

    case 'SET_ACTIVE_LAYER':
      return { ...state, activeLayerIndex: action.index };

    case 'LOAD_MAP': {
      const { map } = action;

      // Use grid dimensions as source of truth in case stored width/height are stale
      const height = map.grid.length;
      const width = height > 0 ? map.grid[0].length : 0;

      const editorLayers = toEditorLayers(
        map.layers,
        width,
        height
      );

      // Construct RetileEngine and perform full autotile rebuild
      currentEngine = new RetileEngine({
        width,
        height,
        tilesets: state.tilesets,
        materials: state.materials,
        materialPriority: buildMaterialPriority(state.materials),
      });

      const tempState: MapEditorState = {
        ...state,
        width,
        height,
        grid: map.grid,
        layers: editorLayers,
      };
      const result = currentEngine.rebuild(tempState, 'full');

      return {
        ...state,
        mapId: map.id,
        name: map.name,
        mapType: (map.mapType as MapType) || null,
        width,
        height,
        seed: map.seed ?? 0,
        grid: map.grid,
        layers: result.layers,
        walkable: map.walkable,
        metadata: (map.metadata as Record<string, string>) ?? {},
        activeLayerIndex: 0,
        undoStack: [],
        redoStack: [],
        isDirty: false,
        isSaving: false,
        zones: map.zones ?? [],
        zoneVisibility: true,
      };
    }

    case 'SET_NAME':
      return { ...state, name: action.name, isDirty: true };

    case 'SET_SEED':
      return { ...state, seed: action.seed, isDirty: true };

    case 'SET_METADATA':
      return { ...state, metadata: action.metadata, isDirty: true };

    case 'RESIZE_MAP': {
      const { newWidth, newHeight } = action;
      const resizedGrid = resizeGrid(
        state.grid,
        state.width,
        state.height,
        newWidth,
        newHeight
      );
      const resizedLayers = state.layers.map((layer): EditorLayerUnion => {
        // Object layers have no frames to resize
        if (layer.type === 'object') {
          return layer;
        }
        if (layer.type === 'interaction') {
          // InteractionLayer: filter out triggers outside new bounds
          const newTriggers = new Map<string, CellTrigger[]>();
          for (const [key, triggers] of layer.triggers) {
            const [xStr, yStr] = key.split(',');
            const x = parseInt(xStr, 10);
            const y = parseInt(yStr, 10);
            if (x < newWidth && y < newHeight) {
              newTriggers.set(key, triggers);
            }
          }
          return { ...layer, triggers: newTriggers };
        }
        return {
          ...layer,
          frames: resizeFrames(
            layer.frames,
            state.width,
            state.height,
            newWidth,
            newHeight
          ),
        };
      });
      const resizedWalkable = resizeWalkable(
        state.walkable,
        state.width,
        state.height,
        newWidth,
        newHeight
      );

      // Recreate engine with new dimensions so bounds checks are correct
      if (currentEngine) {
        currentEngine = new RetileEngine({
          width: newWidth,
          height: newHeight,
          tilesets: state.tilesets,
          materials: state.materials,
          materialPriority: buildMaterialPriority(state.materials),
        });
      }

      return {
        ...state,
        width: newWidth,
        height: newHeight,
        grid: resizedGrid,
        layers: resizedLayers,
        walkable: resizedWalkable,
        isDirty: true,
      };
    }

    case 'SET_SAVING':
      return { ...state, isSaving: action.isSaving };

    case 'MARK_SAVED':
      return {
        ...state,
        isDirty: false,
        isSaving: false,
        lastSavedAt: new Date().toISOString(),
      };

    case 'ADD_LAYER': {
      const newLayer = createDefaultLayer(
        state.width,
        state.height,
        action.name,
        action.terrainKey
      );
      return {
        ...state,
        layers: [...state.layers, newLayer],
        isDirty: true,
      };
    }

    case 'REMOVE_LAYER': {
      if (state.layers.length <= 1) {
        // Prevent removing the last layer
        return state;
      }
      const newLayers = state.layers.filter((_, i) => i !== action.index);
      let newActiveIndex = state.activeLayerIndex;
      if (newActiveIndex >= newLayers.length) {
        newActiveIndex = newLayers.length - 1;
      }
      return {
        ...state,
        layers: newLayers,
        activeLayerIndex: newActiveIndex,
        isDirty: true,
      };
    }

    case 'TOGGLE_LAYER_VISIBILITY': {
      const layers = state.layers.map((layer, i) =>
        i === action.index ? { ...layer, visible: !layer.visible } : layer
      );
      return { ...state, layers };
    }

    case 'SET_LAYER_OPACITY': {
      const layers = state.layers.map((layer, i) =>
        i === action.index ? { ...layer, opacity: action.opacity } : layer
      );
      return { ...state, layers };
    }

    case 'REORDER_LAYERS': {
      const { fromIndex, toIndex } = action;
      if (
        fromIndex < 0 ||
        fromIndex >= state.layers.length ||
        toIndex < 0 ||
        toIndex >= state.layers.length
      ) {
        return state;
      }
      const layers = [...state.layers];
      const [moved] = layers.splice(fromIndex, 1);
      layers.splice(toIndex, 0, moved);

      // Adjust active layer index to follow the moved layer
      let newActiveIndex = state.activeLayerIndex;
      if (state.activeLayerIndex === fromIndex) {
        newActiveIndex = toIndex;
      } else if (
        fromIndex < state.activeLayerIndex &&
        toIndex >= state.activeLayerIndex
      ) {
        newActiveIndex = state.activeLayerIndex - 1;
      } else if (
        fromIndex > state.activeLayerIndex &&
        toIndex <= state.activeLayerIndex
      ) {
        newActiveIndex = state.activeLayerIndex + 1;
      }

      return {
        ...state,
        layers,
        activeLayerIndex: newActiveIndex,
        isDirty: true,
      };
    }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const undoCommand = state.undoStack[state.undoStack.length - 1];
      const undoneState = undoCommand.undo(state);
      return {
        ...undoneState,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, undoCommand],
        isDirty: true,
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const redoCommand = state.redoStack[state.redoStack.length - 1];
      const redoneState = redoCommand.execute(state);
      return {
        ...redoneState,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, redoCommand],
        isDirty: true,
      };
    }

    case 'PUSH_COMMAND': {
      const executed = action.command.execute(state);
      const newUndoStack = [...state.undoStack, action.command].slice(
        -MAX_UNDO_STACK
      );

      return {
        ...executed,
        undoStack: newUndoStack,
        redoStack: [],
        isDirty: true,
      };
    }

    case 'SET_ZONES':
      return { ...state, zones: action.zones };

    case 'ADD_ZONE':
      return {
        ...state,
        zones: [...state.zones, action.zone],
        isDirty: true,
      };

    case 'UPDATE_ZONE':
      return {
        ...state,
        zones: state.zones.map((z) =>
          z.id === action.zoneId ? { ...z, ...action.data } : z
        ),
        isDirty: true,
      };

    case 'DELETE_ZONE':
      return {
        ...state,
        zones: state.zones.filter((z) => z.id !== action.zoneId),
        isDirty: true,
      };

    case 'TOGGLE_ZONE_VISIBILITY':
      return { ...state, zoneVisibility: !state.zoneVisibility };

    case 'MARK_DIRTY':
      return { ...state, isDirty: true };

    case 'SET_BRUSH_SIZE':
      return {
        ...state,
        brushSize: Math.max(1, Math.min(15, Math.round(action.size))),
      };

    case 'ADJUST_BRUSH_SIZE':
      return {
        ...state,
        brushSize: Math.max(1, Math.min(15, state.brushSize + action.delta)),
      };

    case 'SET_BRUSH_SHAPE':
      return { ...state, brushShape: action.shape };

    case 'SET_TILESETS': {
      // Reconstruct RetileEngine when tilesets change
      if (state.width > 0 && state.height > 0) {
        currentEngine = new RetileEngine({
          width: state.width,
          height: state.height,
          tilesets: action.tilesets,
          materials: state.materials,
          materialPriority: buildMaterialPriority(state.materials),
        });
      }
      return { ...state, tilesets: action.tilesets };
    }

    case 'SET_MATERIALS': {
      // Reconstruct RetileEngine when materials change
      if (state.width > 0 && state.height > 0) {
        currentEngine = new RetileEngine({
          width: state.width,
          height: state.height,
          tilesets: state.tilesets,
          materials: action.materials,
          materialPriority: buildMaterialPriority(action.materials),
        });
      }
      return { ...state, materials: action.materials };
    }

    case 'ADD_OBJECT_LAYER': {
      const newObjLayer: ObjectLayer = {
        type: 'object',
        id: crypto.randomUUID(),
        name: action.name,
        visible: true,
        opacity: 1,
        objects: [],
      };
      return {
        ...state,
        layers: [...state.layers, newObjLayer],
        isDirty: true,
      };
    }

    case 'PLACE_OBJECT': {
      const targetLayer = state.layers[action.layerIndex];
      if (!targetLayer || targetLayer.type !== 'object') {
        return state;
      }
      const updatedLayer: ObjectLayer = {
        ...targetLayer,
        objects: [...targetLayer.objects, action.object],
      };
      return {
        ...state,
        layers: state.layers.map((l, i) =>
          i === action.layerIndex ? updatedLayer : l
        ),
        isDirty: true,
      };
    }

    case 'REMOVE_OBJECT': {
      const removeTarget = state.layers[action.layerIndex];
      if (!removeTarget || removeTarget.type !== 'object') {
        return state;
      }
      const filteredLayer: ObjectLayer = {
        ...removeTarget,
        objects: removeTarget.objects.filter(
          (obj) => obj.id !== action.objectId
        ),
      };
      return {
        ...state,
        layers: state.layers.map((l, i) =>
          i === action.layerIndex ? filteredLayer : l
        ),
        isDirty: true,
      };
    }

    case 'MOVE_OBJECT': {
      const moveTarget = state.layers[action.layerIndex];
      if (!moveTarget || moveTarget.type !== 'object') {
        return state;
      }
      const movedLayer: ObjectLayer = {
        ...moveTarget,
        objects: moveTarget.objects.map((obj) =>
          obj.id === action.objectId
            ? { ...obj, gridX: action.gridX, gridY: action.gridY }
            : obj
        ),
      };
      return {
        ...state,
        layers: state.layers.map((l, i) =>
          i === action.layerIndex ? movedLayer : l
        ),
        isDirty: true,
      };
    }

    // --- Interaction layer actions (ADR-0017) ---

    case 'ADD_INTERACTION_LAYER': {
      const newInteractionLayer: InteractionLayer = {
        type: 'interaction',
        id: crypto.randomUUID(),
        name: action.name,
        visible: true,
        opacity: 1,
        triggers: new Map(),
      };
      return {
        ...state,
        layers: [...state.layers, newInteractionLayer],
        activeLayerIndex: state.layers.length,
        isDirty: true,
      };
    }

    case 'PLACE_TRIGGER': {
      const ptLayer = state.layers[action.layerIndex];
      if (!ptLayer || ptLayer.type !== 'interaction') return state;

      const ptKey = `${action.x},${action.y}`;
      const ptExisting = ptLayer.triggers.get(ptKey) ?? [];
      const sameTypeIdx = ptExisting.findIndex(
        (t) => t.type === action.trigger.type,
      );

      const ptUpdated =
        sameTypeIdx >= 0
          ? ptExisting.map((t, i) =>
              i === sameTypeIdx ? action.trigger : t,
            )
          : [...ptExisting, action.trigger];

      const ptTriggers = new Map(ptLayer.triggers);
      ptTriggers.set(ptKey, ptUpdated);

      const ptNewLayer: InteractionLayer = {
        ...ptLayer,
        triggers: ptTriggers,
      };
      const ptLayers = [...state.layers];
      ptLayers[action.layerIndex] = ptNewLayer;
      return { ...state, layers: ptLayers, isDirty: true };
    }

    case 'REMOVE_TRIGGER': {
      const rtLayer = state.layers[action.layerIndex];
      if (!rtLayer || rtLayer.type !== 'interaction') return state;

      const rtKey = `${action.x},${action.y}`;
      const rtTriggers = new Map(rtLayer.triggers);

      if (action.triggerIndex !== undefined) {
        const rtExisting = rtTriggers.get(rtKey) ?? [];
        const rtFiltered = rtExisting.filter(
          (_, i) => i !== action.triggerIndex,
        );
        if (rtFiltered.length === 0) {
          rtTriggers.delete(rtKey);
        } else {
          rtTriggers.set(rtKey, rtFiltered);
        }
      } else {
        rtTriggers.delete(rtKey);
      }

      const rtNewLayer: InteractionLayer = {
        ...rtLayer,
        triggers: rtTriggers,
      };
      const rtLayers = [...state.layers];
      rtLayers[action.layerIndex] = rtNewLayer;
      return { ...state, layers: rtLayers, isDirty: true };
    }

    case 'UPDATE_TRIGGER': {
      const utLayer = state.layers[action.layerIndex];
      if (!utLayer || utLayer.type !== 'interaction') return state;

      const utKey = `${action.x},${action.y}`;
      const utExisting = utLayer.triggers.get(utKey) ?? [];
      const utUpdated = utExisting.map((t, i) =>
        i === action.triggerIndex ? action.trigger : t,
      );

      const utTriggers = new Map(utLayer.triggers);
      utTriggers.set(utKey, utUpdated);

      const utNewLayer: InteractionLayer = {
        ...utLayer,
        triggers: utTriggers,
      };
      const utLayers = [...state.layers];
      utLayers[action.layerIndex] = utNewLayer;
      return { ...state, layers: utLayers, isDirty: true };
    }

    case 'SET_TRIGGER_TYPE': {
      return { ...state, activeTriggerType: action.triggerType };
    }

    default:
      return state;
  }
}

/** The main editor state management hook. */
export function useMapEditor() {
  const [state, dispatch] = useReducer(mapEditorReducer, initialState);

  const setTool = useCallback(
    (tool: EditorTool) => dispatch({ type: 'SET_TOOL', tool }),
    []
  );

  const setMaterial = useCallback(
    (materialKey: string) => dispatch({ type: 'SET_MATERIAL', materialKey }),
    []
  );

  const setActiveLayer = useCallback(
    (index: number) => dispatch({ type: 'SET_ACTIVE_LAYER', index }),
    []
  );

  const loadMap = useCallback(
    (map: LoadMapPayload) => dispatch({ type: 'LOAD_MAP', map }),
    []
  );

  /** Save the current map state to the API via PATCH. */
  const save = useCallback(async () => {
    if (!state.mapId) return;
    dispatch({ type: 'SET_SAVING', isSaving: true });
    try {
      const res = await fetch(`/api/editor-maps/${state.mapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name,
          width: state.width,
          height: state.height,
          grid: state.grid,
          layers: state.layers.map((l) => {
            if (l.type === 'interaction') {
              // Map is not JSON-serializable; convert to sparse array format
              return serializeInteractionLayer(l.name, l.triggers);
            }
            return l;
          }),
          walkable: state.walkable,
          seed: state.seed,
          metadata: state.metadata,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).error ?? `Save failed: ${res.status}`
        );
      }
      dispatch({ type: 'MARK_SAVED' });
      toast.success('Map saved');
    } catch (err) {
      dispatch({ type: 'SET_SAVING', isSaving: false });
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }, [
    state.mapId,
    state.name,
    state.grid,
    state.layers,
    state.walkable,
    state.seed,
    state.metadata,
  ]);

  /** Load a map from the API by ID and dispatch LOAD_MAP. */
  const load = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/editor-maps/${id}`);
      if (!res.ok) throw new Error('Map not found');
      const map = (await res.json()) as LoadMapPayload;
      dispatch({ type: 'LOAD_MAP', map });
    },
    [dispatch]
  );

  // Keyboard shortcuts for undo/redo and save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (!isCtrlOrMeta) return;

      // Ctrl+S = Save
      if (e.key === 's') {
        e.preventDefault();
        save();
        return;
      }

      // Ctrl+Z = Undo
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      // Ctrl+Y = Redo
      if (e.key === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      // Ctrl+Shift+Z = Redo
      if (e.key === 'Z' && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  return {
    state,
    dispatch,
    setTool,
    setMaterial,
    setActiveLayer,
    loadMap,
    save,
    load,
  };
}
