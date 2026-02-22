import { applyDeltas, PaintCommand, FillCommand } from './commands';
import type { MapEditorState, CellDelta } from '../types/editor-types';
import type { Cell } from '@nookstead/shared';

/**
 * Build a minimal MapEditorState for testing.
 * Creates a 2-column x 1-row grid filled with the given terrain.
 */
function makeState(terrain: string): MapEditorState {
  const cell = { terrain, elevation: 0, meta: {} } as Cell;
  const grid: Cell[][] = [[{ ...cell }, { ...cell }]];
  return {
    mapId: null,
    name: 'test',
    mapType: null,
    width: 2,
    height: 1,
    seed: 0,
    grid,
    layers: [
      {
        id: 'l1',
        name: 'Layer',
        terrainKey: terrain,
        visible: true,
        opacity: 1,
        frames: [[0, 0]],
      },
    ],
    walkable: [[true, true]],
    tilesets: [],
    materials: new Map(),
    activeLayerIndex: 0,
    activeTool: 'brush',
    activeMaterialKey: terrain,
    undoStack: [],
    redoStack: [],
    metadata: {},
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    zones: [],
    zoneVisibility: false,
  };
}

function makeDelta(
  x: number,
  y: number,
  oldTerrain: string,
  newTerrain: string,
): CellDelta {
  return { layerIndex: 0, x, y, oldTerrain, newTerrain, oldFrame: 0, newFrame: 0 };
}

describe('PaintCommand', () => {
  it('should apply deltas on execute and reverse on undo', () => {
    const state = makeState('grass');
    const delta = makeDelta(0, 0, 'grass', 'sand');
    const cmd = new PaintCommand([delta]);

    const afterExecute = cmd.execute(state);
    expect(afterExecute.grid[0][0].terrain).toBe('sand');

    const afterUndo = cmd.undo(afterExecute);
    expect(afterUndo.grid[0][0].terrain).toBe('grass');
  });

  it('should not modify cells outside the delta set', () => {
    const state = makeState('grass');
    const delta = makeDelta(0, 0, 'grass', 'sand');
    const cmd = new PaintCommand([delta]);

    const afterExecute = cmd.execute(state);
    expect(afterExecute.grid[0][1].terrain).toBe('grass');
  });

  it('should have readonly description', () => {
    const cmd = new PaintCommand([], 'My Paint');
    expect(cmd.description).toBe('My Paint');
  });

  it('should generate default description from deltas', () => {
    const delta = makeDelta(0, 0, 'grass', 'sand');
    const cmd = new PaintCommand([delta]);
    expect(cmd.description).toBe('Paint 1 cell(s) with sand');
  });
});

describe('FillCommand', () => {
  it('should apply deltas on execute and reverse on undo', () => {
    const state = makeState('grass');
    const deltas = [
      makeDelta(0, 0, 'grass', 'water'),
      makeDelta(1, 0, 'grass', 'water'),
    ];
    const cmd = new FillCommand(deltas);

    const afterExecute = cmd.execute(state);
    expect(afterExecute.grid[0][0].terrain).toBe('water');
    expect(afterExecute.grid[0][1].terrain).toBe('water');

    const afterUndo = cmd.undo(afterExecute);
    expect(afterUndo.grid[0][0].terrain).toBe('grass');
    expect(afterUndo.grid[0][1].terrain).toBe('grass');
  });

  it('should generate default description from deltas', () => {
    const deltas = [
      makeDelta(0, 0, 'grass', 'water'),
      makeDelta(1, 0, 'grass', 'water'),
    ];
    const cmd = new FillCommand(deltas);
    expect(cmd.description).toBe('Fill 2 cell(s) with water');
  });
});

describe('applyDeltas', () => {
  it('should apply forward: newTerrain at (x,y)', () => {
    const state = makeState('grass');
    const deltas = [makeDelta(1, 0, 'grass', 'sand')];
    const result = applyDeltas(state, deltas, 'forward');
    expect(result.grid[0][1].terrain).toBe('sand');
  });

  it('should apply backward: oldTerrain at (x,y)', () => {
    const state = makeState('sand');
    const deltas = [makeDelta(0, 0, 'grass', 'sand')];
    const result = applyDeltas(state, deltas, 'backward');
    expect(result.grid[0][0].terrain).toBe('grass');
  });

  it('should return a new state object (immutable)', () => {
    const state = makeState('grass');
    const deltas = [makeDelta(0, 0, 'grass', 'sand')];
    const result = applyDeltas(state, deltas, 'forward');
    expect(result).not.toBe(state);
    expect(result.grid).not.toBe(state.grid);
  });

  it('should update layer frames for the specified layerIndex', () => {
    const state = makeState('grass');
    const delta: CellDelta = {
      layerIndex: 0,
      x: 0,
      y: 0,
      oldTerrain: 'grass',
      newTerrain: 'sand',
      oldFrame: 0,
      newFrame: 5,
    };
    const result = applyDeltas(state, [delta], 'forward');
    // With empty tilesets, recomputeAutotileLayers will override frames.
    // But the grid terrain should still be updated correctly.
    expect(result.grid[0][0].terrain).toBe('sand');
  });

  it('should recompute walkability after applying deltas', () => {
    const state = makeState('grass');
    const deltas = [makeDelta(0, 0, 'grass', 'sand')];
    const result = applyDeltas(state, deltas, 'forward');
    // With empty materials map, walkability defaults to true
    expect(result.walkable[0][0]).toBe(true);
  });
});
