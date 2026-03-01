// GraphBuilder Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC1: Graph Construction (FR1)
// Generated: 2026-02-22

import type { TilesetInfo } from '../types/material-types';
import { TilesetRegistry } from './tileset-registry';
import { buildGraphs } from './graph-builder';
import type { MaterialGraphs } from './graph-builder';

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

// ---------------------------------------------------------------------------
// buildGraphs
// ---------------------------------------------------------------------------

describe('buildGraphs', () => {
  describe('compatGraph (undirected)', () => {
    // AC1: "compatGraph[A] containing every material B where either A_B or B_A tileset exists"
    // ROI: 90 | Business Value: 10 (foundation) | Frequency: 10
    // @category: core-functionality
    // @dependency: TilesetRegistry
    // @complexity: medium

    it('should create bidirectional edges for a single transition pair', () => {
      // Arrange: Registry with single transition: deep-water -> water
      const tilesets = [
        makeTileset('ts-dw', 'deep-water'),
        makeTileset('ts-w', 'water'),
        makeTileset('ts-dw-w', 'deep-water', 'water'),
      ];
      const registry = new TilesetRegistry(tilesets);

      // Act
      const { compatGraph } = buildGraphs(registry);

      // Assert: bidirectional edges in undirected graph
      expect(compatGraph.get('deep-water')!.has('water')).toBe(true);
      expect(compatGraph.get('water')!.has('deep-water')).toBe(true);
    });

    it('should build correct compat graph from reference tilesets', () => {
      // Arrange: Registry from reference tilesets
      const registry = new TilesetRegistry(makeReferenceTilesets());

      // Act
      const { compatGraph } = buildGraphs(registry);

      // Assert (from Design Doc compat graph):
      //   deep-water -- water
      expect(compatGraph.get('deep-water')!.has('water')).toBe(true);
      //   water -- grass, water -- sand
      expect(compatGraph.get('water')!.has('grass')).toBe(true);
      expect(compatGraph.get('water')!.has('sand')).toBe(true);
      //   grass -- sand, grass -- soil
      expect(compatGraph.get('grass')!.has('sand')).toBe(true);
      expect(compatGraph.get('grass')!.has('soil')).toBe(true);
    });

    it('should be symmetric: A in compatGraph[B] iff B in compatGraph[A]', () => {
      // Arrange: Registry from reference tilesets
      const registry = new TilesetRegistry(makeReferenceTilesets());

      // Act
      const { compatGraph } = buildGraphs(registry);

      // Assert: For every material A with neighbors, for every B in compatGraph[A]:
      //   compatGraph.get(B)!.has(A) === true
      for (const [materialA, neighbors] of compatGraph) {
        for (const materialB of neighbors) {
          expect(compatGraph.get(materialB)!.has(materialA)).toBe(true);
        }
      }
    });

    it('should not contain self-edges', () => {
      // Arrange: Registry from reference tilesets (includes base tilesets like grass->grass)
      const registry = new TilesetRegistry(makeReferenceTilesets());

      // Act
      const { compatGraph } = buildGraphs(registry);

      // Assert: For every material M: compatGraph.get(M) does NOT contain M
      for (const [material, neighbors] of compatGraph) {
        expect(neighbors.has(material)).toBe(false);
      }
    });
  });

  describe('renderGraph (directed)', () => {
    // AC1: "renderGraph[A] containing every material B where A_B tileset exists (directed)"
    // ROI: 85 | Business Value: 10 | Frequency: 8
    // @category: core-functionality
    // @dependency: TilesetRegistry
    // @complexity: medium

    it('should create unidirectional edge for forward-only transition', () => {
      // Arrange: Registry with deep-water -> water (only)
      const tilesets = [
        makeTileset('ts-dw', 'deep-water'),
        makeTileset('ts-w', 'water'),
        makeTileset('ts-dw-w', 'deep-water', 'water'),
      ];
      const registry = new TilesetRegistry(tilesets);

      // Act
      const { renderGraph } = buildGraphs(registry);

      // Assert: forward edge exists, reverse does NOT
      expect(renderGraph.get('deep-water')!.has('water')).toBe(true);
      expect(renderGraph.get('water')?.has('deep-water') ?? false).toBe(false);
    });

    it('should NOT be symmetric (unlike compatGraph)', () => {
      // Arrange: Registry from reference tilesets
      const registry = new TilesetRegistry(makeReferenceTilesets());

      // Act
      const { renderGraph } = buildGraphs(registry);

      // Assert:
      //   deep-water_water exists -> renderGraph has deep-water -> water
      expect(renderGraph.get('deep-water')!.has('water')).toBe(true);
      //   NO water_deep-water -> no reverse edge
      expect(renderGraph.get('water')?.has('deep-water') ?? false).toBe(false);
      //   water_grass exists -> water -> grass
      expect(renderGraph.get('water')!.has('grass')).toBe(true);
      //   grass_water exists -> grass -> water (bidirectional pair!)
      expect(renderGraph.get('grass')!.has('water')).toBe(true);
    });

    it('should have renderGraph edges as a subset of compatGraph edges', () => {
      // Arrange: Registry from reference tilesets
      const registry = new TilesetRegistry(makeReferenceTilesets());

      // Act
      const { compatGraph, renderGraph } = buildGraphs(registry);

      // Assert: For every material A, for every B in renderGraph[A]:
      //   compatGraph.get(A)!.has(B) === true
      for (const [materialA, renderNeighbors] of renderGraph) {
        for (const materialB of renderNeighbors) {
          expect(compatGraph.get(materialA)!.has(materialB)).toBe(true);
        }
      }
    });
  });

  describe('edge cases', () => {
    // ROI: 65 | Business Value: 6 | Frequency: 2
    // @category: edge-case
    // @dependency: TilesetRegistry
    // @complexity: low

    it('should return empty graphs for empty registry', () => {
      // Arrange: Registry from empty tileset array
      const registry = new TilesetRegistry([]);

      // Act
      const { compatGraph, renderGraph } = buildGraphs(registry);

      // Assert: both graphs are empty
      expect(compatGraph.size).toBe(0);
      expect(renderGraph.size).toBe(0);
    });

    it('should return empty graphs for base-tilesets-only registry', () => {
      // Arrange: Registry with only base tilesets (no transitions)
      const tilesets = [
        makeTileset('ts-g', 'grass'),
        makeTileset('ts-w', 'water'),
      ];
      const registry = new TilesetRegistry(tilesets);

      // Act
      const { compatGraph, renderGraph } = buildGraphs(registry);

      // Assert: no edges in either graph
      expect(compatGraph.size).toBe(0);
      expect(renderGraph.size).toBe(0);
    });
  });
});
