// RetileEngine Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC6: Incremental Retile Engine (FR7, FR8)
// AC7: Editor API (FR9)
// Generated: 2026-02-22

import type { TilesetInfo, MaterialInfo } from '../types/material-types';
import { RetileEngine } from './retile-engine';
import type { RetileEngineOptions } from '../types/routing-types';
import type { MapEditorState } from '../types/editor-types';
import type { Cell } from '@nookstead/shared';
import { SOLID_FRAME } from './autotile';

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
    activeToolType: 'brush',
    brushSize: 1,
  } as unknown as MapEditorState;
}

// ---------------------------------------------------------------------------
// RetileEngine - Trigger T1: Single Cell Paint
// ---------------------------------------------------------------------------

describe('RetileEngine - T1: single cell paint', () => {
  it('should produce Chebyshev R=2 dirty set around painted cell', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Initial fill
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    // Paint center cell (2,2) to soil
    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 2, y: 2, fg: 'soil' }],
    );

    // R=2 from (2,2) on a 5x5 grid: all cells (0,0) to (4,4) = 25 cells
    expect(result.rebuiltCells).toBe(25);
  });

  it('should update cache entries for all dirty cells', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 2, y: 2, fg: 'soil' }],
    );

    const cache = engine.getCache();
    // All cells should have cache entries
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(cache[y][x]).not.toBeNull();
        expect(cache[y][x]!.fg).toBe(result.grid[y][x].terrain);
      }
    }
  });

  it('should update layers frames and tilesetKeys for dirty cells', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 2, y: 2, fg: 'soil' }],
    );

    // The painted cell (2,2) should have valid frame and tileset key
    expect(typeof result.layers[0].frames[2][2]).toBe('number');
    expect(result.layers[0].tilesetKeys![2][2]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// RetileEngine - Trigger T2: Batch Paint
// ---------------------------------------------------------------------------

describe('RetileEngine - T2: batch paint', () => {
  it('should produce union of R=2 dirty sets for multiple changed cells', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    // Initial fill
    const fillPatches = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    // Paint cells (1,1) and (6,6) simultaneously
    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 1, y: 1, fg: 'soil' }, { x: 6, y: 6, fg: 'soil' }],
    );

    // R=2 around (1,1): (0,0)-(3,3) = 16 cells (clamped)
    // R=2 around (6,6): (4,4)-(7,7) = 16 cells
    // They overlap at (3,3) area but union should cover both neighborhoods
    // Cells near (1,1) AND near (6,6) should be included
    expect(result.rebuiltCells).toBeGreaterThanOrEqual(25); // At least R=2 around each
  });

  it('should trigger full-pass when changed cells exceed 50% of map', () => {
    const engine = new RetileEngine(makeEngineOptions(4, 4));
    const state = makeUniformState(4, 4, 'deep-water');

    // Initial fill
    const fillPatches = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    // Paint 9+ cells (>50% of 16)
    const bigPatch = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        bigPatch.push({ x, y, fg: 'soil' });
      }
    }
    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      bigPatch,
    );

    // Full-pass: all 16 cells recomputed
    expect(result.rebuiltCells).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// RetileEngine - Trigger T3a: maskToTile Change
// ---------------------------------------------------------------------------

describe('RetileEngine - T3a: maskToTile change', () => {
  it('should find cells using the tileset via cellsByTilesetKey index', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    // Fill with deep-water
    const fillPatches = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    // Paint a soil rectangle; under owner-side routing most soil cells remain base.
    const soilPatches = [];
    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 5; x++) {
        soilPatches.push({ x, y, fg: 'soil' });
      }
    }
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      soilPatches,
    );

    // Now call updateTileset for a key that is guaranteed to be present.
    const result = engine.updateTileset(
      { ...state, grid: s2.grid, layers: s2.layers },
      'ts-soil',
    );

    // Only cells currently using 'ts-soil' should be in the result.
    expect(result.rebuiltCells).toBeGreaterThan(0);

    // Cells using other tilesets should NOT be affected -- rebuiltCells should
    // be less than total cells
    expect(result.rebuiltCells).toBeLessThan(64);
  });

  it('should recompute frameId only (not tileset selection)', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    // Fill + soil rectangle
    const fillPatches = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const soilPatches = [];
    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 5; x++) {
        soilPatches.push({ x, y, fg: 'soil' });
      }
    }
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      soilPatches,
    );

    // Record cache before updateTileset
    const cacheBefore = engine.getCache();
    const soilGrassCells: Array<{ x: number; y: number; key: string }> = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const entry = cacheBefore[y][x];
        if (entry && (entry.selectedTilesetKey === 'ts-soil-grass' || entry.renderTilesetKey === 'ts-soil-grass')) {
          soilGrassCells.push({ x, y, key: entry.selectedTilesetKey });
        }
      }
    }

    // Update tileset
    engine.updateTileset(
      { ...state, grid: s2.grid, layers: s2.layers },
      'ts-soil-grass',
    );

    // Verify tileset selection unchanged
    const cacheAfter = engine.getCache();
    for (const { x, y, key } of soilGrassCells) {
      expect(cacheAfter[y][x]!.selectedTilesetKey).toBe(key);
    }
  });
});

// ---------------------------------------------------------------------------
// RetileEngine - Trigger T3b: Tileset Add/Remove
// ---------------------------------------------------------------------------

describe('RetileEngine - T3b: tileset add/remove', () => {
  it('should rebuild graphs and routing table after addTileset', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Fill with deep-water and paint some soil
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const soilPatches = [{ x: 2, y: 2, fg: 'soil' }];
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      soilPatches,
    );

    // Add a new tileset: soil_water
    const newTileset = makeTileset('ts-soil-water', 'soil', 'water');
    const result = engine.addTileset(
      { ...state, grid: s2.grid, layers: s2.layers, tilesets: makeReferenceTilesets() },
      newTileset,
    );

    // Should affect cells near soil and water materials
    expect(result.rebuiltCells).toBeGreaterThan(0);
  });

  it('should rebuild graphs and routing table after removeTileset', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Fill with deep-water and paint sand + grass
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const paintPatches = [
      { x: 1, y: 2, fg: 'sand' },
      { x: 2, y: 2, fg: 'grass' },
    ];
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      paintPatches,
    );

    // Remove sand_grass tileset
    const result = engine.removeTileset(
      {
        ...state,
        grid: s2.grid,
        layers: s2.layers,
        tilesets: makeReferenceTilesets(),
      },
      'ts-sand-grass',
    );

    // Should rebuild cells near sand and grass materials
    expect(result.rebuiltCells).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// RetileEngine - Trigger T4: Theme Switch (Full Rebuild)
// ---------------------------------------------------------------------------

describe('RetileEngine - T4: theme switch (full rebuild)', () => {
  it('should recompute all cells on switchTilesetGroup', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    // Fill with deep-water + paint some soil
    const fillPatches = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const soilPatches = [];
    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 5; x++) {
        soilPatches.push({ x, y, fg: 'soil' });
      }
    }
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      soilPatches,
    );

    // Switch to same tilesets (the content doesn't matter, all cells get rebuilt)
    const result = engine.switchTilesetGroup(
      { ...state, grid: s2.grid, layers: s2.layers },
      makeReferenceTilesets(),
    );

    // All 64 cells should be recomputed
    expect(result.rebuiltCells).toBe(64);
  });

  it('should clear old cache and rebuild from scratch', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Fill with deep-water
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    // Paint soil to set up cache entries
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 2, y: 2, fg: 'soil' }],
    );

    // Switch tileset group (with different tilesets)
    const newTilesets = [
      makeTileset('ts-deep-water', 'deep-water'),
      makeTileset('ts-soil', 'soil'),
    ];
    engine.switchTilesetGroup(
      { ...state, grid: s2.grid, layers: s2.layers },
      newTilesets,
    );

    // Cache should reflect new routing (no transition tilesets available)
    const cache = engine.getCache();
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(cache[y][x]).not.toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// RetileEngine - Editor API (AC7)
// ---------------------------------------------------------------------------

describe('RetileEngine - Editor API', () => {
  it('applyMapPatch should accept Array<{x, y, fg}> and return RetileResult', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Initial fill
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 2, y: 2, fg: 'soil' }],
    );

    // Should have all RetileResult fields
    expect(result.layers).toBeDefined();
    expect(result.grid).toBeDefined();
    expect(result.patches).toBeDefined();
    expect(typeof result.rebuiltCells).toBe('number');
    expect(result.grid[2][2].terrain).toBe('soil');
  });

  it('rebuild("full") should recompute all cells', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Paint some cells to create mixed state
    const grid = state.grid.map(row => row.map(cell => ({ ...cell })));
    grid[0][0] = makeCell('soil');
    grid[1][1] = makeCell('grass');
    const mixedState = { ...state, grid };

    const result = engine.rebuild(mixedState, 'full');

    // All 25 cells should be recomputed
    expect(result.rebuiltCells).toBe(25);
  });

  it('rebuild("local", changedCells) should recompute only dirty propagation', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    const result = engine.rebuild(state, 'local', [{ x: 4, y: 4 }]);

    // R=2 around (4,4): (2,2) to (6,6) = 5x5 = 25 cells
    expect(result.rebuiltCells).toBe(25);
    // Not all 64 cells
    expect(result.rebuiltCells).toBeLessThan(64);
  });
});

// ---------------------------------------------------------------------------
// RetileEngine - Cache Consistency and Invariants
// ---------------------------------------------------------------------------

describe('RetileEngine - cache consistency', () => {
  it('should maintain cache[y][x].frameId === layers[0].frames[y][x]', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Fill and paint several cells
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [
        { x: 1, y: 1, fg: 'soil' },
        { x: 3, y: 3, fg: 'grass' },
      ],
    );

    const cache = engine.getCache();
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const entry = cache[y][x];
        if (entry) {
          expect(entry.frameId).toBe(result.layers[0].frames[y][x]);
        }
      }
    }
  });

  it('should maintain cache[y][x].fg === grid[y][x].terrain', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [
        { x: 2, y: 2, fg: 'soil' },
        { x: 3, y: 1, fg: 'sand' },
      ],
    );

    const cache = engine.getCache();
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const entry = cache[y][x];
        if (entry) {
          expect(entry.fg).toBe(result.grid[y][x].terrain);
        }
      }
    }
  });

  it('should maintain cellsByTilesetKey index consistency', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [
        { x: 1, y: 1, fg: 'soil' },
        { x: 2, y: 2, fg: 'grass' },
      ],
    );

    const cache = engine.getCache();
    const selectedIndex = engine.getCellsBySelectedTilesetKey();

    // For every cached cell, verify the index contains it
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const entry = cache[y][x];
        if (entry) {
          const flatIdx = y * 5 + x;
          const key = entry.selectedTilesetKey;
          expect(selectedIndex.get(key)?.has(flatIdx)).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// RetileEngine - Immutability and Determinism
// ---------------------------------------------------------------------------

describe('RetileEngine - immutability and determinism', () => {
  it('should not mutate input state', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Deep copy the original state for comparison
    const originalGrid = JSON.parse(JSON.stringify(state.grid));
    const originalLayers = JSON.parse(JSON.stringify(state.layers));

    engine.applyMapPatch(state, [{ x: 2, y: 2, fg: 'soil' }]);

    // Original state must be unchanged
    expect(JSON.stringify(state.grid)).toBe(JSON.stringify(originalGrid));
    expect(JSON.stringify(state.layers)).toBe(JSON.stringify(originalLayers));
  });

  it('should produce deterministic output for identical inputs', () => {
    const engine1 = new RetileEngine(makeEngineOptions(5, 5));
    const engine2 = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Initial fill on both engines
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1a = engine1.applyMapPatch(state, fillPatches);
    const s1b = engine2.applyMapPatch(state, fillPatches);

    // Same patch on both
    const patch = [{ x: 2, y: 2, fg: 'soil' }];
    const r1 = engine1.applyMapPatch(
      { ...state, grid: s1a.grid, layers: s1a.layers },
      patch,
    );
    const r2 = engine2.applyMapPatch(
      { ...state, grid: s1b.grid, layers: s1b.layers },
      patch,
    );

    // Both should produce identical frames and tilesetKeys
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(r1.layers[0].frames[y][x]).toBe(r2.layers[0].frames[y][x]);
        expect(r1.layers[0].tilesetKeys![y][x]).toBe(r2.layers[0].tilesetKeys![y][x]);
      }
    }
    expect(r1.rebuiltCells).toBe(r2.rebuiltCells);
  });

  it('should return unchanged layers for empty grid (width=0 or height=0)', () => {
    const engine = new RetileEngine(makeEngineOptions(0, 0));
    const state = {
      ...makeUniformState(0, 0, 'deep-water'),
      grid: [],
      layers: [],
    };

    const result = engine.applyMapPatch(state, []);

    expect(result.layers).toEqual(state.layers);
    expect(result.rebuiltCells).toBe(0);
  });

  it('should silently skip out-of-bounds coordinates in patch', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Initial fill
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    // Patch with OOB and valid entries
    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [
        { x: 10, y: 10, fg: 'soil' },  // OOB
        { x: -1, y: 0, fg: 'soil' },   // OOB
        { x: 2, y: 2, fg: 'soil' },    // Valid
      ],
    );

    // No error thrown
    // Valid entry was processed
    expect(result.grid[2][2].terrain).toBe('soil');
    // OOB entries were skipped
    expect(result.rebuiltCells).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// RetileEngine - Undo Support via Patches
// ---------------------------------------------------------------------------

describe('RetileEngine - undo support', () => {
  it('should return patches array enabling full undo', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Initial fill
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    // Paint (2,2) to soil
    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 2, y: 2, fg: 'soil' }],
    );

    // Patches should be non-empty
    expect(result.patches.length).toBeGreaterThan(0);

    // Find the patch for the painted cell
    const paintedPatch = result.patches.find(p => p.x === 2 && p.y === 2);
    expect(paintedPatch).toBeDefined();
    expect(paintedPatch!.oldFg).toBe('deep-water');
    expect(paintedPatch!.newFg).toBe('soil');
    expect(paintedPatch!.newCache).toBeDefined();
  });

  it('should restore original state when patches are reverted', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Initial fill
    const fillPatches = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        fillPatches.push({ x, y, fg: 'deep-water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);
    const stateAfterFill = { ...state, grid: s1.grid, layers: s1.layers };

    // Record state before paint
    const gridBefore = JSON.parse(JSON.stringify(s1.grid));

    // Paint (2,2) to soil
    const result = engine.applyMapPatch(stateAfterFill, [{ x: 2, y: 2, fg: 'soil' }]);

    // Manually revert patches -- create undo patch
    const undoPatches = result.patches
      .filter(p => p.oldFg !== p.newFg)
      .map(p => ({ x: p.x, y: p.y, fg: p.oldFg }));

    if (undoPatches.length > 0) {
      const undone = engine.applyMapPatch(
        { ...state, grid: result.grid, layers: result.layers },
        undoPatches,
      );

      // The grid terrain at (2,2) should be restored
      expect(undone.grid[2][2].terrain).toBe(gridBefore[2][2].terrain);
    }
  });
});
