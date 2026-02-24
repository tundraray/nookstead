// RetileEngine Performance Benchmarks
// Design Doc: docs/design/design-015-autotile-routing-system.md
// Task 16: Performance targets from Design Doc
//
// NOTE: These benchmarks use generous 2x thresholds to avoid CI flakiness.
// Actual performance should be well within 1x targets on modern hardware.

import type { TilesetInfo, MaterialInfo } from '../types/material-types';
import type { RetileEngineOptions } from '../types/routing-types';
import type { MapEditorState } from '../types/editor-types';
import type { Cell } from '@nookstead/shared';
import { RetileEngine } from './retile-engine';
import { TilesetRegistry } from './tileset-registry';
import { buildGraphs } from './graph-builder';
import { computeRoutingTable } from './router';

// ---------------------------------------------------------------------------
// Helpers
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

function makeCell(terrain: string): Cell {
  return { terrain, elevation: 0, meta: {} } as Cell;
}

/**
 * Run a function `count` times and return the median elapsed time in ms.
 * Includes 1 warmup run that is discarded.
 */
function benchmarkMedian(fn: () => void, count: number): number {
  // Warmup (discard)
  fn();

  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  return times.length % 2 === 0
    ? (times[mid - 1] + times[mid]) / 2
    : times[mid];
}

// ---------------------------------------------------------------------------
// Fixture: 6 materials, 15 tilesets (realistic tileset set)
// ---------------------------------------------------------------------------

function makeReferenceTilesets(): TilesetInfo[] {
  return [
    // 6 base tilesets
    makeTileset('ts-deep-water', 'deep-water'),
    makeTileset('ts-water', 'water'),
    makeTileset('ts-grass', 'grass'),
    makeTileset('ts-soil', 'soil'),
    makeTileset('ts-sand', 'sand'),
    makeTileset('ts-stone', 'stone'),
    // 9 transition tilesets
    makeTileset('ts-deep-water-water', 'deep-water', 'water'),
    makeTileset('ts-water-grass', 'water', 'grass'),
    makeTileset('ts-grass-water', 'grass', 'water'),
    makeTileset('ts-soil-grass', 'soil', 'grass'),
    makeTileset('ts-sand-water', 'sand', 'water'),
    makeTileset('ts-sand-grass', 'sand', 'grass'),
    makeTileset('ts-stone-soil', 'stone', 'soil'),
    makeTileset('ts-stone-grass', 'stone', 'grass'),
    makeTileset('ts-grass-soil', 'grass', 'soil'),
  ];
}

function makeReferenceMaterials(): Map<string, MaterialInfo> {
  return new Map([
    ['deep-water', { key: 'deep-water', color: '#1a3a5c', walkable: false, renderPriority: 0, baseTilesetKey: 'ts-deep-water' }],
    ['water', { key: 'water', color: '#2980b9', walkable: false, renderPriority: 1, baseTilesetKey: 'ts-water' }],
    ['grass', { key: 'grass', color: '#2ecc71', walkable: true, renderPriority: 2, baseTilesetKey: 'ts-grass' }],
    ['soil', { key: 'soil', color: '#8b4513', walkable: true, renderPriority: 3, baseTilesetKey: 'ts-soil' }],
    ['sand', { key: 'sand', color: '#f4d03f', walkable: true, renderPriority: 4, baseTilesetKey: 'ts-sand' }],
    ['stone', { key: 'stone', color: '#7f8c8d', walkable: true, renderPriority: 5, baseTilesetKey: 'ts-stone' }],
  ]);
}

function makeEngineOptions256(): RetileEngineOptions {
  return {
    width: 256,
    height: 256,
    tilesets: makeReferenceTilesets(),
    materials: makeReferenceMaterials(),
    materialPriority: new Map([
      ['deep-water', 100],
      ['water', 90],
      ['sand', 50],
      ['grass', 30],
      ['soil', 10],
      ['stone', 5],
    ]),
    preferences: ['water', 'grass', 'sand', 'soil', 'deep-water', 'stone'],
  };
}

/**
 * Create a 256x256 state with a checkerboard-like mix of materials.
 * Uses 4 quadrants of different materials to create interesting edges.
 */
function makeMixed256State(): MapEditorState {
  const W = 256;
  const H = 256;
  const materialList = ['deep-water', 'water', 'grass', 'soil', 'sand', 'stone'];

  const grid: Cell[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => {
      // Create a striped pattern with 32-cell wide bands
      const bandIndex = Math.floor(x / 32) % materialList.length;
      // Alternate vertically too for more edges
      const vertBand = Math.floor(y / 32) % 2;
      const matIndex = (bandIndex + vertBand) % materialList.length;
      return makeCell(materialList[matIndex]);
    }),
  );

  return {
    mapId: null,
    name: 'perf-test',
    mapType: null,
    width: W,
    height: H,
    seed: 0,
    grid,
    layers: [{
      id: 'layer-1',
      name: 'Ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: H }, () => Array.from({ length: W }, () => 0)),
      tilesetKeys: Array.from({ length: H }, () => Array.from({ length: W }, () => '')),
    }],
    walkable: Array.from({ length: H }, () => Array.from({ length: W }, () => true)),
    undoStack: [],
    redoStack: [],
    tilesets: makeReferenceTilesets(),
    materials: makeReferenceMaterials(),
    activeLayerIndex: 0,
    activeMaterialKey: 'grass',
    activeToolType: 'brush',
    brushSize: 1,
  } as unknown as MapEditorState;
}

// ---------------------------------------------------------------------------
// Fixture: 30 materials, 100 tilesets (for BFS benchmark)
// ---------------------------------------------------------------------------

function makeLargeRegistryTilesets(): TilesetInfo[] {
  const tilesets: TilesetInfo[] = [];
  const materialCount = 30;

  // 30 base tilesets
  for (let i = 0; i < materialCount; i++) {
    tilesets.push(makeTileset(`ts-mat-${i}`, `mat-${i}`));
  }

  // 100 transition tilesets arranged as a mesh
  // Connect each material to its next 3 neighbors (wrapping)
  let transitionIndex = 0;
  for (let i = 0; i < materialCount; i++) {
    for (let offset = 1; offset <= 4; offset++) {
      const j = (i + offset) % materialCount;
      if (transitionIndex >= 100) break;
      tilesets.push(makeTileset(
        `ts-trans-${transitionIndex}`,
        `mat-${i}`,
        `mat-${j}`,
      ));
      transitionIndex++;
    }
    if (transitionIndex >= 100) break;
  }

  return tilesets;
}

// ---------------------------------------------------------------------------
// Performance Benchmarks
// ---------------------------------------------------------------------------

describe('RetileEngine Performance Benchmarks', () => {
  // Mark as potentially flaky in CI -- these tests are timing-sensitive
  const BENCHMARK_RUNS = 3;

  describe('T1: Single-cell paint on 256x256', () => {
    it('should complete within 10ms (2x target of 5ms)', () => {
      const engine = new RetileEngine(makeEngineOptions256());
      const state = makeMixed256State();

      // Prime the engine with an initial full rebuild
      const primedResult = engine.rebuild(state, 'full');
      const primedState = { ...state, layers: primedResult.layers, grid: primedResult.grid };

      const medianMs = benchmarkMedian(() => {
        engine.applyMapPatch(primedState, [
          { x: 128, y: 128, fg: 'soil' },
        ]);
      }, BENCHMARK_RUNS);

      console.log(`[Benchmark T1] Single-cell paint: median=${medianMs.toFixed(2)}ms (target <5ms, fail >10ms)`);
      expect(medianMs).toBeLessThan(10);
    });
  });

  describe('T4: Full rebuild on 256x256', () => {
    it('should complete within 1000ms (2x target of 500ms)', () => {
      const engine = new RetileEngine(makeEngineOptions256());
      const state = makeMixed256State();

      const altTilesets = [
        ...makeReferenceTilesets(),
        makeTileset('ts-extra', 'grass', 'stone'),
      ];

      const medianMs = benchmarkMedian(() => {
        engine.switchTilesetGroup(state, altTilesets);
      }, BENCHMARK_RUNS);

      console.log(`[Benchmark T4] Full rebuild 256x256: median=${medianMs.toFixed(2)}ms (target <500ms, fail >1000ms)`);
      expect(medianMs).toBeLessThan(1000);
    });
  });

  describe('BFS: computeRoutingTable with 30 materials, 100 tilesets', () => {
    it('should complete within 20ms (2x target of 10ms)', () => {
      const tilesets = makeLargeRegistryTilesets();
      const registry = new TilesetRegistry(tilesets);
      const { compatGraph } = buildGraphs(registry);
      const preferences = Array.from({ length: 30 }, (_, i) => `mat-${i}`);

      const medianMs = benchmarkMedian(() => {
        computeRoutingTable(compatGraph, preferences);
      }, BENCHMARK_RUNS);

      console.log(`[Benchmark BFS] 30 materials, 100 tilesets: median=${medianMs.toFixed(2)}ms (target <10ms, fail >20ms)`);
      expect(medianMs).toBeLessThan(20);
    });
  });

  describe('Flood fill: 10,000 cells on 256x256', () => {
    it('should complete within 100ms (2x target of 50ms)', () => {
      const engine = new RetileEngine(makeEngineOptions256());
      const state = makeMixed256State();

      // Prime the engine
      const primedResult = engine.rebuild(state, 'full');
      const primedState = { ...state, layers: primedResult.layers, grid: primedResult.grid };

      // Generate a 100x100 block of changes (10,000 cells) centered at (78,78)
      const largePatch: Array<{ x: number; y: number; fg: string }> = [];
      for (let dy = 0; dy < 100; dy++) {
        for (let dx = 0; dx < 100; dx++) {
          largePatch.push({ x: 78 + dx, y: 78 + dy, fg: 'sand' });
        }
      }

      const medianMs = benchmarkMedian(() => {
        engine.applyMapPatch(primedState, largePatch);
      }, BENCHMARK_RUNS);

      console.log(`[Benchmark Fill] 10,000 cells on 256x256: median=${medianMs.toFixed(2)}ms (target <50ms, fail >100ms)`);
      expect(medianMs).toBeLessThan(100);
    });
  });
});
