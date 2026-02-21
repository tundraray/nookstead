import type { FenceCellData } from '@nookstead/shared';
import type { MapEditorState, FenceLayer } from './map-editor-types';
import {
  FencePlaceCommand,
  FenceEraseCommand,
  GateToggleCommand,
  type FenceCellDelta,
} from './map-editor-commands';

/**
 * Helper: creates a minimal MapEditorState with a single fence layer.
 * The layer has a 3x3 grid with all cells initially null and frames 0.
 */
function createTestState(overrides?: Partial<MapEditorState>): MapEditorState {
  const width = 3;
  const height = 3;

  const fenceLayer: FenceLayer = {
    id: 'fence-layer-1',
    name: 'Wooden Fence',
    type: 'fence',
    fenceTypeKey: 'wooden_fence',
    visible: true,
    opacity: 1,
    cells: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => null)
    ),
    frames: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => 0)
    ),
  };

  const walkable = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => true)
  );

  return {
    mapId: 'test-map',
    name: 'Test Map',
    mapType: null,
    width,
    height,
    seed: 42,
    grid: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ terrain: 'grass' as never }))
    ),
    layers: [fenceLayer],
    walkable,
    activeLayerIndex: 0,
    activeTool: 'fence',
    activeTerrainKey: 'terrain-01',
    activeFenceTypeKey: 'wooden_fence',
    undoStack: [],
    redoStack: [],
    metadata: {},
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    zones: [],
    zoneVisibility: true,
    ...overrides,
  };
}

function makeFenceCellData(
  overrides?: Partial<FenceCellData>
): FenceCellData {
  return {
    fenceTypeId: 'uuid-wooden',
    isGate: false,
    gateOpen: false,
    ...overrides,
  };
}

describe('FencePlaceCommand', () => {
  it('execute: applies cell data and frame to layer', () => {
    const state = createTestState();
    const newCell = makeFenceCellData();
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: null,
        newCell,
        oldFrame: 0,
        newFrame: 5,
        oldWalkable: true,
        newWalkable: false,
      },
    ];

    const cmd = new FencePlaceCommand(deltas);
    const result = cmd.execute(state);

    const layer = result.layers[0] as FenceLayer;
    expect(layer.cells[1][1]).toEqual(newCell);
    expect(layer.frames[1][1]).toBe(5);
  });

  it('execute: updates walkability for each cell', () => {
    const state = createTestState();
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 0,
        y: 0,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 3,
        oldWalkable: true,
        newWalkable: false,
      },
      {
        layerIndex: 0,
        x: 1,
        y: 0,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 7,
        oldWalkable: true,
        newWalkable: false,
      },
    ];

    const cmd = new FencePlaceCommand(deltas);
    const result = cmd.execute(state);

    expect(result.walkable[0][0]).toBe(false);
    expect(result.walkable[0][1]).toBe(false);
    // Untouched cell remains walkable
    expect(result.walkable[0][2]).toBe(true);
  });

  it('undo: restores previous cell data and frame', () => {
    const state = createTestState();
    const newCell = makeFenceCellData();
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: null,
        newCell,
        oldFrame: 0,
        newFrame: 5,
        oldWalkable: true,
        newWalkable: false,
      },
    ];

    const cmd = new FencePlaceCommand(deltas);
    const afterExecute = cmd.execute(state);
    const afterUndo = cmd.undo(afterExecute);

    const layer = afterUndo.layers[0] as FenceLayer;
    expect(layer.cells[1][1]).toBeNull();
    expect(layer.frames[1][1]).toBe(0);
  });

  it('undo: restores previous walkability', () => {
    const state = createTestState();
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 5,
        oldWalkable: true,
        newWalkable: false,
      },
    ];

    const cmd = new FencePlaceCommand(deltas);
    const afterExecute = cmd.execute(state);
    expect(afterExecute.walkable[1][1]).toBe(false);

    const afterUndo = cmd.undo(afterExecute);
    expect(afterUndo.walkable[1][1]).toBe(true);
  });

  it('multi-cell place undoes all cells as one atomic operation', () => {
    const state = createTestState();
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 0,
        y: 0,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 1,
        oldWalkable: true,
        newWalkable: false,
      },
      {
        layerIndex: 0,
        x: 1,
        y: 0,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 2,
        oldWalkable: true,
        newWalkable: false,
      },
      {
        layerIndex: 0,
        x: 2,
        y: 0,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 3,
        oldWalkable: true,
        newWalkable: false,
      },
    ];

    const cmd = new FencePlaceCommand(deltas);
    const afterExecute = cmd.execute(state);

    // All 3 cells placed
    const layerAfter = afterExecute.layers[0] as FenceLayer;
    expect(layerAfter.cells[0][0]).not.toBeNull();
    expect(layerAfter.cells[0][1]).not.toBeNull();
    expect(layerAfter.cells[0][2]).not.toBeNull();

    // Single undo restores all 3
    const afterUndo = cmd.undo(afterExecute);
    const layerUndo = afterUndo.layers[0] as FenceLayer;
    expect(layerUndo.cells[0][0]).toBeNull();
    expect(layerUndo.cells[0][1]).toBeNull();
    expect(layerUndo.cells[0][2]).toBeNull();
    expect(layerUndo.frames[0][0]).toBe(0);
    expect(layerUndo.frames[0][1]).toBe(0);
    expect(layerUndo.frames[0][2]).toBe(0);
    expect(afterUndo.walkable[0][0]).toBe(true);
    expect(afterUndo.walkable[0][1]).toBe(true);
    expect(afterUndo.walkable[0][2]).toBe(true);
  });

  it('execute then undo produces state identical to original', () => {
    const state = createTestState();
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 10,
        oldWalkable: true,
        newWalkable: false,
      },
    ];

    const cmd = new FencePlaceCommand(deltas);
    const afterExecute = cmd.execute(state);
    const afterUndo = cmd.undo(afterExecute);

    // Compare layer data
    const originalLayer = state.layers[0] as FenceLayer;
    const undoneLayer = afterUndo.layers[0] as FenceLayer;
    expect(undoneLayer.cells).toEqual(originalLayer.cells);
    expect(undoneLayer.frames).toEqual(originalLayer.frames);
    expect(afterUndo.walkable).toEqual(state.walkable);
  });

  it('redo (execute after undo) produces same result as original execute', () => {
    const state = createTestState();
    const newCell = makeFenceCellData();
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 2,
        oldCell: null,
        newCell,
        oldFrame: 0,
        newFrame: 8,
        oldWalkable: true,
        newWalkable: false,
      },
    ];

    const cmd = new FencePlaceCommand(deltas);
    const firstExecute = cmd.execute(state);
    const afterUndo = cmd.undo(firstExecute);
    const redo = cmd.execute(afterUndo);

    const layer = redo.layers[0] as FenceLayer;
    expect(layer.cells[2][1]).toEqual(newCell);
    expect(layer.frames[2][1]).toBe(8);
    expect(redo.walkable[2][1]).toBe(false);
  });

  it('has a descriptive description', () => {
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 0,
        y: 0,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 1,
        oldWalkable: true,
        newWalkable: false,
      },
    ];
    const cmd = new FencePlaceCommand(deltas);
    expect(cmd.description).toContain('1');
    expect(typeof cmd.description).toBe('string');
  });
});

describe('FenceEraseCommand', () => {
  it('execute: sets cells to null and frames to 0', () => {
    // Start with a fence placed at (1,1)
    const state = createTestState();
    const existingCell = makeFenceCellData();
    (state.layers[0] as FenceLayer).cells[1][1] = existingCell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    state.walkable[1][1] = false;

    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: existingCell,
        newCell: null,
        oldFrame: 5,
        newFrame: 0,
        oldWalkable: false,
        newWalkable: true,
      },
    ];

    const cmd = new FenceEraseCommand(deltas);
    const result = cmd.execute(state);

    const layer = result.layers[0] as FenceLayer;
    expect(layer.cells[1][1]).toBeNull();
    expect(layer.frames[1][1]).toBe(0);
    expect(result.walkable[1][1]).toBe(true);
  });

  it('execute: includes neighbor frame recalculation via deltas', () => {
    // Erasing a cell should also include neighbor frame changes in deltas.
    // The command itself just applies deltas; frame recalculation happens at
    // delta creation time. We verify neighbor deltas are applied correctly.
    const state = createTestState();
    const cell = makeFenceCellData();

    // Pre-populate cells at (1,1) and its neighbor (1,0)
    (state.layers[0] as FenceLayer).cells[1][1] = cell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    (state.layers[0] as FenceLayer).cells[0][1] = cell;
    (state.layers[0] as FenceLayer).frames[0][1] = 9;
    state.walkable[1][1] = false;

    const deltas: FenceCellDelta[] = [
      // Erased cell
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: cell,
        newCell: null,
        oldFrame: 5,
        newFrame: 0,
        oldWalkable: false,
        newWalkable: true,
      },
      // Neighbor frame update (cell data unchanged, frame recalculated)
      {
        layerIndex: 0,
        x: 1,
        y: 0,
        oldCell: cell,
        newCell: cell,
        oldFrame: 9,
        newFrame: 4,
        oldWalkable: false,
        newWalkable: false,
      },
    ];

    const cmd = new FenceEraseCommand(deltas);
    const result = cmd.execute(state);

    const layer = result.layers[0] as FenceLayer;
    // Erased cell
    expect(layer.cells[1][1]).toBeNull();
    expect(layer.frames[1][1]).toBe(0);
    // Neighbor frame recalculated
    expect(layer.cells[0][1]).toEqual(cell);
    expect(layer.frames[0][1]).toBe(4);
  });

  it('undo: restores erased cells and frames', () => {
    const state = createTestState();
    const existingCell = makeFenceCellData();
    (state.layers[0] as FenceLayer).cells[1][1] = existingCell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    state.walkable[1][1] = false;

    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: existingCell,
        newCell: null,
        oldFrame: 5,
        newFrame: 0,
        oldWalkable: false,
        newWalkable: true,
      },
    ];

    const cmd = new FenceEraseCommand(deltas);
    const afterErase = cmd.execute(state);
    const afterUndo = cmd.undo(afterErase);

    const layer = afterUndo.layers[0] as FenceLayer;
    expect(layer.cells[1][1]).toEqual(existingCell);
    expect(layer.frames[1][1]).toBe(5);
    expect(afterUndo.walkable[1][1]).toBe(false);
  });

  it('undo: restores neighbor frames after erase undo', () => {
    const state = createTestState();
    const cell = makeFenceCellData();

    (state.layers[0] as FenceLayer).cells[1][1] = cell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    (state.layers[0] as FenceLayer).cells[0][1] = cell;
    (state.layers[0] as FenceLayer).frames[0][1] = 9;
    state.walkable[1][1] = false;

    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: cell,
        newCell: null,
        oldFrame: 5,
        newFrame: 0,
        oldWalkable: false,
        newWalkable: true,
      },
      {
        layerIndex: 0,
        x: 1,
        y: 0,
        oldCell: cell,
        newCell: cell,
        oldFrame: 9,
        newFrame: 4,
        oldWalkable: false,
        newWalkable: false,
      },
    ];

    const cmd = new FenceEraseCommand(deltas);
    const afterErase = cmd.execute(state);
    const afterUndo = cmd.undo(afterErase);

    const layer = afterUndo.layers[0] as FenceLayer;
    expect(layer.cells[1][1]).toEqual(cell);
    expect(layer.frames[1][1]).toBe(5);
    expect(layer.cells[0][1]).toEqual(cell);
    expect(layer.frames[0][1]).toBe(9);
  });

  it('has a descriptive description', () => {
    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 0,
        y: 0,
        oldCell: makeFenceCellData(),
        newCell: null,
        oldFrame: 1,
        newFrame: 0,
        oldWalkable: false,
        newWalkable: true,
      },
    ];
    const cmd = new FenceEraseCommand(deltas);
    expect(cmd.description).toContain('1');
    expect(typeof cmd.description).toBe('string');
  });
});

describe('GateToggleCommand', () => {
  it('execute: toggles isGate on target cell', () => {
    const state = createTestState();
    const oldCell = makeFenceCellData({ isGate: false });
    const newCell = makeFenceCellData({ isGate: true });

    (state.layers[0] as FenceLayer).cells[1][1] = oldCell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    state.walkable[1][1] = false;

    const delta: FenceCellDelta = {
      layerIndex: 0,
      x: 1,
      y: 1,
      oldCell,
      newCell,
      oldFrame: 5,
      newFrame: 17,
      oldWalkable: false,
      newWalkable: false,
    };

    const cmd = new GateToggleCommand(delta);
    const result = cmd.execute(state);

    const layer = result.layers[0] as FenceLayer;
    expect(layer.cells[1][1]).toEqual(newCell);
    expect(layer.cells[1][1]?.isGate).toBe(true);
  });

  it('execute: updates frame to gate variant', () => {
    const state = createTestState();
    const oldCell = makeFenceCellData({ isGate: false });
    const newCell = makeFenceCellData({ isGate: true });

    (state.layers[0] as FenceLayer).cells[1][1] = oldCell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    state.walkable[1][1] = false;

    const delta: FenceCellDelta = {
      layerIndex: 0,
      x: 1,
      y: 1,
      oldCell,
      newCell,
      oldFrame: 5,
      newFrame: 17,
      oldWalkable: false,
      newWalkable: false,
    };

    const cmd = new GateToggleCommand(delta);
    const result = cmd.execute(state);

    const layer = result.layers[0] as FenceLayer;
    expect(layer.frames[1][1]).toBe(17);
  });

  it('undo: restores previous gate state and frame', () => {
    const state = createTestState();
    const oldCell = makeFenceCellData({ isGate: false });
    const newCell = makeFenceCellData({ isGate: true });

    (state.layers[0] as FenceLayer).cells[1][1] = oldCell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    state.walkable[1][1] = false;

    const delta: FenceCellDelta = {
      layerIndex: 0,
      x: 1,
      y: 1,
      oldCell,
      newCell,
      oldFrame: 5,
      newFrame: 17,
      oldWalkable: false,
      newWalkable: false,
    };

    const cmd = new GateToggleCommand(delta);
    const afterToggle = cmd.execute(state);
    const afterUndo = cmd.undo(afterToggle);

    const layer = afterUndo.layers[0] as FenceLayer;
    expect(layer.cells[1][1]).toEqual(oldCell);
    expect(layer.cells[1][1]?.isGate).toBe(false);
    expect(layer.frames[1][1]).toBe(5);
  });

  it('undo is idempotent (double-undo does not corrupt state)', () => {
    const state = createTestState();
    const oldCell = makeFenceCellData({ isGate: false });
    const newCell = makeFenceCellData({ isGate: true });

    (state.layers[0] as FenceLayer).cells[1][1] = oldCell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    state.walkable[1][1] = false;

    const delta: FenceCellDelta = {
      layerIndex: 0,
      x: 1,
      y: 1,
      oldCell,
      newCell,
      oldFrame: 5,
      newFrame: 17,
      oldWalkable: false,
      newWalkable: false,
    };

    const cmd = new GateToggleCommand(delta);
    const afterToggle = cmd.execute(state);
    const afterUndo1 = cmd.undo(afterToggle);
    const afterUndo2 = cmd.undo(afterUndo1);

    // Both undos should produce the same state
    const layer1 = afterUndo1.layers[0] as FenceLayer;
    const layer2 = afterUndo2.layers[0] as FenceLayer;
    expect(layer2.cells[1][1]).toEqual(layer1.cells[1][1]);
    expect(layer2.frames[1][1]).toBe(layer1.frames[1][1]);
    expect(afterUndo2.walkable).toEqual(afterUndo1.walkable);
  });

  it('execute updates walkability when gate opens', () => {
    const state = createTestState();
    const closedGate = makeFenceCellData({ isGate: true, gateOpen: false });
    const openGate = makeFenceCellData({ isGate: true, gateOpen: true });

    (state.layers[0] as FenceLayer).cells[1][1] = closedGate;
    (state.layers[0] as FenceLayer).frames[1][1] = 17;
    state.walkable[1][1] = false;

    const delta: FenceCellDelta = {
      layerIndex: 0,
      x: 1,
      y: 1,
      oldCell: closedGate,
      newCell: openGate,
      oldFrame: 17,
      newFrame: 18,
      oldWalkable: false,
      newWalkable: true,
    };

    const cmd = new GateToggleCommand(delta);
    const result = cmd.execute(state);

    expect(result.walkable[1][1]).toBe(true);
    const layer = result.layers[0] as FenceLayer;
    expect(layer.cells[1][1]?.gateOpen).toBe(true);
  });

  it('has a descriptive description', () => {
    const delta: FenceCellDelta = {
      layerIndex: 0,
      x: 1,
      y: 1,
      oldCell: makeFenceCellData(),
      newCell: makeFenceCellData({ isGate: true }),
      oldFrame: 5,
      newFrame: 17,
      oldWalkable: false,
      newWalkable: false,
    };
    const cmd = new GateToggleCommand(delta);
    expect(typeof cmd.description).toBe('string');
    expect(cmd.description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Task 6A: Undo/Redo Stress Test
// ---------------------------------------------------------------------------

describe('Undo/redo stress test', () => {
  function createLargeTestState(): MapEditorState {
    const width = 10;
    const height = 10;

    const fenceLayer: FenceLayer = {
      id: 'fence-layer-1',
      name: 'Wooden Fence',
      type: 'fence',
      fenceTypeKey: 'wooden_fence',
      visible: true,
      opacity: 1,
      cells: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => null)
      ),
      frames: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => 0)
      ),
    };

    const walkable = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => true)
    );

    return {
      mapId: 'test-map',
      name: 'Test Map',
      mapType: null,
      width,
      height,
      seed: 42,
      grid: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({ terrain: 'grass' as never }))
      ),
      layers: [fenceLayer],
      walkable,
      activeLayerIndex: 0,
      activeTool: 'fence',
      activeTerrainKey: 'terrain-01',
      activeFenceTypeKey: 'wooden_fence',
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

  it('20 place operations: undo all -> empty, redo all -> exact match', () => {
    const initial = createLargeTestState();

    // Record initial state (deep copy)
    const initialLayer = initial.layers[0] as FenceLayer;
    const initialCells = JSON.parse(JSON.stringify(initialLayer.cells));
    const initialFrames = JSON.parse(JSON.stringify(initialLayer.frames));
    const initialWalkable = JSON.parse(JSON.stringify(initial.walkable));

    // Create 20 single-cell place commands spread across the grid
    const commands: FencePlaceCommand[] = [];
    const positions = [
      { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 0 },
      { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 }, { x: 8, y: 2 },
      { x: 0, y: 4 }, { x: 2, y: 4 }, { x: 4, y: 4 }, { x: 6, y: 4 }, { x: 8, y: 4 },
      { x: 0, y: 6 }, { x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }, { x: 8, y: 6 },
    ];

    let state = initial;
    for (let i = 0; i < 20; i++) {
      const { x, y } = positions[i];
      const delta: FenceCellDelta = {
        layerIndex: 0,
        x,
        y,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 1 + i, // distinct frame for each to verify ordering
        oldWalkable: true,
        newWalkable: false,
      };
      const cmd = new FencePlaceCommand([delta]);
      commands.push(cmd);
      state = cmd.execute(state);
    }

    // Record state after all 20 operations
    const afterAllLayer = state.layers[0] as FenceLayer;
    const afterAllCells = JSON.parse(JSON.stringify(afterAllLayer.cells));
    const afterAllFrames = JSON.parse(JSON.stringify(afterAllLayer.frames));
    const afterAllWalkable = JSON.parse(JSON.stringify(state.walkable));

    // Verify all 20 cells are placed
    for (const { x, y } of positions) {
      expect(afterAllLayer.cells[y][x]).not.toBeNull();
      expect(state.walkable[y][x]).toBe(false);
    }

    // Undo all 20 operations (reverse order)
    for (let i = 19; i >= 0; i--) {
      state = commands[i].undo(state);
    }

    // After undoing all: map should be empty
    const undoneLayer = state.layers[0] as FenceLayer;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(undoneLayer.cells[y][x]).toBeNull();
        expect(undoneLayer.frames[y][x]).toBe(0);
      }
    }
    expect(undoneLayer.cells).toEqual(initialCells);
    expect(undoneLayer.frames).toEqual(initialFrames);
    expect(state.walkable).toEqual(initialWalkable);

    // Redo all 20 operations (forward order)
    for (let i = 0; i < 20; i++) {
      state = commands[i].execute(state);
    }

    // State should exactly match the state after original 20 operations
    const redonLayer = state.layers[0] as FenceLayer;
    expect(redonLayer.cells).toEqual(afterAllCells);
    expect(redonLayer.frames).toEqual(afterAllFrames);
    expect(state.walkable).toEqual(afterAllWalkable);
  });

  it('mixed place/erase/gate commands: undo all restores clean state', () => {
    const state0 = createLargeTestState();

    // Record initial state
    const initialCells = JSON.parse(
      JSON.stringify((state0.layers[0] as FenceLayer).cells)
    );

    // Place 5 fences in a corridor shape for gate placement
    const placeDeltas: FenceCellDelta[] = [
      { layerIndex: 0, x: 3, y: 3, oldCell: null, newCell: makeFenceCellData(), oldFrame: 0, newFrame: 4, oldWalkable: true, newWalkable: false },
      { layerIndex: 0, x: 3, y: 4, oldCell: null, newCell: makeFenceCellData(), oldFrame: 0, newFrame: 5, oldWalkable: true, newWalkable: false },
      { layerIndex: 0, x: 3, y: 5, oldCell: null, newCell: makeFenceCellData(), oldFrame: 0, newFrame: 5, oldWalkable: true, newWalkable: false },
      { layerIndex: 0, x: 3, y: 6, oldCell: null, newCell: makeFenceCellData(), oldFrame: 0, newFrame: 5, oldWalkable: true, newWalkable: false },
      { layerIndex: 0, x: 3, y: 7, oldCell: null, newCell: makeFenceCellData(), oldFrame: 0, newFrame: 1, oldWalkable: true, newWalkable: false },
    ];
    const cmd1 = new FencePlaceCommand(placeDeltas);
    const state1 = cmd1.execute(state0);

    // Toggle gate at (3,5) - middle of corridor
    const gateCell = makeFenceCellData({ isGate: true });
    const gateDelta: FenceCellDelta = {
      layerIndex: 0, x: 3, y: 5,
      oldCell: makeFenceCellData(), newCell: gateCell,
      oldFrame: 5, newFrame: 17,
      oldWalkable: false, newWalkable: false,
    };
    const cmd2 = new GateToggleCommand(gateDelta);
    const state2 = cmd2.execute(state1);

    // Erase fence at (3,7)
    const eraseDeltas: FenceCellDelta[] = [
      { layerIndex: 0, x: 3, y: 7, oldCell: makeFenceCellData(), newCell: null, oldFrame: 1, newFrame: 0, oldWalkable: false, newWalkable: true },
    ];
    const cmd3 = new FenceEraseCommand(eraseDeltas);
    const state3 = cmd3.execute(state2);

    // Now undo all 3 commands
    const undo3 = cmd3.undo(state3);
    const undo2 = cmd2.undo(undo3);
    const undo1 = cmd1.undo(undo2);

    // Should be back to clean state
    const finalLayer = undo1.layers[0] as FenceLayer;
    expect(finalLayer.cells).toEqual(initialCells);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(finalLayer.cells[y][x]).toBeNull();
      }
    }
  });
});

describe('Fence command immutability', () => {
  it('FencePlaceCommand.execute does not mutate original state', () => {
    const state = createTestState();
    const originalCells = JSON.parse(
      JSON.stringify((state.layers[0] as FenceLayer).cells)
    );
    const originalFrames = JSON.parse(
      JSON.stringify((state.layers[0] as FenceLayer).frames)
    );
    const originalWalkable = JSON.parse(JSON.stringify(state.walkable));

    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: null,
        newCell: makeFenceCellData(),
        oldFrame: 0,
        newFrame: 5,
        oldWalkable: true,
        newWalkable: false,
      },
    ];

    const cmd = new FencePlaceCommand(deltas);
    cmd.execute(state);

    // Original state must not be mutated
    expect((state.layers[0] as FenceLayer).cells).toEqual(originalCells);
    expect((state.layers[0] as FenceLayer).frames).toEqual(originalFrames);
    expect(state.walkable).toEqual(originalWalkable);
  });

  it('FenceEraseCommand.execute does not mutate original state', () => {
    const state = createTestState();
    const cell = makeFenceCellData();
    (state.layers[0] as FenceLayer).cells[1][1] = cell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;
    state.walkable[1][1] = false;

    const originalCells = JSON.parse(
      JSON.stringify((state.layers[0] as FenceLayer).cells)
    );

    const deltas: FenceCellDelta[] = [
      {
        layerIndex: 0,
        x: 1,
        y: 1,
        oldCell: cell,
        newCell: null,
        oldFrame: 5,
        newFrame: 0,
        oldWalkable: false,
        newWalkable: true,
      },
    ];

    const cmd = new FenceEraseCommand(deltas);
    cmd.execute(state);

    expect((state.layers[0] as FenceLayer).cells).toEqual(originalCells);
  });

  it('GateToggleCommand.execute does not mutate original state', () => {
    const state = createTestState();
    const oldCell = makeFenceCellData({ isGate: false });
    (state.layers[0] as FenceLayer).cells[1][1] = oldCell;
    (state.layers[0] as FenceLayer).frames[1][1] = 5;

    const originalCells = JSON.parse(
      JSON.stringify((state.layers[0] as FenceLayer).cells)
    );

    const delta: FenceCellDelta = {
      layerIndex: 0,
      x: 1,
      y: 1,
      oldCell,
      newCell: makeFenceCellData({ isGate: true }),
      oldFrame: 5,
      newFrame: 17,
      oldWalkable: false,
      newWalkable: false,
    };

    const cmd = new GateToggleCommand(delta);
    cmd.execute(state);

    expect((state.layers[0] as FenceLayer).cells).toEqual(originalCells);
  });
});
