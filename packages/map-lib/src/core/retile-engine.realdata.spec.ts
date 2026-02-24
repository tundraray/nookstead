/**
 * RetileEngine integration test with production data.
 *
 * Uses the exact tileset/material configuration from the live database
 * (editor-data API) and a real 5x5 map layout to verify rendering after
 * LOAD_MAP rebuild.
 *
 * Key scenario: deep_water field with a single water cell at (2,1) and
 * a single grass cell at (2,2). Real production rendering for this state
 * is treated as source of truth for expected frames/tilesets in this spec.
 */

import type { TilesetInfo, MaterialInfo } from '../types/material-types';
import type { RetileEngineOptions } from '../types/routing-types';
import type { MapEditorState, EditorLayer } from '../types/editor-types';
import type { Cell } from '@nookstead/shared';
import { RetileEngine } from './retile-engine';
import { SOLID_FRAME, ISOLATED_FRAME } from './autotile';

// ---------------------------------------------------------------------------
// Production Data Fixtures (from /api/editor-data, 2026-02-23)
// ---------------------------------------------------------------------------

function makeProdTilesets(): TilesetInfo[] {
  return [
    { key: 'deep-water_water', name: 'deep-water_water', fromMaterialKey: 'deep_water', toMaterialKey: 'water' },
    { key: 'grass_water', name: 'grass_water', fromMaterialKey: 'grass', toMaterialKey: 'water' },
    { key: 'fertile-soil_grass', name: 'fertile-soil_grass', fromMaterialKey: 'fertile_soil', toMaterialKey: 'grass' },
    { key: 'wet-soil_grass', name: 'wet-soil_grass', fromMaterialKey: 'watered_soil', toMaterialKey: 'grass' },
    { key: 'tilled-soil_sand', name: 'tilled-soil_sand', fromMaterialKey: 'tilled_soil', toMaterialKey: 'grass' },
    { key: 'sand_water', name: 'deep-sand_water', fromMaterialKey: 'deep_sand', toMaterialKey: 'water' },
    { key: 'deep-sand_sand', name: 'deep-sand_sand', fromMaterialKey: 'deep_sand', toMaterialKey: 'sand' },
    { key: 'sand_grass', name: 'sand_grass', fromMaterialKey: 'sand', toMaterialKey: 'grass' },
    { key: 'water_grass', name: 'water_grass', fromMaterialKey: 'water', toMaterialKey: 'grass' },
    { key: 'soil_grass', name: 'soil_grass', fromMaterialKey: 'soil', toMaterialKey: 'grass' },
    { key: 'dusty-soil_grass', name: 'dusty-soil_grass', fromMaterialKey: 'dusty_soil', toMaterialKey: 'grass' },
  ];
}

function makeProdMaterials(): Map<string, MaterialInfo> {
  return new Map<string, MaterialInfo>([
    ['deep_sand', { key: 'deep_sand', color: '#dbbe00', walkable: true, renderPriority: 45, baseTilesetKey: 'sand_water' }],
    ['deep_water', { key: 'deep_water', color: '#063a8e', walkable: false, renderPriority: 15, baseTilesetKey: 'deep-water_water' }],
    ['dusty_soil', { key: 'dusty_soil', color: '#aaa77d', walkable: true, renderPriority: 50, baseTilesetKey: 'dusty-soil_grass' }],
    ['fertile_soil', { key: 'fertile_soil', color: '#a99a37', walkable: true, renderPriority: 70, baseTilesetKey: 'fertile-soil_grass' }],
    ['grass', { key: 'grass', color: '#3bf761', walkable: true, renderPriority: 30, baseTilesetKey: 'grass_water' }],
    ['sand', { key: 'sand', color: '#ffd91a', walkable: true, renderPriority: 40, baseTilesetKey: 'sand_grass' }],
    ['soil', { key: 'soil', color: '#e69f05', walkable: true, renderPriority: 55, baseTilesetKey: 'soil_grass' }],
    ['tilled_soil', { key: 'tilled_soil', color: '#c29005', walkable: true, renderPriority: 60, baseTilesetKey: 'tilled-soil_sand' }],
    ['water', { key: 'water', color: '#3b82f6', walkable: false, renderPriority: 10, baseTilesetKey: 'water_grass' }],
    ['watered_soil', { key: 'watered_soil', color: '#a06a46', walkable: true, renderPriority: 65, baseTilesetKey: 'wet-soil_grass' }],
  ]);
}

function makeProdPriorities(): Map<string, number> {
  const materials = makeProdMaterials();
  const m = new Map<string, number>();
  for (const [key, info] of materials) {
    m.set(key, info.renderPriority);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCell(terrain: string): Cell {
  return { terrain, elevation: 0, meta: {} } as Cell;
}

function makeProdEngineOptions(width: number, height: number): RetileEngineOptions {
  return {
    width,
    height,
    tilesets: makeProdTilesets(),
    materials: makeProdMaterials(),
    materialPriority: makeProdPriorities(),
  };
}

function makeState(width: number, height: number, grid: Cell[][]): MapEditorState {
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
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: height }, () => new Array(width).fill(0)),
      tilesetKeys: Array.from({ length: height }, () => new Array(width).fill('')),
    } as EditorLayer],
    walkable: Array.from({ length: height }, () => new Array(width).fill(false)),
    undoStack: [],
    redoStack: [],
    tilesets: makeProdTilesets(),
    materials: makeProdMaterials(),
    activeLayerIndex: 0,
    activeTool: 'brush',
    activeMaterialKey: 'deep_water',
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    metadata: {},
    zones: [],
    zoneVisibility: true,
  };
}

/**
 * Build the exact 5x5 grid from map 5214d9fe-9407-40eb-8e57-31596f0dadbe:
 *
 *   Row 0: deep_water deep_water deep_water deep_water deep_water
 *   Row 1: deep_water deep_water water      deep_water deep_water
 *   Row 2: deep_water deep_water grass      deep_water deep_water
 *   Row 3: deep_water deep_water deep_water deep_water deep_water
 *   Row 4: deep_water deep_water deep_water deep_water deep_water
 */
function makeMapGrid(): Cell[][] {
  const deepWater = () => makeCell('deep_water');
  const water = () => makeCell('water');
  const grass = () => makeCell('grass');
  return [
    [deepWater(), deepWater(), deepWater(), deepWater(), deepWater()],
    [deepWater(), deepWater(), water(),     deepWater(), deepWater()],
    [deepWater(), deepWater(), grass(),     deepWater(), deepWater()],
    [deepWater(), deepWater(), deepWater(), deepWater(), deepWater()],
    [deepWater(), deepWater(), deepWater(), deepWater(), deepWater()],
  ];
}

// ---------------------------------------------------------------------------
// Realdata truth (authoritative expected output for map 5214...dadbe)
// ---------------------------------------------------------------------------

const TRUTH_5X5_FRAMES = [
  [1, 5, 29, 9, 1],
  [1, 25, 1, 17, 1],
  [1, 25, 47, 17, 1],
  [1, 3, 21, 2, 1],
  [1, 1, 1, 1, 1],
];

const TRUTH_5X5_TILESET_KEYS = [
  ['deep-water_water', 'deep-water_water', 'deep-water_water', 'deep-water_water', 'deep-water_water'],
  ['deep-water_water', 'deep-water_water', 'water_grass',      'deep-water_water', 'deep-water_water'],
  ['deep-water_water', 'deep-water_water', 'grass_water',      'deep-water_water', 'deep-water_water'],
  ['deep-water_water', 'deep-water_water', 'deep-water_water', 'deep-water_water', 'deep-water_water'],
  ['deep-water_water', 'deep-water_water', 'deep-water_water', 'deep-water_water', 'deep-water_water'],
];

function rebuildGrid(grid: Cell[][]): { engine: RetileEngine; result: ReturnType<RetileEngine['rebuild']> } {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const engine = new RetileEngine(makeProdEngineOptions(width, height));
  const state = makeState(width, height, grid);
  const result = engine.rebuild(state, 'full');
  return { engine, result };
}

function printGrid(label: string, grid: Cell[][]) {
  console.log(`\n${label}:`);
  for (const row of grid) {
    console.log('  ' + row.map(c => c.terrain.padStart(12)).join(''));
  }
}

function printLayer(label: string, layers: EditorLayer[], width: number, height: number) {
  const tk = layers[0].tilesetKeys;
  const fr = layers[0].frames;
  console.log(`\n${label} — tilesetKeys:`);
  for (let y = 0; y < height; y++) {
    console.log('  ' + (tk?.[y]?.slice(0, width).map(k => (k || '(empty)').padStart(20)).join('') ?? '(no tilesetKeys)'));
  }
  console.log(`${label} — frames:`);
  for (let y = 0; y < height; y++) {
    console.log('  ' + fr[y].slice(0, width).map(f => String(f).padStart(4)).join(''));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Production data: 5x5 map with isolated water + grass cells', () => {
  let engine: RetileEngine;
  let result: ReturnType<RetileEngine['rebuild']>;
  const W = 5;
  const H = 5;

  beforeAll(() => {
    const grid = makeMapGrid();
    engine = new RetileEngine(makeProdEngineOptions(W, H));
    const state = makeState(W, H, grid);
    result = engine.rebuild(state, 'full');

    printGrid('Grid', grid);
    printLayer('After rebuild', result.layers, W, H);
  });

  // -----------------------------------------------------------------------
  // 1. Tileset selection (routing is correct — these should pass)
  // -----------------------------------------------------------------------

  describe('tileset selection', () => {
    it('water cell (2,1) selects water_grass', () => {
      // CHECK GRID:
      // tileset ([y][x]): [1][2] = water_grass
      // frame ([y][x]): not validated in this test
      const tk = result.layers[0].tilesetKeys!;
      // water at (2,1): cardinal neighbors N/E/W = deep_water, S = grass
      //   nextHop(water, deep_water) = deep_water → hasTileset(water, deep_water) = false → skip
      //   nextHop(water, grass)      = grass      → hasTileset(water, grass)      = true  → bg=grass
      // Single BG=grass → tileset = water_grass
      expect(tk[1][2]).toBe('water_grass');
    });

    it('grass cell (2,2) selects grass_water', () => {
      // CHECK GRID:
      // tileset ([y][x]): [2][2] = grass_water
      // frame ([y][x]): not validated in this test
      const tk = result.layers[0].tilesetKeys!;
      // grass at (2,2): cardinal N=water, E/S/W = deep_water
      //   nextHop(grass, water)      = water → hasTileset(grass, water) = true → bg=water
      //   nextHop(grass, deep_water) = water → hasTileset(grass, water) = true → bg=water
      // Single BG=water → tileset = grass_water
      expect(tk[2][2]).toBe('grass_water');
    });

    it('deep_water cells adjacent to water/grass select deep-water_water', () => {
      // CHECK GRID:
      // tileset ([y][x]): [0][2], [1][1], [1][3], [2][1], [3][2] = deep-water_water
      // frame ([y][x]): not validated in this test
      const tk = result.layers[0].tilesetKeys!;
      expect(tk[0][2]).toBe('deep-water_water'); // S=water
      expect(tk[1][1]).toBe('deep-water_water'); // E=water
      expect(tk[1][3]).toBe('deep-water_water'); // W=water
      expect(tk[2][1]).toBe('deep-water_water'); // E=grass
      expect(tk[3][2]).toBe('deep-water_water'); // N=grass (via routing)
    });

    it('deep_water cells with only diagonal foreign neighbors use base tileset at solid frame', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated explicitly (base-mode expectation is documented)
      // frame ([y][x]): [0][0] = 1, [4][4] = 1
      // (1,1) corner: diagonal NE to (2,0)=deep_water, but has cardinal E=(2,1)=water → not this case
      // Far corners like (0,0): all cardinal neighbors are deep_water → base tileset
      expect(result.layers[0].frames[4][4]).toBe(SOLID_FRAME);
      expect(result.layers[0].frames[0][0]).toBe(SOLID_FRAME);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Deep-water frame computation in real-data truth scenario
  // -----------------------------------------------------------------------

  describe('deep_water border frames (FG mask is correct for these)', () => {
    it('(2,0) deep_water: S=water → open-south T-junction, frame=29', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated in this test
      // frame ([y][x]): [0][2] = 29
      // FG=deep_water, neighbors at (2,0):
      //   N=(2,-1)=OOB→match(1), NE=(3,-1)=OOB→match(2), E=(3,0)=deep_water→match(4)
      //   SE=(3,1)=deep_water→match(8), S=(2,1)=water→no, SW=(1,1)=deep_water→match(32)
      //   W=(1,0)=deep_water→match(64), NW=(1,-1)=OOB→match(128)
      // Raw = 1+2+4+8+32+64+128 = 239
      // Gating: N+E+W present, S absent
      //   NE: N+E→keep(2), SE: S(0)→gate, SW: S(0)→gate, NW: N+W→keep(128)
      // Gated = 1+2+4+64+128 = 199 → FRAME_TABLE[199] = 29
      expect(result.layers[0].frames[0][2]).toBe(29);
    });

    it('(1,1) deep_water: E=water → open-east T-junction, frame=25', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated in this test
      // frame ([y][x]): [1][1] = 25
      // FG=deep_water at (1,1):
      //   N=(1,0)=deep_water(1), NE=(2,0)=deep_water(2), E=(2,1)=water(0)
      //   SE=(2,2)=grass(0), S=(1,2)=deep_water(16), SW=(0,2)=deep_water(32)
      //   W=(0,1)=deep_water(64), NW=(0,0)=deep_water(128)
      // Raw = 1+2+16+32+64+128 = 243
      // Gating: N+S+W present, E absent
      //   NE: N+E(0)→gate, SE: S+E(0)→gate, SW: S+W→keep(32), NW: N+W→keep(128)
      // Gated = 1+16+32+64+128 = 241 → FRAME_TABLE[241] = 25
      expect(result.layers[0].frames[1][1]).toBe(25);
    });

    it('(3,1) deep_water: W=water → open-west T-junction, frame=17', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated in this test
      // frame ([y][x]): [1][3] = 17
      // FG=deep_water at (3,1):
      //   N=(3,0)=deep_water(1), NE=(4,0)=deep_water(2), E=(4,1)=deep_water(4)
      //   SE=(4,2)=deep_water(8), S=(3,2)=deep_water(16), SW=(2,2)=grass(0)
      //   W=(2,1)=water(0), NW=(2,0)=deep_water(128)
      // Raw = 1+2+4+8+16+128 = 159
      // Gating: N+E+S present, W absent
      //   NE: N+E→keep(2), SE: S+E→keep(8), SW: S+W(0)→gate, NW: N+W(0)→gate
      // Gated = 1+2+4+8+16 = 31 → FRAME_TABLE[31] = 17
      expect(result.layers[0].frames[1][3]).toBe(17);
    });

    it('(2,3) deep_water: N=grass yields bridge connector frame=21 in truth matrix', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated in this test
      // frame ([y][x]): [3][2] = 21
      // FG=deep_water at (2,3):
      //   N=(2,2)=grass(0), NE=(3,2)=deep_water(2), E=(3,3)=deep_water(4)
      //   SE=(3,4)=deep_water(8), S=(2,4)=deep_water(16), SW=(1,4)=deep_water(32)
      //   W=(1,3)=deep_water(64), NW=(1,2)=deep_water(128)
      expect(result.layers[0].frames[3][2]).toBe(21);
    });

    it('far corners are SOLID_FRAME', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated in this test
      // frame ([y][x]): [0][0], [0][4], [4][0], [4][4] = 1
      expect(result.layers[0].frames[0][0]).toBe(SOLID_FRAME);
      expect(result.layers[0].frames[0][4]).toBe(SOLID_FRAME);
      expect(result.layers[0].frames[4][0]).toBe(SOLID_FRAME);
      expect(result.layers[0].frames[4][4]).toBe(SOLID_FRAME);
    });

    it('row 4 is all SOLID_FRAME', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated in this test
      // frame ([y][x]): [4][0..4] = 1
      for (let x = 0; x < 5; x++) {
        expect(result.layers[0].frames[4][x]).toBe(SOLID_FRAME);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 3. Truth checks for center water/grass cells in 5x5 scenario
  // -----------------------------------------------------------------------

  describe('center cells in truth matrix', () => {
    it('water (2,1) is solid frame (1)', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated in this test
      // frame ([y][x]): [1][2] = 1
      expect(result.layers[0].frames[1][2]).toBe(SOLID_FRAME);
    });

    it('grass (2,2) remains transition-owner isolated frame (47)', () => {
      // CHECK GRID:
      // tileset ([y][x]): not validated in this test
      // frame ([y][x]): [2][2] = 47
      // BG-targeted mask for grass at (2,2), target=water:
      //   bit=1 where neighbor is NOT water (solid/matching)
      //   bit=0 where neighbor IS water (transition opening)
      //
      //   N=(2,1)=water → IS water → bit=0
      //   NE=(3,1)=deep_water → NOT water → bit=1 (NE=2)
      //   E=(3,2)=deep_water → NOT water → bit=1 (E=4)
      //   SE=(3,3)=deep_water → NOT water → bit=1 (SE=8)
      //   S=(2,3)=deep_water → NOT water → bit=1 (S=16)
      //   SW=(1,3)=deep_water → NOT water → bit=1 (SW=32)
      //   W=(1,2)=deep_water → NOT water → bit=1 (W=64)
      //   NW=(1,1)=deep_water → NOT water → bit=1 (NW=128)
      //
      // Raw mask = 2+4+8+16+32+64+128 = 254
      // Gating: E(4)+S(16)+W(64) present, N absent
      //   NE: N(0) → gate out
      //   SE: S(1) AND E(1) → keep SE(8)
      //   SW: S(1) AND W(1) → keep SW(32)
      //   NW: N(0) → gate out
      expect(result.layers[0].frames[2][2]).toBe(ISOLATED_FRAME);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Comparison with actual API output
  // -----------------------------------------------------------------------

  describe('correct frames for current policy', () => {
    // Realdata truth matrix (authoritative):
    // frame matrix:
    //   Row 0: [1,  5, 29,  9, 1]
    //   Row 1: [1, 25,  1, 17, 1]
    //   Row 2: [1, 25, 47, 17, 1]
    //   Row 3: [1,  3, 21,  2, 1]
    //   Row 4: [1,  1,  1,  1, 1]
    //
    // tileset matrix:
    //   Row 0: [deep-water_water, deep-water_water, deep-water_water, deep-water_water, deep-water_water]
    //   Row 1: [deep-water_water, deep-water_water, water_grass,      deep-water_water, deep-water_water]
    //   Row 2: [deep-water_water, deep-water_water, grass_water,      deep-water_water, deep-water_water]
    //   Row 3: [deep-water_water, deep-water_water, deep-water_water, deep-water_water, deep-water_water]
    //   Row 4: [deep-water_water, deep-water_water, deep-water_water, deep-water_water, deep-water_water]

    it('RetileEngine produces correct frames for all cells', () => {
      // CHECK GRID:
      // tileset ([y][x]) full 5x5 matrix:
      //   [deep-water_water, deep-water_water, deep-water_water, deep-water_water, deep-water_water]
      //   [deep-water_water, deep-water_water, water_grass,      deep-water_water, deep-water_water]
      //   [deep-water_water, deep-water_water, grass_water,      deep-water_water, deep-water_water]
      //   [deep-water_water, deep-water_water, deep-water_water, deep-water_water, deep-water_water]
      //   [deep-water_water, deep-water_water, deep-water_water, deep-water_water, deep-water_water]
      // frame ([y][x]) full 5x5 matrix:
      //   [1, 5, 29, 9, 1]
      //   [1, 25, 1, 17, 1]
      //   [1, 25, 47, 17, 1]
      //   [1, 3, 21, 2, 1]
      //   [1, 1, 1, 1, 1]
      const frames = result.layers[0].frames;
      const tilesetKeys = result.layers[0].tilesetKeys!;
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          expect(frames[y][x]).toBe(TRUTH_5X5_FRAMES[y][x]);
          expect(tilesetKeys[y][x]).toBe(TRUTH_5X5_TILESET_KEYS[y][x]);
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Incremental painting workflow
// ---------------------------------------------------------------------------

describe('Painting workflow: build map incrementally under realdata truth policy', () => {
  it('painting grass then water reaches the same truth matrix as full rebuild', () => {
    // CHECK GRID:
    // tileset ([y][x]): [1][2] = water_grass, [2][2] = grass_water
    // frame ([y][x]) full 5x5 matrix:
    //   [1, 5, 29, 9, 1]
    //   [1, 25, 1, 17, 1]
    //   [1, 25, 47, 17, 1]
    //   [1, 3, 21, 2, 1]
    //   [1, 1, 1, 1, 1]
    const W = 5, H = 5;
    const engine = new RetileEngine(makeProdEngineOptions(W, H));
    const allDeepWater: Cell[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => makeCell('deep_water')),
    );
    const state = makeState(W, H, allDeepWater);

    // Step 1: Fill with deep_water
    const fillPatches = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        fillPatches.push({ x, y, fg: 'deep_water' });
      }
    }
    const s1 = engine.applyMapPatch(state, fillPatches);

    // Step 2: Paint grass at (2,2)
    const s2 = engine.applyMapPatch(
      { ...state, grid: s1.grid, layers: s1.layers },
      [{ x: 2, y: 2, fg: 'grass' }],
    );

    // Step 3: Paint water at (2,1)
    const s3 = engine.applyMapPatch(
      { ...state, grid: s2.grid, layers: s2.layers },
      [{ x: 2, y: 1, fg: 'water' }],
    );

    printGrid('Incremental paint', s3.grid);
    printLayer('Incremental paint', s3.layers, W, H);

    const tk = s3.layers[0].tilesetKeys!;
    const fr = s3.layers[0].frames;

    // Tileset selection is correct
    expect(tk[1][2]).toBe('water_grass');
    expect(tk[2][2]).toBe('grass_water');

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(fr[y][x]).toBe(TRUTH_5X5_FRAMES[y][x]);
        expect(tk[y][x]).toBe(TRUTH_5X5_TILESET_KEYS[y][x]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Routing table verification
// ---------------------------------------------------------------------------

describe('Routing table with real tilesets', () => {
  it('deep_water routes to grass via water (2-hop path)', () => {
    // CHECK GRID:
    // tileset ([y][x]): [3][2] = deep-water_water
    // frame ([y][x]): not validated in this test
    // Compat graph edges: deep_water↔water, water↔grass, grass↔water
    // BFS: nextHop(deep_water, grass) = water
    // But hasTileset(deep_water, water) = true → deep-water_water
    const W = 5, H = 5;
    const engine = new RetileEngine(makeProdEngineOptions(W, H));
    const grid = makeMapGrid();
    const state = makeState(W, H, grid);
    const result = engine.rebuild(state, 'full');

    const tk = result.layers[0].tilesetKeys!;
    // deep_water cell (2,3) borders grass at (2,2) → routes through water → deep-water_water
    expect(tk[3][2]).toBe('deep-water_water');
  });

  it('water→deep_water tileset does NOT exist (asymmetric pair)', () => {
    // CHECK GRID:
    // tileset ([y][x]): [1][2] = water_grass
    // frame ([y][x]): not validated in this test
    // Only deep-water_water (from=deep_water, to=water) exists
    // No water_deep-water tileset → water cannot directly transition toward deep_water
    const W = 5, H = 5;
    const engine = new RetileEngine(makeProdEngineOptions(W, H));
    const grid = makeMapGrid();
    const state = makeState(W, H, grid);
    const result = engine.rebuild(state, 'full');

    // Water at (2,1) only has S-edge (toward grass), not N/E/W (toward deep_water)
    // So it uses water_grass, not a water→deep_water tileset
    expect(result.layers[0].tilesetKeys![1][2]).toBe('water_grass');
  });
});

// ---------------------------------------------------------------------------
// 7x7 strip test: water strip above grass strip
// ---------------------------------------------------------------------------

describe('7x7 map: water strip above grass strip in deep_water field', () => {
  /**
   *   deep_water deep_water deep_water deep_water deep_water deep_water deep_water
   *   deep_water deep_water deep_water deep_water deep_water deep_water deep_water
   *   deep_water deep_water water      water      water      deep_water deep_water
   *   deep_water deep_water grass      grass      grass      deep_water deep_water
   *   deep_water deep_water deep_water deep_water deep_water deep_water deep_water
   *   deep_water deep_water deep_water deep_water deep_water deep_water deep_water
   *   deep_water deep_water deep_water deep_water deep_water deep_water deep_water
   */
  it('interior strip cells with same-material neighbors should not be isolated', () => {
    // CHECK GRID:
    // tileset ([y][x]): [2][2..4] = water_grass, [3][2..4] = grass_water
    // frame ([y][x]): [2][3], [3][3], [2][2], [2][4], [3][2], [3][4] are all != 47
    const W = 7, H = 7;
    const engine = new RetileEngine(makeProdEngineOptions(W, H));
    const grid: Cell[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => makeCell('deep_water')),
    );
    grid[2][2] = makeCell('water');
    grid[2][3] = makeCell('water');
    grid[2][4] = makeCell('water');
    grid[3][2] = makeCell('grass');
    grid[3][3] = makeCell('grass');
    grid[3][4] = makeCell('grass');

    const state = makeState(W, H, grid);
    const result = engine.rebuild(state, 'full');

    printGrid('7x7 strips', grid);
    printLayer('7x7 strips', result.layers, W, H);

    const tk = result.layers[0].tilesetKeys!;
    const fr = result.layers[0].frames;

    // Tileset selection
    for (let x = 2; x <= 4; x++) {
      expect(tk[2][x]).toBe('water_grass');
      expect(tk[3][x]).toBe('grass_water');
    }

    // Interior water cell (3,2) has water E and W neighbors → FG mask != 0
    // This cell has at least E+W matching → mask has those bits → not isolated
    expect(fr[2][3]).not.toBe(ISOLATED_FRAME);

    // Interior grass cell (3,3) has grass E and W neighbors
    expect(fr[3][3]).not.toBe(ISOLATED_FRAME);

    // Edge water cells (2,2) and (4,2) have only ONE same-material neighbor
    // FG mask will have just one cardinal bit → dead-end frame (43-46), not isolated
    // (2,2): E=(3,2)=water → E bit set → frame 44 (E-only dead end)
    expect(fr[2][2]).not.toBe(ISOLATED_FRAME);
    // (4,2): W=(3,2)=water → W bit set → frame 46 (W-only dead end)
    expect(fr[2][4]).not.toBe(ISOLATED_FRAME);

    // Edge grass cells
    expect(fr[3][2]).not.toBe(ISOLATED_FRAME);
    expect(fr[3][4]).not.toBe(ISOLATED_FRAME);
  });
});

// ---------------------------------------------------------------------------
// Additional combination variants
// ---------------------------------------------------------------------------

describe('Additional routing/render combinations (real data)', () => {
  it('water center with only deep_water neighbors uses solid frame in truth policy', () => {
    // CHECK GRID:
    // tileset ([y][x]): [1][1] = water_grass
    // frame ([y][x]): [1][1] = 1
    // COMBO: FG=water, N/E/S/W=deep_water, diagonals=deep_water
    // Expectation: deep_water owns all shared edges (higher priority), so water center
    // has no owned edges and stays in base mode.
    const grid: Cell[][] = [
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
    ];
    const { engine, result } = rebuildGrid(grid);
    const tk = result.layers[0].tilesetKeys!;
    const fr = result.layers[0].frames;
    const cache = engine.getCache();

    expect(tk[1][1]).toBe('water_grass');
    expect(fr[1][1]).toBe(SOLID_FRAME);
    expect(cache[1][1]?.bg).toBe('');
    expect(cache[1][1]?.orientation).toBe('');
  });

  it('grass center in deep_water field keeps bridge connectors on deep_water ring', () => {
    // CHECK GRID:
    // tileset ([y][x]): [1][1] = grass_water
    // frame ([y][x]) full 3x3 matrix:
    //   [5, 29, 9]
    //   [25, 47, 17]
    //   [3, 21, 2]
    // COMBO: FG=grass, N/E/S/W=deep_water, diagonals=deep_water
    // Expectation:
    // - center stays grass_water and isolated (47),
    // - deep_water ring uses bridge connectivity through water:
    //   N=29, W=25, E=17, S=21,
    // - corners are diagonal corner connectors (5/9/3/2).
    const grid: Cell[][] = [
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('grass'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
    ];
    const { engine, result } = rebuildGrid(grid);
    const tk = result.layers[0].tilesetKeys!;
    const fr = result.layers[0].frames;
    const cache = engine.getCache();

    expect(tk[1][1]).toBe('grass_water');
    expect(fr[1][1]).toBe(ISOLATED_FRAME);
    expect(cache[1][1]?.bg).toBe('water');
    expect(cache[1][1]?.orientation).toBe('direct');

    // Ring connectors through water bridge.
    expect(fr[0][1]).toBe(29); // N cell opens to S
    expect(fr[1][0]).toBe(25); // W cell opens to E
    expect(fr[1][2]).toBe(17); // E cell opens to W
    expect(fr[2][1]).toBe(21); // S cell opens to N

    // Diagonal corner connectors.
    expect(fr[0][0]).toBe(5); // NW corner
    expect(fr[0][2]).toBe(9); // NE corner
    expect(fr[2][0]).toBe(3); // SW corner
    expect(fr[2][2]).toBe(2); // SE corner
  });

  it('water conflict (deep_water vs grass) keeps base mode when water owns no edges', () => {
    // CHECK GRID:
    // tileset ([y][x]): [1][1] = water_grass
    // frame ([y][x]): not validated in this test
    // COMBO: FG=water, N/S=deep_water, E/W=grass
    // Expectation: water is lower priority than both neighbors, owns no edges,
    // and therefore stays in base mode.
    const grid: Cell[][] = [
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
      [makeCell('grass'), makeCell('water'), makeCell('grass')],
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
    ];
    const { engine, result } = rebuildGrid(grid);
    const tk = result.layers[0].tilesetKeys!;
    const cache = engine.getCache();

    expect(tk[1][1]).toBe('water_grass');
    expect(cache[1][1]?.bg).toBe('');
    expect(cache[1][1]?.orientation).toBe('');
  });

  it('grass island in water uses direct grass_water and keeps owner-side closure shape', () => {
    // CHECK GRID:
    // tileset ([y][x]): [1][1] = grass_water
    // frame ([y][x]) full 3x3 matrix:
    //   [1, 1, 1]
    //   [1, 47, 1]
    //   [1, 1, 1]
    // COMBO: FG=grass, N/E/S/W=water, diagonals=water
    //
    // Current policy invariant (design-015-neighbor-repaint-policy-v2 §5 Step 4.8):
    // 1) Direct pair wins for center: grass_water (not reverse).
    // 2) Center keeps isolated transition-owner shape (frame 47).
    // 3) Cardinal water neighbors remain closed on non-owner side (frame 1).
    // 4) Isolated-center ring-solid override: when center is frame=47 (C2),
    //    ALL 8 first-ring cells (cardinals + diagonals) are forced to frame=1.
    const grid: Cell[][] = [
      [makeCell('water'), makeCell('water'), makeCell('water')],
      [makeCell('water'), makeCell('grass'), makeCell('water')],
      [makeCell('water'), makeCell('water'), makeCell('water')],
    ];
    const { engine, result } = rebuildGrid(grid);
    const tk = result.layers[0].tilesetKeys!;
    const fr = result.layers[0].frames;
    const cache = engine.getCache();

    // Center selection stays direct.
    expect(tk[1][1]).toBe('grass_water');
    expect(cache[1][1]?.bg).toBe('water');
    expect(cache[1][1]?.orientation).toBe('direct');

    // Owner-side closure expectations.
    expect(fr[1][1]).toBe(ISOLATED_FRAME);
    expect(fr[0][1]).toBe(SOLID_FRAME); // top cardinal water
    expect(fr[1][2]).toBe(SOLID_FRAME); // right cardinal water
    expect(fr[2][1]).toBe(SOLID_FRAME); // bottom cardinal water
    expect(fr[1][0]).toBe(SOLID_FRAME); // left cardinal water
    // Isolated-center ring-solid: all diagonals forced to SOLID_FRAME (not corner frames).
    expect(fr[0][0]).toBe(SOLID_FRAME); // NW diagonal — ring-solid override
    expect(fr[0][2]).toBe(SOLID_FRAME); // NE diagonal — ring-solid override
    expect(fr[2][2]).toBe(SOLID_FRAME); // SE diagonal — ring-solid override
    expect(fr[2][0]).toBe(SOLID_FRAME); // SW diagonal — ring-solid override
  });

  it('painting two adjacent grass cells in water keeps top/bottom seam rows solid', () => {
    // CHECK GRID:
    // tileset ([y][x]): [2][1] = grass_water, [2][2] = grass_water
    // frame ([y][x]): [2][1] = 44, [2][2] = 46, [1][0..4] = 1, [3][0..4] = 1
    // COMBO: start from 5x5 all-water map, then paint two grass cells (x=1,2 at y=2).
    // Expected (from editor scenario):
    // - grass cells remain dead-end pair (44,46);
    // - seam rows above/below are fully solid (no 5/9/3/2 corner artifacts).
    const W = 5;
    const H = 5;
    const engine = new RetileEngine(makeProdEngineOptions(W, H));
    const allWater: Cell[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => makeCell('water')),
    );
    const baseState = makeState(W, H, allWater);

    // Simulate LOAD_MAP baseline (all water => all frame=1 / water_grass).
    const loaded = engine.rebuild(baseState, 'full');

    // Simulate PUSH_COMMAND paint of two cells.
    const painted = engine.applyMapPatch(
      {
        ...baseState,
        grid: loaded.grid,
        layers: loaded.layers,
      },
      [
        { x: 1, y: 2, fg: 'grass' },
        { x: 2, y: 2, fg: 'grass' },
      ],
    );

    const tk = painted.layers[0].tilesetKeys!;
    const fr = painted.layers[0].frames;

    expect(tk[2][1]).toBe('grass_water');
    expect(tk[2][2]).toBe('grass_water');
    expect(fr[2][1]).toBe(44);
    expect(fr[2][2]).toBe(46);

    // Row above (y=1): expected all solid.
    expect(fr[1][0]).toBe(SOLID_FRAME);
    expect(fr[1][1]).toBe(SOLID_FRAME);
    expect(fr[1][2]).toBe(SOLID_FRAME);
    expect(fr[1][3]).toBe(SOLID_FRAME);
    expect(fr[1][4]).toBe(SOLID_FRAME);

    // Row below (y=3): expected all solid.
    expect(fr[3][0]).toBe(SOLID_FRAME);
    expect(fr[3][1]).toBe(SOLID_FRAME);
    expect(fr[3][2]).toBe(SOLID_FRAME);
    expect(fr[3][3]).toBe(SOLID_FRAME);
    expect(fr[3][4]).toBe(SOLID_FRAME);
  });

  it('single deep_water cell never returns empty tilesetKey (base from materials)', () => {
    // CHECK GRID:
    // tileset ([y][x]): [0][0] = deep-water_water and not empty
    // frame ([y][x]): [0][0] = 1
    // COMBO: 1x1 map, FG=deep_water, no foreign neighbors
    // Expectation: even without explicit standalone base tileset in registry,
    // selected/render key is taken from materials.baseTilesetKey and is non-empty.
    const grid: Cell[][] = [[makeCell('deep_water')]];
    const { result } = rebuildGrid(grid);
    const tk = result.layers[0].tilesetKeys!;
    const fr = result.layers[0].frames;

    expect(tk[0][0]).toBe('deep-water_water');
    expect(tk[0][0]).not.toBe('');
    expect(fr[0][0]).toBe(SOLID_FRAME);
  });

  it('PUSH_COMMAND: deep_water in grass ring over water keeps isolated center and corrected diagonal corners', () => {
    // CHECK GRID:
    // terrain:
    //   [water, water, water, water, water]
    //   [water, grass, grass, grass, water]
    //   [water, grass, deep_water, grass, water]
    //   [water, grass, grass, grass, water]
    //   [water, water, water, water, water]
    //
    // tileset ([y][x]) full 5x5 matrix:
    //   [water_grass, water_grass,      water_grass,      water_grass,      water_grass]
    //   [water_grass, grass_water,      grass_water,      grass_water,      water_grass]
    //   [water_grass, grass_water, deep-water_water,      grass_water,      water_grass]
    //   [water_grass, grass_water,      grass_water,      grass_water,      water_grass]
    //   [water_grass, water_grass,      water_grass,      water_grass,      water_grass]
    //
    // frame ([y][x]) full 5x5 matrix:
    //   [1,  1,  1,  1, 1]
    //   [1, 36, 34, 38, 1]
    //   [1, 33, 47, 33, 1]
    //   [1, 40, 34, 42, 1]
    //   [1,  1,  1,  1, 1]
    const W = 5;
    const H = 5;
    const engine = new RetileEngine(makeProdEngineOptions(W, H));
    const allWater: Cell[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => makeCell('water')),
    );
    const baseState = makeState(W, H, allWater);

    // Simulate LOAD_MAP baseline and then PUSH_COMMAND patch from editor.
    const loaded = engine.rebuild(baseState, 'full');
    const patched = engine.applyMapPatch(
      {
        ...baseState,
        grid: loaded.grid,
        layers: loaded.layers,
      },
      [
        { x: 1, y: 1, fg: 'grass' },
        { x: 2, y: 1, fg: 'grass' },
        { x: 3, y: 1, fg: 'grass' },
        { x: 1, y: 2, fg: 'grass' },
        { x: 2, y: 2, fg: 'deep_water' },
        { x: 3, y: 2, fg: 'grass' },
        { x: 1, y: 3, fg: 'grass' },
        { x: 2, y: 3, fg: 'grass' },
        { x: 3, y: 3, fg: 'grass' },
      ],
    );

    const tk = patched.layers[0].tilesetKeys!;
    const fr = patched.layers[0].frames;

    const expectedTilesetKeys = [
      ['water_grass', 'water_grass', 'water_grass', 'water_grass', 'water_grass'],
      ['water_grass', 'grass_water', 'grass_water', 'grass_water', 'water_grass'],
      ['water_grass', 'grass_water', 'deep-water_water', 'grass_water', 'water_grass'],
      ['water_grass', 'grass_water', 'grass_water', 'grass_water', 'water_grass'],
      ['water_grass', 'water_grass', 'water_grass', 'water_grass', 'water_grass'],
    ];

    const expectedFrames = [
      [1, 1, 1, 1, 1],
      [1, 36, 34, 38, 1],
      [1, 33, ISOLATED_FRAME, 33, 1],
      [1, 42, 34, 40, 1],
      [1, 1, 1, 1, 1],
    ];

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(tk[y][x]).toBe(expectedTilesetKeys[y][x]);
        expect(fr[y][x]).toBe(expectedFrames[y][x]);
      }
    }
  });
});
