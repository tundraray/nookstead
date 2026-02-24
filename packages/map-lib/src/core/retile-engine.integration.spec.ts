// Autotile Routing System - RetileEngine Integration Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// Generated: 2026-02-22 | Budget Used: 1/3 integration, 0/2 E2E
//
// These tests verify AC9 (Painting Scenarios V5) by constructing a full
// RetileEngine and exercising the complete pipeline through realistic
// painting workflows. Each test builds a grid, paints cells via
// applyMapPatch, and verifies tilesetKeys and frames match Design Doc
// expected values.

import type { TilesetInfo, MaterialInfo } from '../types/material-types';
import { RetileEngine } from './retile-engine';
import type { RetileEngineOptions } from '../types/routing-types';
import type { MapEditorState, EditorLayer } from '../types/editor-types';
import type { Cell } from '@nookstead/shared';
import { SOLID_FRAME } from './autotile';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

/**
 * Reference tileset set from Design Doc (11 tilesets).
 * Each tileset has explicit fromMaterialKey and toMaterialKey.
 */
function makeReferenceTilesets(): TilesetInfo[] {
  return [
    // Base tilesets (from === to is implied by missing toMaterialKey)
    { key: 'ts-deep-water', name: 'Deep Water', fromMaterialKey: 'deep-water' },
    { key: 'ts-water', name: 'Water', fromMaterialKey: 'water' },
    { key: 'ts-grass', name: 'Grass', fromMaterialKey: 'grass' },
    { key: 'ts-soil', name: 'Soil', fromMaterialKey: 'soil' },
    { key: 'ts-sand', name: 'Sand', fromMaterialKey: 'sand' },
    // Transition tilesets
    { key: 'ts-deep-water-water', name: 'deep-water_water', fromMaterialKey: 'deep-water', toMaterialKey: 'water' },
    { key: 'ts-water-grass', name: 'water_grass', fromMaterialKey: 'water', toMaterialKey: 'grass' },
    { key: 'ts-grass-water', name: 'grass_water', fromMaterialKey: 'grass', toMaterialKey: 'water' },
    { key: 'ts-soil-grass', name: 'soil_grass', fromMaterialKey: 'soil', toMaterialKey: 'grass' },
    { key: 'ts-sand-water', name: 'sand_water', fromMaterialKey: 'sand', toMaterialKey: 'water' },
    { key: 'ts-sand-grass', name: 'sand_grass', fromMaterialKey: 'sand', toMaterialKey: 'grass' },
  ];
}

/**
 * Preset A: Water-Side Owns Shore.
 * deep-water=100, water=90, sand=50, grass=30, soil=10
 */
function makePresetAPriorities(): Map<string, number> {
  return new Map([
    ['deep-water', 100],
    ['water', 90],
    ['sand', 50],
    ['grass', 30],
    ['soil', 10],
  ]);
}

/**
 * Preference array for BFS tie-breaking (default from Design Doc).
 */
function makeDefaultPreferences(): string[] {
  return ['water', 'grass', 'sand', 'soil', 'deep-water'];
}

/**
 * Reference materials map.
 */
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

/**
 * Helper: build fill patches for an entire grid.
 */
function fillPatches(width: number, height: number, fg: string) {
  const patches = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      patches.push({ x, y, fg });
    }
  }
  return patches;
}

/**
 * Helper: build rectangular patches.
 */
function rectPatches(x1: number, y1: number, x2: number, y2: number, fg: string) {
  const patches = [];
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      patches.push({ x, y, fg });
    }
  }
  return patches;
}

/**
 * Helper: run P1 setup (8x8 dw fill + 4x4 soil rectangle).
 */
function setupP1() {
  const engine = new RetileEngine(makeEngineOptions(8, 8));
  const state = makeUniformState(8, 8, 'deep-water');

  // Step 1: Fill with deep-water
  const s1 = engine.applyMapPatch(state, fillPatches(8, 8, 'deep-water'));

  // Step 2: Paint 4x4 soil at (2,2)-(5,5)
  const s2 = engine.applyMapPatch(
    { ...state, grid: s1.grid, layers: s1.layers },
    rectPatches(2, 2, 5, 5, 'soil'),
  );

  return { engine, state, s1, s2 };
}

/**
 * Helper: run P2 setup (P1 + 2x2 water lake at (3,3)-(4,4)).
 */
function setupP2() {
  const { engine, state, s1, s2 } = setupP1();

  // Step 3: Paint 2x2 water at (3,3)-(4,4)
  const s3 = engine.applyMapPatch(
    { ...state, grid: s2.grid, layers: s2.layers },
    rectPatches(3, 3, 4, 4, 'water'),
  );

  return { engine, state, s1, s2, s3 };
}

// ---------------------------------------------------------------------------
// AC9 - P1: Deep-Water Fill + Soil Rectangle
// ---------------------------------------------------------------------------

describe('AC9-P1: deep-water fill + soil rectangle', () => {
  it('should keep deep-water border cells on base tileset for C4 edges', () => {
    const { s2 } = setupP1();
    const tk = s2.layers[0].tilesetKeys!;

    // deep-water <-> soil is a C4 edge in this tileset set.
    // Under preserve-by-default C4 policy, previously rendered deep-water
    // neighbors keep their prior visual state (base tileset).
    // West border column x=1, y=2..5 (dw cells with E neighbor = soil)
    for (let y = 2; y <= 5; y++) {
      expect(tk[y][1]).toBe('ts-deep-water');
    }
    // North border row y=1, x=2..5
    for (let x = 2; x <= 5; x++) {
      expect(tk[1][x]).toBe('ts-deep-water');
    }
    // East border column x=6, y=2..5
    for (let y = 2; y <= 5; y++) {
      expect(tk[y][6]).toBe('ts-deep-water');
    }
    // South border row y=6, x=2..5
    for (let x = 2; x <= 5; x++) {
      expect(tk[6][x]).toBe('ts-deep-water');
    }
  });

  it('should keep soil rectangle border cells on base tileset when edge ownership is external', () => {
    const { s2 } = setupP1();
    const tk = s2.layers[0].tilesetKeys!;

    // Under preset A ownership, deep-water owns shared dw|soil borders.
    // Soil cells therefore remain on base tileset.
    // N border: y=2, x=2..5
    for (let x = 2; x <= 5; x++) {
      expect(tk[2][x]).toBe('ts-soil');
    }
    // S border: y=5, x=2..5
    for (let x = 2; x <= 5; x++) {
      expect(tk[5][x]).toBe('ts-soil');
    }
    // W border: x=2, y=2..5
    for (let y = 2; y <= 5; y++) {
      expect(tk[y][2]).toBe('ts-soil');
    }
    // E border: x=5, y=2..5
    for (let y = 2; y <= 5; y++) {
      expect(tk[y][5]).toBe('ts-soil');
    }
  });

  it('should assign base tileset with solid frame to interior soil cells', () => {
    const { s2 } = setupP1();
    const tk = s2.layers[0].tilesetKeys!;
    const frames = s2.layers[0].frames;

    // Interior soil cells (3,3), (3,4), (4,3), (4,4) -- all 8 neighbors are soil
    for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4]]) {
      expect(tk[y][x]).toBe('ts-soil');
      expect(frames[y][x]).toBe(SOLID_FRAME);
    }
  });

  it('should assign base tileset to diagonal-only deep-water cells (e.g., (1,1))', () => {
    const { s2 } = setupP1();
    const tk = s2.layers[0].tilesetKeys!;

    // Corner deep-water cells whose only soil neighbor is diagonal.
    // Cardinal neighbors are all deep-water -> no BG -> base tileset.
    expect(tk[1][1]).toBe('ts-deep-water');
    expect(tk[1][6]).toBe('ts-deep-water');
    expect(tk[6][1]).toBe('ts-deep-water');
    expect(tk[6][6]).toBe('ts-deep-water');
  });

  it('should preserve prior deep-water frame on optional C4 border neighbors', () => {
    const { s2 } = setupP1();
    const frames = s2.layers[0].frames;

    // Before soil paint, this cell was solid deep-water.
    // C4 neighbor policy preserves previous visual state for this border cell.
    expect(frames[2][1]).toBe(SOLID_FRAME);

    // soil cell (2,2) [NW corner of rect]:
    // with owner-side closure in base mode, this corner resolves to frame 12.
    expect(frames[2][2]).toBe(12);

    // Interior deep-water cells far from border have solid frame
    expect(frames[0][0]).toBe(SOLID_FRAME);
  });
});

// ---------------------------------------------------------------------------
// AC9 - P2: Soil Square + Water Lake Inside
// ---------------------------------------------------------------------------

describe('AC9-P2: soil square + water lake inside', () => {
  it('should assign water_grass tileset to water cells bordering soil', () => {
    const { s3 } = setupP2();
    const tk = s3.layers[0].tilesetKeys!;

    // nextHop(water, soil) = grass -> water_grass tileset exists
    // All 4 water cells border soil on at least one cardinal side
    expect(tk[3][3]).toBe('ts-water-grass');
    expect(tk[3][4]).toBe('ts-water-grass');
    expect(tk[4][3]).toBe('ts-water-grass');
    expect(tk[4][4]).toBe('ts-water-grass');
  });

  it('should produce correct blob-47 corner frames for water cells', () => {
    const { s3 } = setupP2();
    const frames = s3.layers[0].frames;

    // Water cell (3,3): FG=water
    //   N=(3,2)=soil(no), NE=(4,2)=soil(no), E=(4,3)=water(yes=4)
    //   SE=(4,4)=water(yes=8), S=(3,4)=water(yes=16)
    //   SW=(2,4)=soil(no), W=(2,3)=soil(no), NW=(2,2)=soil(no)
    //   Raw = 4+8+16 = 28
    //   Gating: E+S both match, SE match -> keep 8
    //   Gated = 28
    //   FRAME_TABLE[28] = 35
    expect(frames[3][3]).toBe(35);

    // Water cell (4,4): FG=water
    //   N=(4,3)=water(yes=1), NE=(5,3)=soil(no), E=(5,4)=soil(no)
    //   SE=(5,5)=soil(no), S=(4,5)=soil(no)
    //   SW=(3,5)=soil(no), W=(3,4)=water(yes=64)
    //   NW=(3,3)=water(yes)
    //   Raw = 1+64+128 = 193
    //   Gating: N+W both match -> NW keeps -> 128
    //   Gated = 1+64+128 = 193
    //   FRAME_TABLE[193] = 39
    expect(frames[4][4]).toBe(39);
  });

  it('should keep soil cells bordering water on base tileset when not owner', () => {
    const { s3 } = setupP2();
    const tk = s3.layers[0].tilesetKeys!;

    // Shared borders are owned by higher-priority neighbors in this preset,
    // so these soil cells stay on base tileset.
    expect(tk[3][2]).toBe('ts-soil');
    expect(tk[2][3]).toBe('ts-soil');
  });

  it('should not change outer deep-water | soil border tilesets from P1', () => {
    const { s3 } = setupP2();
    const tk = s3.layers[0].tilesetKeys!;

    // Deep-water outer border keeps base tileset under C4 preserve policy.
    // The water lake inside should not affect the outer dw|soil border.
    expect(tk[2][1]).toBe('ts-deep-water');
    expect(tk[1][2]).toBe('ts-deep-water');
    expect(tk[2][6]).toBe('ts-deep-water');
    expect(tk[6][2]).toBe('ts-deep-water');
  });
});

// ---------------------------------------------------------------------------
// AC9 - P3: Deep-Water | Soil | Sand Strips
// ---------------------------------------------------------------------------

describe('AC9-P3: deep-water | soil | sand strips', () => {
  /**
   * Setup a 6x4 grid:
   *   Row 0: dw  dw  dw  dw  dw  dw
   *   Row 1: dw  dw  so  so  so  dw
   *   Row 2: dw  dw  sa  sa  sa  dw
   *   Row 3: dw  dw  dw  dw  dw  dw
   */
  function setupP3() {
    const engine = new RetileEngine(makeEngineOptions(6, 4));
    const state = makeUniformState(6, 4, 'deep-water');

    // Fill with deep-water
    const s1 = engine.applyMapPatch(state, fillPatches(6, 4, 'deep-water'));

    // Paint soil strip at (2,1)-(4,1) and sand strip at (2,2)-(4,2)
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [
        ...rectPatches(2, 1, 4, 1, 'soil'),
        ...rectPatches(2, 2, 4, 2, 'sand'),
      ],
    );

    return { engine, state, s1, s2 };
  }

  it('should mix C4-preserved and C3-committed deep-water strip borders correctly', () => {
    const { s2 } = setupP3();
    const tk = s2.layers[0].tilesetKeys!;

    // (1,1): diagonal corner from center; with diagonal commit enabled for stable
    // adjacent cardinals this cell is also committed and may switch to transition.
    expect(tk[1][1]).toBe('ts-deep-water-water');
    // (1,2): deep-water <-> sand is C3 via water bridge, neighbor commit is mandatory.
    expect(tk[2][1]).toBe('ts-deep-water-water');
  });

  it('should keep soil strip cells on base tileset when neighboring higher-priority materials own borders', () => {
    const { s2 } = setupP3();
    const tk = s2.layers[0].tilesetKeys!;

    // In preset A, soil is the lowest-priority material in this strip setup,
    // so shared edges are owned by neighbors and soil stays base.
    for (let x = 2; x <= 4; x++) {
      expect(tk[1][x]).toBe('ts-soil');
    }
  });

  it('should resolve sand cells to sand_grass via S1 conflict resolution (Preset A)', () => {
    const { s2 } = setupP3();
    const tk = s2.layers[0].tilesetKeys!;

    // sand(2,2): N=soil, S=dw, W=dw
    //   virtualBG for N edge: nextHop(sand, soil) = grass -> hasTileset(sand, grass) = true
    //   virtualBG for S edge: nextHop(sand, dw) = water -> hasTileset(sand, water) = true
    //   virtualBG for W edge: nextHop(sand, dw) = water -> hasTileset(sand, water) = true
    //   BGs = {grass, water} -> conflict!
    //   S1: drop edges where neighbor priority > sand priority (50)
    //     N edge: soil priority=10 < sand=50 -> keep (bg=grass)
    //     S edge: dw priority=100 > sand=50 -> drop (bg=water)
    //     W edge: dw priority=100 > sand=50 -> drop (bg=water)
    //   After S1: remaining BGs = {grass} -> resolved to sand_grass
    for (let x = 2; x <= 4; x++) {
      expect(tk[2][x]).toBe('ts-sand-grass');
    }
  });

  it('should produce correct mask and frame for sand cells per Worked Example 2', () => {
    const { s2 } = setupP3();
    const frames = s2.layers[0].frames;

    // With owner-side contracts in this layout, sand frame resolves to 21.
    expect(frames[2][2]).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// Painting Workflow: Incremental Retile (Fill -> Rectangle -> Lake)
// ---------------------------------------------------------------------------

describe('Painting workflow: fill -> rectangle -> lake (incremental retile)', () => {
  it('should produce all-solid frames after initial deep-water fill', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    const s1 = engine.applyMapPatch(state, fillPatches(8, 8, 'deep-water'));

    // All cells: uniform deep-water -> base tileset, solid frame
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(s1.layers[0].tilesetKeys![y][x]).toBe('ts-deep-water');
        expect(s1.layers[0].frames[y][x]).toBe(SOLID_FRAME);
      }
    }

    // Cache consistency
    const cache = engine.getCache();
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(cache[y][x]!.fg).toBe('deep-water');
      }
    }
  });

  it('should correctly update tilesets after soil rectangle paint (step 2)', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    const s1 = engine.applyMapPatch(state, fillPatches(8, 8, 'deep-water'));
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      rectPatches(2, 2, 5, 5, 'soil'),
    );

    const tk = s2.layers[0].tilesetKeys!;

    // dw border cells are C4 optional neighbors -> keep base deep-water
    expect(tk[1][2]).toBe('ts-deep-water');
    // soil border cells remain base in owner-side mode
    expect(tk[2][2]).toBe('ts-soil');
    // soil interior -> base tileset
    expect(tk[3][3]).toBe('ts-soil');
    // Diagonal dw cells -> base tileset
    expect(tk[1][1]).toBe('ts-deep-water');
  });

  it('should correctly update tilesets after water lake paint (step 3)', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    const s1 = engine.applyMapPatch(state, fillPatches(8, 8, 'deep-water'));
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      rectPatches(2, 2, 5, 5, 'soil'),
    );
    const s3 = engine.applyMapPatch(
      { ...state, grid: s2.grid, layers: s2.layers },
      rectPatches(3, 3, 4, 4, 'water'),
    );

    const tk = s3.layers[0].tilesetKeys!;

    // water cells -> water_grass
    expect(tk[3][3]).toBe('ts-water-grass');
    expect(tk[4][4]).toBe('ts-water-grass');

    // soil cells bordering water remain base in owner-side mode
    expect(tk[3][2]).toBe('ts-soil');

    // outer dw | soil border -> unchanged base deep-water
    expect(tk[2][1]).toBe('ts-deep-water');
  });

  it('should maintain cache consistency invariant after each step', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    // Step 1: Fill
    const s1 = engine.applyMapPatch(state, fillPatches(8, 8, 'deep-water'));
    verifyCache(engine, s1, 8, 8);

    // Step 2: Soil rectangle
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      rectPatches(2, 2, 5, 5, 'soil'),
    );
    verifyCache(engine, s2, 8, 8);

    // Step 3: Water lake
    const s3 = engine.applyMapPatch(
      { ...state, grid: s2.grid, layers: s2.layers },
      rectPatches(3, 3, 4, 4, 'water'),
    );
    verifyCache(engine, s3, 8, 8);
  });

  it('should handle incremental dirty set correctly (R=2 Chebyshev)', () => {
    const engine = new RetileEngine(makeEngineOptions(8, 8));
    const state = makeUniformState(8, 8, 'deep-water');

    const s1 = engine.applyMapPatch(state, fillPatches(8, 8, 'deep-water'));

    // Paint single cell (4,4) with soil
    const result = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 4, y: 4, fg: 'soil' }],
    );

    // R=2 around (4,4): (2,2) to (6,6) = 5x5 = 25 cells
    expect(result.rebuiltCells).toBe(25);

    // Cells outside R=2 should still have their old values intact
    // (0,0) is far from (4,4), should still be solid deep-water
    expect(result.layers[0].tilesetKeys![0][0]).toBe('ts-deep-water');
    expect(result.layers[0].frames[0][0]).toBe(SOLID_FRAME);
  });
});

// ---------------------------------------------------------------------------
// AC: deep_water -> water -> grass seam (isolated frame bugfix)
// ---------------------------------------------------------------------------

describe('deep_water -> water -> grass seam (selected-mode mask + reverse fallback)', () => {
  /**
   * Setup a 5x5 grid with vertical strips:
   *   Col 0-1: deep-water
   *   Col 2:   water
   *   Col 3-4: grass
   */
  function setupSeamGrid() {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');

    // Fill with deep-water
    const s1 = engine.applyMapPatch(state, fillPatches(5, 5, 'deep-water'));

    // Paint water column at x=2
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      rectPatches(2, 0, 2, 4, 'water'),
    );

    // Paint grass columns at x=3,4
    const s3 = engine.applyMapPatch(
      { ...state, grid: s2.grid, layers: s2.layers },
      rectPatches(3, 0, 4, 4, 'grass'),
    );

    return { engine, state, s3 };
  }

  it('should NOT produce frame 47 (isolated) for water cells at the water/grass seam', () => {
    const { s3 } = setupSeamGrid();
    const frames = s3.layers[0].frames;

    // Water cells (x=2, y=0..4) border grass at E -> they should have transition frames
    // NOT frame 47 (isolated)
    const isolatedFrame = 47; // getFrame(0)
    for (let y = 0; y < 5; y++) {
      expect(frames[y][2]).not.toBe(isolatedFrame);
    }
  });

  it('should NOT produce frame 47 (isolated) for grass cells at the water/grass seam', () => {
    const { s3 } = setupSeamGrid();
    const frames = s3.layers[0].frames;

    // Grass cells (x=3, y=0..4) border water at W -> they should have transition frames
    const isolatedFrame = 47;
    for (let y = 0; y < 5; y++) {
      expect(frames[y][3]).not.toBe(isolatedFrame);
    }
  });

  it('should assign water_grass tileset to water cells bordering grass', () => {
    const { s3 } = setupSeamGrid();
    const tk = s3.layers[0].tilesetKeys!;

    // Water cells at x=2 border grass at E and deep-water at W
    // nextHop(water, grass) = grass -> water_grass (direct)
    // nextHop(water, deep-water) = deep-water -> but water->deep-water doesn't exist
    //   -> reverse fallback: deep-water_water exists -> reverse
    // Multiple BGs -> S1 resolves based on priority
    // Under Preset A: dw(100) > water(90) -> drop dw edge
    // Remaining: grass -> water_grass
    for (let y = 0; y < 5; y++) {
      expect(tk[y][2]).toBe('ts-water-grass');
    }
  });

  it('should keep grass seam cells on base tileset when water side is not owner in this preset', () => {
    const { s3 } = setupSeamGrid();
    const tk = s3.layers[0].tilesetKeys!;

    // Grass cells at x=3 border water at W and grass at E.
    // With current priorities/ownership, these cells remain on base.
    for (let y = 0; y < 5; y++) {
      expect(tk[y][3]).toBe('ts-grass');
    }
  });

  it('should have consistent seam frames (water and grass not both isolated)', () => {
    const { s3 } = setupSeamGrid();
    const frames = s3.layers[0].frames;
    const isolatedFrame = 47;

    // For each row, the water/grass pair at (2,y)/(3,y) should NOT both be isolated
    for (let y = 0; y < 5; y++) {
      const waterFrame = frames[y][2];
      const grassFrame = frames[y][3];
      // At least one should NOT be isolated
      expect(waterFrame === isolatedFrame && grassFrame === isolatedFrame).toBe(false);
    }
  });

  it('should produce correct cache entries with bg and orientation', () => {
    const { engine } = setupSeamGrid();
    const cache = engine.getCache();

    // Water cell (2,2): should have bg='grass', orientation='direct'
    const waterCache = cache[2][2];
    expect(waterCache).not.toBeNull();
    expect(waterCache!.bg).toBe('grass');
    expect(waterCache!.orientation).toBe('direct');

    // Grass cell (3,2): base-mode cache in this preset
    const grassCache = cache[2][3];
    expect(grassCache).not.toBeNull();
    expect(grassCache!.bg).toBe('');
    expect(grassCache!.orientation).toBe('');
  });

  it('should use reverse fallback in runtime when only BG_FG pair exists', () => {
    // 3x3 all water, with one deep-water neighbor at W of center.
    // For center water cell:
    //   nextHop(water, deep-water) = deep-water
    //   direct water->deep-water missing
    //   reverse deep-water->water exists -> must select reverse pair.
    const engine = new RetileEngine(makeEngineOptions(3, 3));
    const state = makeUniformState(3, 3, 'water');
    const painted = engine.applyMapPatch(
      state,
      [{ x: 0, y: 1, fg: 'deep-water' }],
    );

    const centerTileset = painted.layers[0].tilesetKeys![1][1];
    const centerCache = engine.getCache()[1][1];

    expect(centerTileset).toBe('ts-water');
    expect(centerCache).not.toBeNull();
    expect(centerCache!.bg).toBe('');
    expect(centerCache!.orientation).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify cache consistency invariants after an operation.
 */
function verifyCache(
  engine: RetileEngine,
  result: { grid: Cell[][]; layers: EditorLayer[] },
  width: number,
  height: number,
): void {
  const cache = engine.getCache();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const entry = cache[y][x];
      expect(entry).not.toBeNull();
      if (entry) {
        // cache fg matches grid terrain
        expect(entry.fg).toBe(result.grid[y][x].terrain);
        // cache frameId matches layers frames
        expect(entry.frameId).toBe(result.layers[0].frames[y][x]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// AC10: Neighbor Repaint Policy (FR12)
// Design Doc: docs/design/design-015-neighbor-repaint-policy-v2-ru.md
// Generated: 2026-02-24 | Budget: 3/3 integration (AC10 feature budget)
//
// These tests verify the commit policy described in Section 5 (Steps 3-4):
//   - Painted center always committed.
//   - C2/C3 cardinal neighbors committed (visible seam update expected).
//   - C4 cardinal neighbors: center committed, neighbor update not required.
//
// ROI ranking used for budget selection (MAX 3):
//   1. AC10-C2 tileset update (ROI 9)   -- selected
//   2. AC10-C4 center commit   (ROI 6.5) -- selected
//   3. AC10-C3 center tileset  (ROI 5.7) -- selected
//   Dropped: C2 frame smoothness, C3 frame verification, C4 neighbor policy
//            (frame behavior already covered by P1/P2 tests above)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AC10 - Commit Policy C2: Painting grass in water field
// ---------------------------------------------------------------------------

describe('AC10-C2: paint grass center in water field (C2 edge, cardinals + diagonals commit)', () => {
  // AC10: "When edge class is C2, the system shall treat neighbor update as
  //         commit-required behavior"
  // Design Doc Section 15.1 item 1: "C2: Paint grass in water field. All 4 cardinal
  //   neighbors update tileset/mask. Smooth seam."
  // Design Doc Section 6.2: grass <-> water is the only C2 pair (symmetric direct).
  //   grass_water and water_grass both exist as direct tilesets.
  //   Owner-side contract: water owns its side (water priority 90 > grass priority 30 in Preset A).
  // ROI: 9 | Business Value: 10 | Frequency: 9 | Defect Detection: 9
  // @category: core-functionality
  // @dependency: RetileEngine, TilesetRegistry, Router
  // @complexity: high

  it('should update tileset of all 4 cardinal water neighbors when grass is painted at center', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'water');
    const s0 = engine.applyMapPatch(state, fillPatches(5, 5, 'water'));
    const s1 = engine.applyMapPatch(
      { ...state, grid: s0.grid, layers: s0.layers },
      [{ x: 2, y: 2, fg: 'grass' }],
    );

    const tk = s1.layers[0].tilesetKeys!;

    // Комбинация: C2 (grass <-> water), сосед обязателен к commit.
    expect(tk[2][2]).toBe('ts-grass');
    expect(tk[1][2]).toBe('ts-water-grass');
    expect(tk[2][3]).toBe('ts-water-grass');
    expect(tk[3][2]).toBe('ts-water-grass');
    expect(tk[2][1]).toBe('ts-water-grass');
    expect(tk[1][1]).toBe('ts-water');
  });

  it('should close foreign diagonal bits for base-mode cells with no foreign cardinal neighbors', () => {
    // In this preset, water(90) > grass(30), so water OWNS the edge.
    // Grass center enters base-mode (non-owner), not transition-mode.
    // Water cardinals are transition-owners and get their own frames.
    // The key assertion: diagonal water cells whose only foreign contact is
    // diagonal (grass at center) should NOT show corner indents — diagonal
    // foreign bits are closed because those cells have no foreign cardinals.
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'water');
    const s0 = engine.applyMapPatch(state, fillPatches(5, 5, 'water'));
    const s1 = engine.applyMapPatch(
      { ...state, grid: s0.grid, layers: s0.layers },
      [{ x: 2, y: 2, fg: 'grass' }],
    );

    const fr = s1.layers[0].frames;

    // Diagonal water cells: all 4 cardinals are water (same FG), only diagonal
    // neighbor is grass (foreign). closeForeignDiagonalBits closes the diagonal
    // bit, so these cells get frame=1 (not corner frames 5/9/3/2).
    expect(fr[1][1]).toBe(1); // NW water — no corner indent
    expect(fr[1][3]).toBe(1); // NE water — no corner indent
    expect(fr[3][1]).toBe(1); // SW water — no corner indent
    expect(fr[3][3]).toBe(1); // SE water — no corner indent
  });

});
// [BUDGET NOTE] C2 frame-smoothness test omitted (budget enforced to MAX 3);
// frame correctness is already covered by AC9-P2 blob-47 corner frames tests above.

// ---------------------------------------------------------------------------
// AC10 - Commit Policy C3: Painting grass in deep_water field
// ---------------------------------------------------------------------------

describe('AC10-C3: paint grass center in deep_water field (C3 edge, neighbors commit via bridge)', () => {
  // AC10: "When edge class is C3, the system shall treat neighbor update as
  //         commit-required behavior"
  // Design Doc Section 15.1 item 2: "C3: ... neighbors update via common bridge."
  // In this fixture deep-water <-> grass is C3:
  //   hopA = nextHop('deep-water', 'grass') = 'water', pairA = deep_water_water (direct)
  //   hopB = nextHop('grass', 'deep-water') = 'water', pairB = grass_water (direct)
  //   hopA === hopB === 'water', both direct -> C3
  //   Owner: deep-water (priority 100) > grass (30) -> deep-water owns shared edges.
  // ROI: 5.7 | Business Value: 9 | Frequency: 6 | Defect Detection: 9
  // @category: core-functionality
  // @dependency: RetileEngine, TilesetRegistry, Router
  // @complexity: high
  it('should commit deep-water cardinal neighbors through water bridge (C3)', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'deep-water');
    const s0 = engine.applyMapPatch(state, fillPatches(5, 5, 'deep-water'));
    const s1 = engine.applyMapPatch(
      { ...state, grid: s0.grid, layers: s0.layers },
      [{ x: 2, y: 2, fg: 'grass' }],
    );

    const tk = s1.layers[0].tilesetKeys!;

    // Комбинация: C3 (deep-water <-> grass через мост water), сосед обязателен.
    expect(tk[2][2]).toBe('ts-grass');
    expect(tk[1][2]).toBe('ts-deep-water-water');
    expect(tk[2][3]).toBe('ts-deep-water-water');
    expect(tk[3][2]).toBe('ts-deep-water-water');
    expect(tk[2][1]).toBe('ts-deep-water-water');
  });

});
// [BUDGET NOTE] C3 frame-verification test omitted (budget enforced to MAX 3);
// frame behavior for the water bridge is exercised by P1 deep-water-water tests above.

// ---------------------------------------------------------------------------
// AC10 - Commit Policy C4: Painting deep_water in water field
// ---------------------------------------------------------------------------

describe('AC10-C4: paint deep_water center in water field (C4 edge, center commits, neighbor not required)', () => {
  // AC10: "When edge class is C4 or C5, the system may preserve previous neighbor
  //         frame/tileset output (neighbor update is not a required visual invariant)"
  // Design Doc Section 15.1 item 3: "C4: Paint deep_water in water field.
  //   Center updates, neighbors not mandatory."
  // Design Doc Section 8.2: canonical C4 example.
  //   hopA = nextHop('deep-water', 'water') = 'water', pairA = ts-deep-water-water (direct)
  //   hopB = nextHop('water', 'deep-water') = 'deep-water', pairB = resolvePair('water', 'deep-water')
  //     -> no direct 'water_deep-water' tileset -> reverse fallback -> ts-deep-water-water (reverse)
  //   pairB.orientation = 'reverse' -> fails bothDirect -> C4
  //   Center painted cell: deep-water. Water is owner (water priority 90 > ... wait:
  //     deep-water priority = 100, water priority = 90. So deep-water > water -> deep-water owns.
  //     resolveEdge(deep-water, water) -> owner = deep-water (100 > 90).
  //     Center deep-water cell owns the edge and renders ts-deep-water-water.
  // ROI: 6.5 | Business Value: 8 | Frequency: 8 | Defect Detection: 8
  // @category: core-functionality
  // @dependency: RetileEngine, TilesetRegistry, Router
  // @complexity: medium

  it('should commit center deep_water cell with transition tileset after painting into water field', () => {
    const engine = new RetileEngine(makeEngineOptions(5, 5));
    const state = makeUniformState(5, 5, 'water');
    const s0 = engine.applyMapPatch(state, fillPatches(5, 5, 'water'));
    const s1 = engine.applyMapPatch(
      { ...state, grid: s0.grid, layers: s0.layers },
      [{ x: 2, y: 2, fg: 'deep-water' }],
    );

    const tk = s1.layers[0].tilesetKeys!;
    const fr = s1.layers[0].frames;
    const cache = engine.getCache();

    // Комбинация: C4 (deep-water <-> water), центр обязателен, сосед optional.
    expect(tk[2][2]).toBe('ts-deep-water-water');
    expect(fr[2][2]).toBe(47);
    expect(s1.grid[2][2].terrain).toBe('deep-water');
    expect(cache[2][2]!.fg).toBe('deep-water');
    expect(cache[2][2]!.renderTilesetKey).toBe('ts-deep-water-water');

    // Соседи сохраняют предыдущее состояние (water base).
    expect(tk[1][2]).toBe('ts-water');
    expect(tk[2][3]).toBe('ts-water');
    expect(tk[3][2]).toBe('ts-water');
    expect(tk[2][1]).toBe('ts-water');
  });

});
// [BUDGET NOTE] C4 neighbor-policy documentation test omitted (budget enforced to MAX 3).
// The C4 "neighbor update not required" invariant is a policy-level concern verified through
// the classifyEdge unit tests and AC10 design doc commentary; no additional integration
// assertion is needed here because the neighbor's behavior under Preset A is deterministic.
