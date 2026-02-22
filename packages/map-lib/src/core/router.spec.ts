// Router Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC2: BFS Routing Table (FR2, V1)
// Generated: 2026-02-22

import type { TilesetInfo } from '../types/material-types';
// TODO: uncomment when modules are implemented
// import { TilesetRegistry } from './tileset-registry';
// import { buildGraphs } from './graph-builder';
// import { computeRoutingTable } from './router';
// import type { RoutingTable, CompatGraph } from '../types/routing-types';

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

// TODO: Helper to build compat graph for testing
// function buildCompatGraph(): CompatGraph {
//   const registry = new TilesetRegistry(makeReferenceTilesets());
//   const { compatGraph } = buildGraphs(registry);
//   return compatGraph;
// }

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
      // Assert: nextHop('water', 'deep-water') === 'deep-water'
      //   Path: water -> deep-water (direct compat neighbor)
      //   Per Design Doc routing table

      // TODO: implement
    });

    it('should return direct neighbor for 1-hop path (grass -> water)', () => {
      // Arrange: Same setup
      // Assert: nextHop('grass', 'water') === 'water'

      // TODO: implement
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
      // Assert: nextHop('deep-water', 'grass') === 'water'
      //   Path: deep-water -> water -> grass (2 hops)
      //   Per Design Doc routing table

      // TODO: implement
    });

    it('should return water for 2-hop path (deep-water -> sand)', () => {
      // Arrange: Reference compat graph
      // Assert: nextHop('deep-water', 'sand') === 'water'
      //   Path: deep-water -> water -> sand (2 hops)

      // TODO: implement
    });

    it('should return water for 3-hop path (deep-water -> soil)', () => {
      // AC2: "nextHop('deep_water', 'soil') with water in the preference array,
      //        the system shall return 'water'"
      // Arrange: Reference compat graph with preference ['water', 'grass', ...]
      // Assert: nextHop('deep-water', 'soil') === 'water'
      //   Path: deep-water -> water -> grass -> soil (3 hops)
      //   Per Design Doc routing table

      // TODO: implement
    });

    it('should return grass for reverse 3-hop path (soil -> deep-water)', () => {
      // Arrange: Reference compat graph
      // Assert: nextHop('soil', 'deep-water') === 'grass'
      //   Path: soil -> grass -> water -> deep-water (3 hops)

      // TODO: implement
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
      //   If grass has equal-length paths to some target through both water and sand
      //
      // Assert: nextHop selects through water (earlier in preference array)
      // Specific case: nextHop('deep-water', 'sand') = 'water'
      //   Path could be: dw -> water -> sand (2 hops through water)
      //   This is the only path since dw only connects to water in the compat graph

      // TODO: implement
    });

    it('should be deterministic: same input always produces same routing table', () => {
      // Arrange: Build routing table twice with same inputs
      // Assert: For all material pairs (A, B):
      //   table1.nextHop(A, B) === table2.nextHop(A, B)

      // TODO: implement
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
      // Assert: nextHop('water', 'water') === null
      //         nextHop('grass', 'grass') === null
      //         nextHop('deep-water', 'deep-water') === null

      // TODO: implement
    });

    it('should return null for unreachable pair', () => {
      // AC2: "If no path exists between A and B, then nextHop[A][B] shall be null"
      // Arrange: Small compat graph with disconnected components
      //   e.g., {A--B} and {C--D} with no path between them
      // Assert: nextHop('A', 'C') === null
      //         hasRoute('A', 'C') === false

      // TODO: implement
    });
  });

  describe('hasRoute consistency', () => {
    // ROI: 70 | Business Value: 7 | Frequency: 5
    // @category: core-functionality
    // @dependency: CompatGraph
    // @complexity: low

    it('should be consistent with nextHop results', () => {
      // Arrange: Reference compat graph
      // Assert: For all material pairs tested above:
      //   hasRoute(A, B) === (nextHop(A, B) !== null)

      // TODO: implement
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
      //
      // Assert (all 10 entries from Design Doc):
      //   nextHop('deep-water', 'soil')   === 'water'   // dw -> water -> grass -> soil
      //   nextHop('soil', 'deep-water')   === 'grass'   // soil -> grass -> water -> dw
      //   nextHop('deep-water', 'sand')   === 'water'   // dw -> water -> sand
      //   nextHop('sand', 'deep-water')   === 'water'   // sand -> water -> dw
      //   nextHop('deep-water', 'grass')  === 'water'   // dw -> water -> grass
      //   nextHop('soil', 'water')        === 'grass'   // soil -> grass -> water
      //   nextHop('soil', 'sand')         === 'grass'   // soil -> grass -> sand
      //   nextHop('water', 'soil')        === 'grass'   // water -> grass -> soil
      //   nextHop('water', 'deep-water')  === 'deep-water' // direct
      //   nextHop('sand', 'soil')         === 'grass'   // sand -> grass -> soil

      // TODO: implement
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
      // Assert: Verify returned RoutingTable cannot be modified externally

      // TODO: implement
    });
  });
});
