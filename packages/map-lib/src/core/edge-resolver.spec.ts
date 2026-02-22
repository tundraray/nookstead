// EdgeResolver Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC3: Edge Ownership (FR3, V2)
// Generated: 2026-02-22

import type { TilesetInfo } from '../types/material-types';
// TODO: uncomment when modules are implemented
// import { TilesetRegistry } from './tileset-registry';
// import { buildGraphs } from './graph-builder';
// import { computeRoutingTable } from './router';
// import { resolveEdge } from './edge-resolver';
// import type { RoutingTable, MaterialPriorityMap } from '../types/routing-types';

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

/** Preset A: Water-Side Owns Shore. */
function makePresetAPriorities(): Map<string, number> {
  return new Map([
    ['deep-water', 100],
    ['water', 90],
    ['sand', 50],
    ['grass', 30],
    ['soil', 10],
  ]);
}

/** Preset B: Land-Side Owns Shore. */
function makePresetBPriorities(): Map<string, number> {
  return new Map([
    ['grass', 100],
    ['soil', 90],
    ['sand', 80],
    ['water', 30],
    ['deep-water', 10],
  ]);
}

function makeDefaultPreferences(): string[] {
  return ['water', 'grass', 'sand', 'soil', 'deep-water'];
}

// TODO: Helper to build pipeline for tests
// function buildPipeline(priorities: Map<string, number>) {
//   const registry = new TilesetRegistry(makeReferenceTilesets());
//   const { compatGraph } = buildGraphs(registry);
//   const router = computeRoutingTable(compatGraph, makeDefaultPreferences());
//   return { registry, router, priorities };
// }

// ---------------------------------------------------------------------------
// resolveEdge
// ---------------------------------------------------------------------------

describe('resolveEdge', () => {
  describe('single valid candidate', () => {
    // AC3: "If only one candidate is valid (has a non-null nextHop and a
    //        matching tileset), then that candidate shall own the edge"
    // ROI: 88 | Business Value: 10 (core ownership) | Frequency: 10
    // @category: core-functionality
    // @dependency: Router, TilesetRegistry
    // @complexity: medium

    it('should assign ownership to the only valid candidate', () => {
      // Arrange:
      //   Materials: deep-water (A) and water (B), direction E
      //   A: nextHop(dw, water) = water -> hasTileset(dw, water) = true -> VALID
      //   B: nextHop(water, dw) = deep-water -> hasTileset(water, dw) = false -> INVALID
      //   Only A is valid
      //
      // Assert:
      //   EdgeOwner indicates deep-water owns the edge
      //   Owner material = 'deep-water', bg = 'water'

      // TODO: implement
    });
  });

  describe('both valid -- priority decides', () => {
    // AC3: "If both candidates are valid, then the candidate with higher
    //        materialPriority shall own the edge"
    // ROI: 85 | Business Value: 9 (conflict resolution) | Frequency: 6
    // @category: core-functionality
    // @dependency: Router, TilesetRegistry, MaterialPriorityMap
    // @complexity: medium

    it('should assign ownership to higher-priority material (Preset A: water > grass)', () => {
      // Arrange:
      //   Materials: water (A, priority=90) and grass (B, priority=30), direction S
      //   A: nextHop(water, grass) = grass -> hasTileset(water, grass) = true -> VALID
      //   B: nextHop(grass, water) = water -> hasTileset(grass, water) = true -> VALID
      //   Both valid, water has higher priority (90 > 30)
      //
      // Assert: water owns the edge

      // TODO: implement
    });

    it('should assign ownership to higher-priority material (Preset B: grass > water)', () => {
      // AC3: "When Preset B is active (land-side owns shore), grass's
      //        materialPriority shall be higher than water's"
      // Arrange:
      //   Same materials but Preset B (grass=100, water=30)
      //   Both valid, grass has higher priority
      //
      // Assert: grass owns the edge

      // TODO: implement
    });
  });

  describe('neither valid', () => {
    // AC3: "If neither candidate is valid, then the edge shall be marked
    //        as unresolved and logged"
    // ROI: 72 | Business Value: 7 (error handling) | Frequency: 2
    // @category: edge-case
    // @dependency: Router, TilesetRegistry
    // @complexity: low

    it('should return null when neither candidate has a valid tileset', () => {
      // Arrange:
      //   Custom registry with only base tilesets (no transition pairs)
      //   Two materials A and B adjacent but no A_B or B_A tileset exists
      //   nextHop(A, B) = null (no compat edge either)
      //
      // Assert: resolveEdge returns null

      // TODO: implement
    });
  });

  describe('same material', () => {
    // ROI: 70 | Business Value: 7 | Frequency: 10
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return early with no ownership needed for same material', () => {
      // Arrange:
      //   Materials: grass and grass
      //
      // Assert: resolveEdge returns null or a "no-op" indicator
      //         No ownership resolution needed for same-material edges

      // TODO: implement
    });
  });

  describe('symmetry', () => {
    // AC3: Edge ownership symmetry requirement
    // ROI: 82 | Business Value: 9 | Frequency: 10
    // @category: core-functionality
    // @dependency: Router, TilesetRegistry
    // @complexity: medium

    it('should produce consistent ownership from both perspectives (deep-water | soil)', () => {
      // Arrange:
      //   resolveEdge('deep-water', 'soil', 'E', ...)
      //   resolveEdge('soil', 'deep-water', 'W', ...)
      //
      // Assert:
      //   Both agree on which material is the owner
      //   The edge is not double-claimed

      // TODO: implement
    });
  });

  describe('preset switching', () => {
    // AC3: "The policy preset shall be switchable via materialPriority map
    //        without code changes"
    // ROI: 75 | Business Value: 8 | Frequency: 3
    // @category: core-functionality
    // @dependency: MaterialPriorityMap
    // @complexity: low

    it('should produce different ownership for water|grass edge under Preset A vs Preset B', () => {
      // Arrange:
      //   Preset A: water(90) > grass(30) -> water owns
      //   Preset B: grass(100) > water(30) -> grass owns
      //   Same edge, same tilesets, different priority map
      //
      // Assert:
      //   Under Preset A: water owns the edge
      //   Under Preset B: grass owns the edge

      // TODO: implement
    });
  });
});
