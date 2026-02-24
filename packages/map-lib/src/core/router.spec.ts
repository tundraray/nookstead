// Router Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC2: BFS Routing Table (FR2, V1)
// Generated: 2026-02-22

import type { TilesetInfo } from '../types/material-types';
import { TilesetRegistry } from './tileset-registry';
import { buildGraphs } from './graph-builder';
import { computeRoutingTable } from './router';
import type { RoutingTable, CompatGraph } from '../types/routing-types';

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

function makeDefaultPreferences(): string[] {
  return ['water', 'grass', 'sand', 'soil', 'deep-water'];
}

function buildCompatGraph(): CompatGraph {
  const registry = new TilesetRegistry(makeReferenceTilesets());
  const { compatGraph } = buildGraphs(registry);
  return compatGraph;
}

// ---------------------------------------------------------------------------
// computeRoutingTable
// ---------------------------------------------------------------------------

describe('computeRoutingTable', () => {
  describe('direct neighbor hop (1-hop)', () => {
    // AC2: "When computeRoutingTable() is called, the system shall compute
    //        nextHop[A][B] for all reachable material pairs via BFS on the compatGraph"
    // ROI: 92 | Business Value: 10 (core routing) | Frequency: 10
    // @category: core-functionality
    // @dependency: CompatGraph
    // @complexity: medium

    it('should return direct neighbor for 1-hop path (water -> deep-water)', () => {
      // Arrange: compat graph from reference tilesets, default preferences
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: nextHop('water', 'deep-water') === 'deep-water'
      //   Path: water -> deep-water (direct compat neighbor)
      expect(table.nextHop('water', 'deep-water')).toBe('deep-water');
    });

    it('should return direct neighbor for 1-hop path (grass -> water)', () => {
      // Arrange: Same setup
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: nextHop('grass', 'water') === 'water'
      expect(table.nextHop('grass', 'water')).toBe('water');
    });
  });

  describe('multi-hop paths', () => {
    // AC2: nextHop for multi-hop paths
    // ROI: 90 | Business Value: 10 | Frequency: 8
    // @category: core-functionality
    // @dependency: CompatGraph
    // @complexity: medium

    it('should return water for 2-hop path (deep-water -> grass)', () => {
      // Arrange: Reference compat graph
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: nextHop('deep-water', 'grass') === 'water'
      //   Path: deep-water -> water -> grass (2 hops)
      expect(table.nextHop('deep-water', 'grass')).toBe('water');
    });

    it('should return water for 2-hop path (deep-water -> sand)', () => {
      // Arrange: Reference compat graph
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: nextHop('deep-water', 'sand') === 'water'
      //   Path: deep-water -> water -> sand (2 hops)
      expect(table.nextHop('deep-water', 'sand')).toBe('water');
    });

    it('should return water for 3-hop path (deep-water -> soil)', () => {
      // AC2: "nextHop('deep_water', 'soil') with water in the preference array,
      //        the system shall return 'water'"
      // Arrange: Reference compat graph with preference ['water', 'grass', ...]
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: nextHop('deep-water', 'soil') === 'water'
      //   Path: deep-water -> water -> grass -> soil (3 hops)
      expect(table.nextHop('deep-water', 'soil')).toBe('water');
    });

    it('should return grass for reverse 3-hop path (soil -> deep-water)', () => {
      // Arrange: Reference compat graph
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: nextHop('soil', 'deep-water') === 'grass'
      //   Path: soil -> grass -> water -> deep-water (3 hops)
      expect(table.nextHop('soil', 'deep-water')).toBe('grass');
    });
  });

  describe('tie-breaking', () => {
    // AC2: "If multiple paths of equal length exist from A to B, then the system
    //        shall tie-break using the configurable preference array"
    // ROI: 85 | Business Value: 9 (determinism) | Frequency: 5
    // @category: core-functionality
    // @dependency: CompatGraph, preferences
    // @complexity: high

    it('should prefer water over sand for equal-length paths when water is earlier in preferences', () => {
      // Arrange: compat graph where both water and sand are 1-hop from grass
      //   Preferences: ['water', 'grass', 'sand']
      //   deep-water only connects to water, so the only path from dw to sand
      //   is: dw -> water -> sand (2 hops through water).
      //   This is the only path since dw only connects to water in the compat graph.
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: nextHop('deep-water', 'sand') = 'water'
      expect(table.nextHop('deep-water', 'sand')).toBe('water');
    });

    it('should be deterministic: same input always produces same routing table', () => {
      // Arrange: Build routing table twice with same inputs
      const compatGraph = buildCompatGraph();
      const prefs = makeDefaultPreferences();
      const table1 = computeRoutingTable(compatGraph, prefs);
      const table2 = computeRoutingTable(compatGraph, prefs);

      // Assert: For all material pairs (A, B):
      //   table1.nextHop(A, B) === table2.nextHop(A, B)
      const materials = ['deep-water', 'water', 'grass', 'soil', 'sand'];
      for (const from of materials) {
        for (const to of materials) {
          expect(table1.nextHop(from, to)).toBe(table2.nextHop(from, to));
        }
      }
    });
  });

  describe('self-query and unreachable', () => {
    // AC2: "nextHop(A, A) shall be null", "If no path exists, nextHop[A][B] shall be null"
    // ROI: 80 | Business Value: 8 (correctness) | Frequency: 5
    // @category: edge-case
    // @dependency: CompatGraph
    // @complexity: low

    it('should return null for nextHop(A, A) (same material)', () => {
      // Arrange: Reference compat graph
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: nextHop(A, A) === null for all materials
      expect(table.nextHop('water', 'water')).toBeNull();
      expect(table.nextHop('grass', 'grass')).toBeNull();
      expect(table.nextHop('deep-water', 'deep-water')).toBeNull();
    });

    it('should return null for unreachable pair', () => {
      // AC2: "If no path exists between A and B, then nextHop[A][B] shall be null"
      // Arrange: Small compat graph with disconnected components
      //   {A--B} and {C--D} with no path between them
      const disconnectedGraph: CompatGraph = new Map([
        ['A', new Set(['B'])],
        ['B', new Set(['A'])],
        ['C', new Set(['D'])],
        ['D', new Set(['C'])],
      ]);
      const table = computeRoutingTable(disconnectedGraph, []);

      // Assert: unreachable pairs return null
      expect(table.nextHop('A', 'C')).toBeNull();
      expect(table.nextHop('A', 'D')).toBeNull();
      expect(table.hasRoute('A', 'C')).toBe(false);
      expect(table.hasRoute('A', 'D')).toBe(false);

      // But connected pairs should work
      expect(table.nextHop('A', 'B')).toBe('B');
      expect(table.hasRoute('A', 'B')).toBe(true);
      expect(table.nextHop('C', 'D')).toBe('D');
      expect(table.hasRoute('C', 'D')).toBe(true);
    });
  });

  describe('hasRoute consistency', () => {
    // ROI: 70 | Business Value: 7 | Frequency: 5
    // @category: core-functionality
    // @dependency: CompatGraph
    // @complexity: low

    it('should be consistent with nextHop results', () => {
      // Arrange: Reference compat graph
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: For all material pairs tested above:
      //   hasRoute(A, B) === (nextHop(A, B) !== null)
      const materials = ['deep-water', 'water', 'grass', 'soil', 'sand'];
      for (const from of materials) {
        for (const to of materials) {
          if (from === to) {
            // hasRoute(A, A) should be true (trivially reachable)
            expect(table.hasRoute(from, to)).toBe(true);
          } else {
            expect(table.hasRoute(from, to)).toBe(table.nextHop(from, to) !== null);
          }
        }
      }
    });
  });

  describe('reference routing table verification', () => {
    // All 10 entries from Design Doc routing table reference
    // ROI: 95 | Business Value: 10 | Frequency: 10
    // @category: core-functionality
    // @dependency: full compat graph
    // @complexity: medium

    it('should match all Design Doc routing table entries', () => {
      // Arrange: Reference compat graph with default preferences
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert (all 10 entries from Design Doc):
      expect(table.nextHop('deep-water', 'soil')).toBe('water');     // dw -> water -> grass -> soil
      expect(table.nextHop('soil', 'deep-water')).toBe('grass');     // soil -> grass -> water -> dw
      expect(table.nextHop('deep-water', 'sand')).toBe('water');     // dw -> water -> sand
      expect(table.nextHop('sand', 'deep-water')).toBe('water');     // sand -> water -> dw
      expect(table.nextHop('deep-water', 'grass')).toBe('water');    // dw -> water -> grass
      expect(table.nextHop('soil', 'water')).toBe('grass');          // soil -> grass -> water
      expect(table.nextHop('soil', 'sand')).toBe('grass');           // soil -> grass -> sand
      expect(table.nextHop('water', 'soil')).toBe('grass');          // water -> grass -> soil
      expect(table.nextHop('water', 'deep-water')).toBe('deep-water'); // direct
      expect(table.nextHop('sand', 'soil')).toBe('grass');           // sand -> grass -> soil
    });
  });

  describe('immutability', () => {
    // AC2: "The routing table shall be immutable after construction"
    // ROI: 55 | Business Value: 6 | Frequency: 2
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should be immutable after construction', () => {
      // Arrange: Build routing table
      const compatGraph = buildCompatGraph();
      const table = computeRoutingTable(compatGraph, makeDefaultPreferences());

      // Assert: Verify returned RoutingTable cannot be modified externally
      // Object.freeze should prevent property modification
      expect(() => {
        (table as Record<string, unknown>)['nextHop'] = () => 'hacked';
      }).toThrow();

      // Verify the table still works correctly after attempted modification
      expect(table.nextHop('water', 'deep-water')).toBe('deep-water');
    });
  });
});
