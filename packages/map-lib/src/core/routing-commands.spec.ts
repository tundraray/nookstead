// RoutingPaintCommand / RoutingFillCommand Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC8: Command System (FR9 -- EditorCommand interface compliance)

import type { TilesetInfo, MaterialInfo } from '../types/material-types';
import type { RetileEngineOptions, CellPatchEntry } from '../types/routing-types';
import type { MapEditorState, EditorCommand } from '../types/editor-types';
import type { Cell } from '@nookstead/shared';
import { RetileEngine } from './retile-engine';
import { RoutingPaintCommand, RoutingFillCommand } from './routing-commands';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makeTileset(
  key: string,
  fromMaterialKey: string,
  toMaterialKey?: string,
): TilesetInfo {
  const name = toMaterialKey ? `${fromMaterialKey}_${toMaterialKey}` : fromMaterialKey;
  return toMaterialKey
    ? { key, name, fromMaterialKey, toMaterialKey }
    : { key, name, fromMaterialKey };
}

function makeReferenceTilesets(): TilesetInfo[] {
  return [
    makeTileset('ts-deep-water', 'deep-water'),
    makeTileset('ts-water', 'water'),
    makeTileset('ts-grass', 'grass'),
    makeTileset('ts-soil', 'soil'),
    makeTileset('ts-sand', 'sand'),
    makeTileset('ts-deep-water-water', 'deep-water', 'water'),
    makeTileset('ts-water-grass', 'water', 'grass'),
    makeTileset('ts-grass-water', 'grass', 'water'),
    makeTileset('ts-soil-grass', 'soil', 'grass'),
    makeTileset('ts-sand-water', 'sand', 'water'),
    makeTileset('ts-sand-grass', 'sand', 'grass'),
  ];
}

function makePresetAPriorities(): Map<string, number> {
  return new Map([
    ['deep-water', 100],
    ['water', 90],
    ['sand', 50],
    ['grass', 30],
    ['soil', 10],
  ]);
}

function makeDefaultPreferences(): string[] {
  return ['water', 'grass', 'sand', 'soil', 'deep-water'];
}

function makeReferenceMaterials(): Map<string, MaterialInfo> {
  return new Map([
    ['deep-water', { key: 'deep-water', color: '#1a3a5c', walkable: false, renderPriority: 0, baseTilesetKey: 'ts-deep-water' }],
    ['water', { key: 'water', color: '#2980b9', walkable: false, renderPriority: 1, baseTilesetKey: 'ts-water' }],
    ['grass', { key: 'grass', color: '#2ecc71', walkable: true, renderPriority: 2, baseTilesetKey: 'ts-grass' }],
    ['soil', { key: 'soil', color: '#8b4513', walkable: true, renderPriority: 3, baseTilesetKey: 'ts-soil' }],
    ['sand', { key: 'sand', color: '#f4d03f', walkable: true, renderPriority: 4, baseTilesetKey: 'ts-sand' }],
  ]);
}

function makeCell(terrain: string): Cell {
  return { terrain, elevation: 0, meta: {} } as Cell;
}

function makeEngineOptions(width: number, height: number): RetileEngineOptions {
  return {
    width,
    height,
    tilesets: makeReferenceTilesets(),
    materials: makeReferenceMaterials(),
    materialPriority: makePresetAPriorities(),
    preferences: makeDefaultPreferences(),
  };
}

function makeUniformState(width: number, height: number, terrain: string): MapEditorState {
  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => makeCell(terrain)),
  );
  return {
    mapId: null,
    name: 'test',
    mapType: null,
    width,
    height,
    seed: 0,
    grid,
    layers: [{
      id: 'layer-1',
      name: 'Ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: height }, () => Array.from({ length: width }, () => 0)),
    }],
    walkable: Array.from({ length: height }, () => Array.from({ length: width }, () => true)),
    undoStack: [],
    redoStack: [],
    tilesets: makeReferenceTilesets(),
    materials: makeReferenceMaterials(),
    activeLayerIndex: 0,
    activeMaterialKey: terrain,
    activeTool: 'brush',
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    metadata: {},
    zones: [],
    zoneVisibility: true,
  } as MapEditorState;
}

/**
 * Helper: initialize engine cache by running a full-map paint of the initial terrain.
 * Returns the state with engine-computed layers.
 */
function initializeState(
  engine: RetileEngine,
  state: MapEditorState,
): MapEditorState {
  const patches = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      patches.push({ x, y, fg: state.grid[y][x].terrain });
    }
  }
  const result = engine.applyMapPatch(state, patches);
  return { ...state, grid: result.grid, layers: result.layers };
}

/**
 * Helper: create CellPatchEntry[] by painting cells via engine and capturing patches.
 */
function createPaintPatches(
  engine: RetileEngine,
  state: MapEditorState,
  cells: Array<{ x: number; y: number; fg: string }>,
): { patches: ReadonlyArray<CellPatchEntry>; newState: MapEditorState } {
  const result = engine.applyMapPatch(state, cells);
  const newState = { ...state, grid: result.grid, layers: result.layers };
  return { patches: result.patches, newState };
}

// ---------------------------------------------------------------------------
// RoutingPaintCommand Tests
// ---------------------------------------------------------------------------

describe('RoutingPaintCommand', () => {
  it('should implement EditorCommand interface (has execute, undo, description)', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [{ x: 1, y: 1, fg: 'soil' }]);

    const cmd: EditorCommand = new RoutingPaintCommand(patches, engine);

    expect(typeof cmd.execute).toBe('function');
    expect(typeof cmd.undo).toBe('function');
    expect(typeof cmd.description).toBe('string');
    expect(cmd.description.length).toBeGreaterThan(0);
  });

  it('should produce correct description format containing material name and count', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [
      { x: 0, y: 0, fg: 'soil' },
      { x: 1, y: 0, fg: 'soil' },
    ]);

    const cmd = new RoutingPaintCommand(patches, engine);

    expect(cmd.description).toContain('Paint');
    expect(cmd.description).toContain('soil');
    // Should contain the count of actually changed cells
    expect(cmd.description).toMatch(/\d+/);
  });

  it('should return updated state from execute with correct grid terrain', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [{ x: 1, y: 1, fg: 'soil' }]);

    const cmd = new RoutingPaintCommand(patches, engine);
    const result = cmd.execute(initState);

    expect(result.grid[1][1].terrain).toBe('soil');
    // Surrounding cells should still be deep-water
    expect(result.grid[0][0].terrain).toBe('deep-water');
  });

  it('should update walkable grid after execute', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    // deep-water is NOT walkable, soil IS walkable
    const { patches } = createPaintPatches(engine, initState, [{ x: 1, y: 1, fg: 'soil' }]);

    const cmd = new RoutingPaintCommand(patches, engine);
    const result = cmd.execute(initState);

    // soil is walkable
    expect(result.walkable[1][1]).toBe(true);
    // deep-water is not walkable
    expect(result.walkable[0][0]).toBe(false);
  });

  it('should restore original terrain after undo', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [{ x: 1, y: 1, fg: 'soil' }]);

    const cmd = new RoutingPaintCommand(patches, engine);
    const executed = cmd.execute(initState);
    const undone = cmd.undo(executed);

    expect(undone.grid[1][1].terrain).toBe('deep-water');
  });

  it('should pass round-trip: execute -> undo -> verify terrain matches original', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [
      { x: 2, y: 2, fg: 'soil' },
      { x: 3, y: 2, fg: 'soil' },
    ]);

    const cmd = new RoutingPaintCommand(patches, engine);
    const executed = cmd.execute(initState);
    const undone = cmd.undo(executed);

    // Verify ALL terrain cells match original
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(undone.grid[y][x].terrain).toBe(initState.grid[y][x].terrain);
      }
    }
  });

  it('should pass redo: execute -> undo -> execute produces same result', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [{ x: 1, y: 1, fg: 'soil' }]);

    const cmd = new RoutingPaintCommand(patches, engine);
    const firstExec = cmd.execute(initState);
    const undone = cmd.undo(firstExec);
    const redo = cmd.execute(undone);

    // Redo should match first execute terrain-wise
    expect(redo.grid[1][1].terrain).toBe('soil');
    expect(redo.grid[0][0].terrain).toBe('deep-water');
  });

  it('should not mutate input state during execute', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [{ x: 1, y: 1, fg: 'soil' }]);

    // Deep-copy a snapshot of grid terrain before execute
    const gridSnapshot = initState.grid.map(row => row.map(c => c.terrain));

    const cmd = new RoutingPaintCommand(patches, engine);
    cmd.execute(initState);

    // Verify original state was not mutated
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(initState.grid[y][x].terrain).toBe(gridSnapshot[y][x]);
      }
    }
  });

  it('should not mutate input state during undo', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [{ x: 1, y: 1, fg: 'soil' }]);

    const cmd = new RoutingPaintCommand(patches, engine);
    const executed = cmd.execute(initState);

    // Deep-copy a snapshot of executed state grid terrain
    const executedGridSnapshot = executed.grid.map(row => row.map(c => c.terrain));

    cmd.undo(executed);

    // Verify executed state was not mutated
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(executed.grid[y][x].terrain).toBe(executedGridSnapshot[y][x]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// RoutingFillCommand Tests
// ---------------------------------------------------------------------------

describe('RoutingFillCommand', () => {
  it('should implement EditorCommand interface (has execute, undo, description)', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [
      { x: 0, y: 0, fg: 'grass' },
      { x: 1, y: 0, fg: 'grass' },
      { x: 2, y: 0, fg: 'grass' },
    ]);

    const cmd: EditorCommand = new RoutingFillCommand(patches, engine);

    expect(typeof cmd.execute).toBe('function');
    expect(typeof cmd.undo).toBe('function');
    expect(typeof cmd.description).toBe('string');
    expect(cmd.description.length).toBeGreaterThan(0);
  });

  it('should have description containing "Fill" (distinct from RoutingPaintCommand)', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);
    const { patches } = createPaintPatches(engine, initState, [
      { x: 0, y: 0, fg: 'grass' },
      { x: 1, y: 0, fg: 'grass' },
    ]);

    const fillCmd = new RoutingFillCommand(patches, engine);
    const paintCmd = new RoutingPaintCommand(patches, engine);

    expect(fillCmd.description).toContain('Fill');
    expect(paintCmd.description).toContain('Paint');
    expect(fillCmd.description).not.toEqual(paintCmd.description);
  });

  it('should execute and return correct grid state', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);

    // Fill entire grid with grass
    const cells = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        cells.push({ x, y, fg: 'grass' });
      }
    }
    const { patches } = createPaintPatches(engine, initState, cells);

    const cmd = new RoutingFillCommand(patches, engine);
    const result = cmd.execute(initState);

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(result.grid[y][x].terrain).toBe('grass');
      }
    }
  });

  it('should restore original terrain after undo', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);

    const cells = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        cells.push({ x, y, fg: 'grass' });
      }
    }
    const { patches } = createPaintPatches(engine, initState, cells);

    const cmd = new RoutingFillCommand(patches, engine);
    const executed = cmd.execute(initState);
    const undone = cmd.undo(executed);

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(undone.grid[y][x].terrain).toBe('deep-water');
      }
    }
  });

  it('should pass round-trip: execute -> undo -> verify terrain === original', () => {
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'deep-water');
    const initState = initializeState(engine, state);

    const cells = [
      { x: 0, y: 0, fg: 'grass' },
      { x: 1, y: 1, fg: 'grass' },
      { x: 2, y: 2, fg: 'grass' },
    ];
    const { patches } = createPaintPatches(engine, initState, cells);

    const cmd = new RoutingFillCommand(patches, engine);
    const executed = cmd.execute(initState);
    const undone = cmd.undo(executed);

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(undone.grid[y][x].terrain).toBe(initState.grid[y][x].terrain);
      }
    }
  });
});
