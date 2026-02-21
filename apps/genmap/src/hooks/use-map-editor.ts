'use client';

import { useReducer, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { Cell } from '@nookstead/map-lib';
import type {
  MapEditorState,
  MapEditorAction,
  EditorTool,
  EditorLayer,
  EditorLayerUnion,
  TileLayer,
  FenceLayer,
  LoadMapPayload,
  PlacedObject,
  ObjectLayer,
} from './map-editor-types';
import type { MapType } from '@nookstead/map-lib';
import {
  recalculateAffectedCells,
  updateCellWalkability,
  canPlaceGate,
  getGateFrameIndex,
  getFenceFrame,
  computeFenceBitmask,
  FENCE_EMPTY_FRAME,
} from '@nookstead/map-lib';
import type { FenceLayerSnapshot } from '@nookstead/map-lib';
import type { FenceCellData } from '@nookstead/shared';
import { isWalkable } from '@nookstead/map-lib';
import type { TerrainCellType } from '@nookstead/map-lib';

const DEFAULT_WIDTH = 32;
const DEFAULT_HEIGHT = 32;
const DEFAULT_TERRAIN = 'deep_water' as const;
const DEFAULT_TERRAIN_KEY = 'terrain-01';
const DEFAULT_LAYER_NAME = 'ground';

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
    activeLayerIndex: 0,
    activeTool: 'brush',
    activeTerrainKey: DEFAULT_TERRAIN_KEY,
    activeFenceTypeKey: '',
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
 * Resize a 2D fence cells array to new dimensions.
 * Expanding adds null (empty); truncating slices from right and bottom.
 */
function resizeFenceCells(
  cells: (FenceCellData | null)[][],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): (FenceCellData | null)[][] {
  const resized: (FenceCellData | null)[][] = [];
  for (let y = 0; y < newHeight; y++) {
    const row: (FenceCellData | null)[] = [];
    for (let x = 0; x < newWidth; x++) {
      if (y < oldHeight && x < oldWidth) {
        row.push(cells[y][x]);
      } else {
        row.push(null);
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
 * Layers with `type: 'fence'` are treated as FenceLayer.
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

  if (l.type === 'fence') {
    const fenceLayer: FenceLayer = {
      type: 'fence',
      id: (l.id as string) || crypto.randomUUID(),
      name: (l.name as string) || 'fence',
      fenceTypeKey: (l.fenceTypeKey as string) || '',
      visible: l.visible !== undefined ? (l.visible as boolean) : true,
      opacity: l.opacity !== undefined ? (l.opacity as number) : 1,
      cells:
        (l.cells as (FenceCellData | null)[][]) ||
        createEmptyFenceCells(width, height),
      frames: (l.frames as number[][]) || createEmptyFrames(width, height),
    };
    return fenceLayer;
  }

  // Default: TileLayer
  const tileLayer: TileLayer = {
    type: 'tile',
    id: (l.id as string) || crypto.randomUUID(),
    name: (l.name as string) || 'untitled',
    terrainKey: (l.terrainKey as string) || DEFAULT_TERRAIN_KEY,
    visible: l.visible !== undefined ? (l.visible as boolean) : true,
    opacity: l.opacity !== undefined ? (l.opacity as number) : 1,
    frames: (l.frames as number[][]) || createEmptyFrames(width, height),
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

/**
 * Create an empty 2D array of null FenceCellData for fence layer cells.
 */
function createEmptyFenceCells(
  width: number,
  height: number
): (FenceCellData | null)[][] {
  const cells: (FenceCellData | null)[][] = [];
  for (let y = 0; y < height; y++) {
    const row: (FenceCellData | null)[] = [];
    for (let x = 0; x < width; x++) {
      row.push(null);
    }
    cells.push(row);
  }
  return cells;
}

/**
 * Compute terrain-only walkability for a single cell.
 */
function terrainWalkableAt(grid: import('@nookstead/map-lib').Cell[][], x: number, y: number): boolean {
  return isWalkable(grid[y][x].terrain as TerrainCellType);
}

/**
 * Build a terrain-only walkability grid from the full grid.
 */
function buildTerrainWalkable(grid: import('@nookstead/map-lib').Cell[][], width: number, height: number): boolean[][] {
  const tw: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    tw[y] = [];
    for (let x = 0; x < width; x++) {
      tw[y][x] = terrainWalkableAt(grid, x, y);
    }
  }
  return tw;
}

/**
 * Collect all fence layers from the layers array as FenceLayerSnapshot[].
 */
function collectFenceSnapshots(layers: EditorLayerUnion[]): FenceLayerSnapshot[] {
  return layers
    .filter((l): l is FenceLayer => l.type === 'fence')
    .map((l) => ({ cells: l.cells }));
}

/** The core reducer for the map editor. */
export function mapEditorReducer(
  state: MapEditorState,
  action: MapEditorAction
): MapEditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, activeTool: action.tool };

    case 'SET_TERRAIN':
      return { ...state, activeTerrainKey: action.terrainKey };

    case 'SET_ACTIVE_LAYER':
      return { ...state, activeLayerIndex: action.index };

    case 'LOAD_MAP': {
      const { map } = action;
      const editorLayers = toEditorLayers(
        map.layers,
        map.width,
        map.height
      );
      return {
        ...state,
        mapId: map.id,
        name: map.name,
        mapType: (map.mapType as MapType) || null,
        width: map.width,
        height: map.height,
        seed: map.seed ?? 0,
        grid: map.grid,
        layers: editorLayers,
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
        if (layer.type === 'fence') {
          // Fence layers have both cells and frames to resize
          return {
            ...layer,
            cells: resizeFenceCells(
              layer.cells,
              state.width,
              state.height,
              newWidth,
              newHeight
            ),
            frames: resizeFrames(
              layer.frames,
              state.width,
              state.height,
              newWidth,
              newHeight
            ),
          };
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

    // --- Fence layer actions ---

    case 'SET_FENCE_TYPE':
      return { ...state, activeFenceTypeKey: action.fenceTypeKey };

    case 'ADD_FENCE_LAYER': {
      const newFenceLayer: FenceLayer = {
        type: 'fence',
        id: crypto.randomUUID(),
        name: action.name,
        fenceTypeKey: action.fenceTypeKey,
        visible: true,
        opacity: 1,
        cells: createEmptyFenceCells(state.width, state.height),
        frames: createEmptyFrames(state.width, state.height),
      };
      return {
        ...state,
        layers: [...state.layers, newFenceLayer],
        isDirty: true,
      };
    }

    case 'PLACE_FENCE': {
      const placeTarget = state.layers[action.layerIndex];
      if (!placeTarget || placeTarget.type !== 'fence') {
        return state;
      }

      // Deep-copy cells and frames for immutable update
      const placeCells = placeTarget.cells.map((row) => [...row]);
      const placeFrames = placeTarget.frames.map((row) => [...row]);

      // Determine fenceTypeId from the layer's fenceTypeKey
      const fenceTypeId = placeTarget.fenceTypeKey;

      // Place fence cells at given positions (skip if already occupied by same type)
      const placedPositions: { x: number; y: number }[] = [];
      for (const pos of action.positions) {
        const { x, y } = pos;
        if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
        if (placeCells[y][x] !== null) continue; // Already occupied
        placeCells[y][x] = {
          fenceTypeId,
          isGate: false,
          gateOpen: false,
        };
        placedPositions.push({ x, y });
      }

      if (placedPositions.length === 0) return state;

      // Build the updated fence layer for recalculation
      const placeLayer = { cells: placeCells, frames: placeFrames };
      recalculateAffectedCells(
        placeLayer,
        placedPositions,
        state.width,
        state.height
      );

      // Update walkability for placed cells
      const terrainWalkable = buildTerrainWalkable(
        state.grid,
        state.width,
        state.height
      );
      const updatedFenceLayer: FenceLayer = {
        ...placeTarget,
        cells: placeLayer.cells as (FenceCellData | null)[][],
        frames: placeLayer.frames,
      };
      const newPlaceLayers = state.layers.map((l, i) =>
        i === action.layerIndex ? updatedFenceLayer : l
      );
      const fenceSnapshots = collectFenceSnapshots(newPlaceLayers);
      const newPlaceWalkable = state.walkable.map((row) => [...row]);
      for (const pos of placedPositions) {
        updateCellWalkability(
          newPlaceWalkable,
          terrainWalkable,
          fenceSnapshots,
          pos.x,
          pos.y
        );
      }

      return {
        ...state,
        layers: newPlaceLayers,
        walkable: newPlaceWalkable,
        isDirty: true,
      };
    }

    case 'ERASE_FENCE': {
      const eraseTarget = state.layers[action.layerIndex];
      if (!eraseTarget || eraseTarget.type !== 'fence') {
        return state;
      }

      // Deep-copy cells and frames
      const eraseCells = eraseTarget.cells.map((row) => [...row]);
      const eraseFrames = eraseTarget.frames.map((row) => [...row]);

      // Remove fence cells at given positions
      const erasedPositions: { x: number; y: number }[] = [];
      for (const pos of action.positions) {
        const { x, y } = pos;
        if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
        if (eraseCells[y][x] === null) continue; // Already empty
        eraseCells[y][x] = null;
        eraseFrames[y][x] = FENCE_EMPTY_FRAME;
        erasedPositions.push({ x, y });
      }

      if (erasedPositions.length === 0) return state;

      // Recalculate neighbors
      const eraseLayer = { cells: eraseCells, frames: eraseFrames };
      recalculateAffectedCells(
        eraseLayer,
        erasedPositions,
        state.width,
        state.height
      );

      // Update walkability
      const eraseTerrainWalkable = buildTerrainWalkable(
        state.grid,
        state.width,
        state.height
      );
      const updatedEraseLayer: FenceLayer = {
        ...eraseTarget,
        cells: eraseLayer.cells as (FenceCellData | null)[][],
        frames: eraseLayer.frames,
      };
      const newEraseLayers = state.layers.map((l, i) =>
        i === action.layerIndex ? updatedEraseLayer : l
      );
      const eraseSnapshots = collectFenceSnapshots(newEraseLayers);
      const newEraseWalkable = state.walkable.map((row) => [...row]);
      for (const pos of erasedPositions) {
        updateCellWalkability(
          newEraseWalkable,
          eraseTerrainWalkable,
          eraseSnapshots,
          pos.x,
          pos.y
        );
      }

      return {
        ...state,
        layers: newEraseLayers,
        walkable: newEraseWalkable,
        isDirty: true,
      };
    }

    case 'TOGGLE_GATE': {
      const gateTarget = state.layers[action.layerIndex];
      if (!gateTarget || gateTarget.type !== 'fence') {
        return state;
      }

      const { x, y } = action;
      if (x < 0 || x >= state.width || y < 0 || y >= state.height) {
        return state;
      }

      const gateCell = gateTarget.cells[y][x];
      if (gateCell === null) return state;

      // Deep-copy cells and frames
      const gateCells = gateTarget.cells.map((row) => [...row]);
      const gateFrames = gateTarget.frames.map((row) => [...row]);

      if (gateCell.isGate) {
        // Remove gate: revert to regular fence
        const bitmask = computeFenceBitmask(gateCells, x, y, state.width, state.height);
        gateCells[y][x] = {
          ...gateCell,
          isGate: false,
          gateOpen: false,
        };
        gateFrames[y][x] = getFenceFrame(bitmask);
      } else {
        // Place gate: validate corridor constraint
        if (!canPlaceGate(gateCells, x, y, state.width, state.height)) {
          return state;
        }
        const bitmask = computeFenceBitmask(gateCells, x, y, state.width, state.height);
        gateCells[y][x] = {
          ...gateCell,
          isGate: true,
          gateOpen: false,
        };
        gateFrames[y][x] = getGateFrameIndex(bitmask, false);
      }

      // Update walkability for the toggled cell
      const gateTerrainWalkable = buildTerrainWalkable(
        state.grid,
        state.width,
        state.height
      );
      const updatedGateLayer: FenceLayer = {
        ...gateTarget,
        cells: gateCells as (FenceCellData | null)[][],
        frames: gateFrames,
      };
      const newGateLayers = state.layers.map((l, i) =>
        i === action.layerIndex ? updatedGateLayer : l
      );
      const gateSnapshots = collectFenceSnapshots(newGateLayers);
      const newGateWalkable = state.walkable.map((row) => [...row]);
      updateCellWalkability(
        newGateWalkable,
        gateTerrainWalkable,
        gateSnapshots,
        x,
        y
      );

      return {
        ...state,
        layers: newGateLayers,
        walkable: newGateWalkable,
        isDirty: true,
      };
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

  const setTerrain = useCallback(
    (terrainKey: string) => dispatch({ type: 'SET_TERRAIN', terrainKey }),
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
          grid: state.grid,
          layers: state.layers,
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
    setTerrain,
    setActiveLayer,
    loadMap,
    save,
    load,
  };
}
