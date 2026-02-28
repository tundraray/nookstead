// EdgeResolver Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC3: Edge Ownership (FR3, V2)
// AC10: Neighbor Repaint Policy (FR12) -- classifyEdge additions
// Generated: 2026-02-22 | Updated: 2026-02-24

import type { TilesetInfo } from '../types/material-types';
import { TilesetRegistry } from './tileset-registry';
import { buildGraphs } from './graph-builder';
import { computeRoutingTable } from './router';
import { resolveEdge } from './edge-resolver';
import { classifyEdge } from './edge-resolver';
import type { MaterialPriorityMap } from '../types/routing-types';

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

function buildPipeline(priorities: Map<string, number>) {
  const registry = new TilesetRegistry(makeReferenceTilesets());
  const { compatGraph } = buildGraphs(registry);
  const router = computeRoutingTable(compatGraph, makeDefaultPreferences());
  return { registry, router, priorities };
}

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
      const { registry, router, priorities } = buildPipeline(makePresetAPriorities());

      const result = resolveEdge('deep-water', 'water', 'E', router, registry, priorities);

      // Assert:
      //   EdgeOwner indicates deep-water owns the edge
      //   Owner material = 'deep-water', bg = 'water'
      expect(result).not.toBeNull();
      expect(result!.owner).toBe('deep-water');
      expect(result!.bg).toBe('water');
      expect(result!.tilesetKey).toBe('ts-deep-water-water');
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
      const { registry, router, priorities } = buildPipeline(makePresetAPriorities());

      const result = resolveEdge('water', 'grass', 'S', router, registry, priorities);

      // Assert: water owns the edge
      expect(result).not.toBeNull();
      expect(result!.owner).toBe('water');
      expect(result!.bg).toBe('grass');
      expect(result!.tilesetKey).toBe('ts-water-grass');
    });

    it('should assign ownership to higher-priority material (Preset B: grass > water)', () => {
      // AC3: "When Preset B is active (land-side owns shore), grass's
      //        materialPriority shall be higher than water's"
      // Arrange:
      //   Same materials but Preset B (grass=100, water=30)
      //   Both valid, grass has higher priority
      const { registry, router, priorities } = buildPipeline(makePresetBPriorities());

      const result = resolveEdge('water', 'grass', 'S', router, registry, priorities);

      // Assert: grass owns the edge
      expect(result).not.toBeNull();
      expect(result!.owner).toBe('grass');
      expect(result!.bg).toBe('water');
      expect(result!.tilesetKey).toBe('ts-grass-water');
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
      const isolatedTilesets: TilesetInfo[] = [
        makeTileset('ts-alpha', 'alpha'),
        makeTileset('ts-beta', 'beta'),
      ];
      const registry = new TilesetRegistry(isolatedTilesets);
      const { compatGraph } = buildGraphs(registry);
      const router = computeRoutingTable(compatGraph, []);
      const priorities: MaterialPriorityMap = new Map([
        ['alpha', 50],
        ['beta', 40],
      ]);

      const result = resolveEdge('alpha', 'beta', 'N', router, registry, priorities);

      // Assert: resolveEdge returns null
      expect(result).toBeNull();
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
      const { registry, router, priorities } = buildPipeline(makePresetAPriorities());

      const result = resolveEdge('grass', 'grass', 'W', router, registry, priorities);

      // Assert: resolveEdge returns null
      //         No ownership resolution needed for same-material edges
      expect(result).toBeNull();
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
      const { registry, router, priorities } = buildPipeline(makePresetAPriorities());

      const resultAB = resolveEdge('deep-water', 'soil', 'E', router, registry, priorities);
      const resultBA = resolveEdge('soil', 'deep-water', 'W', router, registry, priorities);

      // Assert:
      //   Both agree on which material is the owner
      //   The edge is not double-claimed
      expect(resultAB).not.toBeNull();
      expect(resultBA).not.toBeNull();
      expect(resultAB!.owner).toBe(resultBA!.owner);
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
      const pipelineA = buildPipeline(makePresetAPriorities());
      const pipelineB = buildPipeline(makePresetBPriorities());

      const resultA = resolveEdge(
        'water', 'grass', 'N',
        pipelineA.router, pipelineA.registry, pipelineA.priorities,
      );
      const resultB = resolveEdge(
        'water', 'grass', 'N',
        pipelineB.router, pipelineB.registry, pipelineB.priorities,
      );

      // Assert:
      //   Under Preset A: water owns the edge
      //   Under Preset B: grass owns the edge
      expect(resultA).not.toBeNull();
      expect(resultB).not.toBeNull();
      expect(resultA!.owner).toBe('water');
      expect(resultB!.owner).toBe('grass');
    });
  });
});

// ---------------------------------------------------------------------------
// classifyEdge -- AC10: Neighbor Repaint Policy (FR12)
// Design Doc: docs/design/design-015-neighbor-repaint-policy-v2-ru.md
// Sections 4.2 and 4.3: Five edge classes derived from {hopA, hopB, pairA, pairB}
// Generated: 2026-02-24 | Budget: N/A (unit tests, no integration budget consumed)
// ---------------------------------------------------------------------------

describe('classifyEdge', () => {
  describe('C1: same-material edge', () => {
    // AC10: "When A === B, classifyEdge shall return 'C1'"
    // Section 4.3: C1 condition is A === B.
    // ROI: 22 | Business Value: 6 | Frequency: 10 | Defect Detection: 6
    // Behavior: calling classifyEdge with identical materials → returns 'C1'
    // @category: core-functionality
    // @dependency: none (pure function, no router/registry calls made)
    // @complexity: low

    it('should return C1 when both materials are the same (grass <-> grass)', () => {
      const { registry, router } = buildPipeline(makePresetAPriorities());
      const result = classifyEdge('grass', 'grass', router, registry);
      expect(result).toBe('C1');
    });
  });

  describe('C2: symmetric direct edge', () => {
    // AC10: "When pairA.orientation === 'direct' AND pairB.orientation === 'direct'
    //         AND hopA === B AND hopB === A, classifyEdge shall return 'C2'"
    // Section 4.3: C2 = both direct, no bridge (direct neighbor pair).
    // Design Doc Section 10.2: grass <-> water is the only C2 pair in reference dataset.
    // ROI: 27 | Business Value: 9 | Frequency: 8 | Defect Detection: 9
    // Behavior: grass <-> water pair → both sides have direct tilesets → returns 'C2'
    // @category: core-functionality
    // @dependency: Router, TilesetRegistry
    // @complexity: medium

    it('should return C2 for grass <-> water (symmetric direct pair, reference dataset)', () => {
      const { registry, router } = buildPipeline(makePresetAPriorities());
      const result = classifyEdge('grass', 'water', router, registry);
      expect(result).toBe('C2');
    });

    it('should return C2 for water <-> grass (commutative -- same classification)', () => {
      const { registry, router } = buildPipeline(makePresetAPriorities());
      const resultAB = classifyEdge('grass', 'water', router, registry);
      const resultBA = classifyEdge('water', 'grass', router, registry);
      expect(resultAB).toBe('C2');
      expect(resultBA).toBe('C2');
      expect(resultAB).toBe(resultBA);
    });
  });

  describe('C3: stable bridged edge', () => {
    // AC10: "When both pairA and pairB are direct AND hopA === hopB (same bridge),
    //         classifyEdge shall return 'C3'"
    // Section 4.3: C3 = both direct via same bridge material.
    // Section 10.2: deep-water <-> grass (bridge = water) is a reference C3 pair.
    // ROI: 24 | Business Value: 9 | Frequency: 7 | Defect Detection: 9
    // Behavior: deep-water <-> grass via water bridge → both sides use direct tilesets → returns 'C3'
    // @category: core-functionality
    // @dependency: Router, TilesetRegistry
    // @complexity: medium

    it('should return C3 for deep-water <-> grass (bridge = water, both direct)', () => {
      const { registry, router } = buildPipeline(makePresetAPriorities());
      const result = classifyEdge('deep-water', 'grass', router, registry);
      expect(result).toBe('C3');
    });
  });

  describe('C4: mixed valid edge', () => {
    // AC10: "When pairA !== null AND pairB !== null, but the pair does NOT satisfy C2 or C3
    //         conditions (at least one reverse orientation or different bridges),
    //         classifyEdge shall return 'C4'"
    // Section 4.3: C4 = both sides resolved but not both direct or using same direct bridge.
    // Section 8.2: deep-water <-> water is the canonical C4 example.
    //   nextHop(deep-water, water) = water -> pairA = resolvePair('deep-water', 'water') = direct ✓
    //   nextHop(water, deep-water) = deep-water -> pairB = resolvePair('water', 'deep-water')
    //     water_deep-water direct pair does NOT exist -> tries reverse -> ts-deep-water-water reverse ✓
    //   pairB orientation = 'reverse' -> fails bothDirect -> C4
    // ROI: 24 | Business Value: 8 | Frequency: 8 | Defect Detection: 9
    // Behavior: deep-water <-> water → pairB uses reverse orientation → returns 'C4'
    // @category: core-functionality
    // @dependency: Router, TilesetRegistry
    // @complexity: medium

    it('should return C4 for deep-water <-> water (pairB uses reverse orientation)', () => {
      const { registry, router } = buildPipeline(makePresetAPriorities());
      const result = classifyEdge('deep-water', 'water', router, registry);
      expect(result).toBe('C4');
    });

    it('should return C4 for deep-sand <-> water (mixed bridges / reverse pair)', () => {
      const extendedTilesets = [
        ...makeReferenceTilesets(),
        makeTileset('ts-deep-sand', 'deep-sand'),
        makeTileset('ts-deep-sand-water', 'deep-sand', 'water'),
        makeTileset('ts-deep-sand-sand', 'deep-sand', 'sand'),
      ];
      const registry = new TilesetRegistry(extendedTilesets);
      const { compatGraph } = buildGraphs(registry);
      const router = computeRoutingTable(compatGraph, makeDefaultPreferences());

      const result = classifyEdge('deep-sand', 'water', router, registry);
      expect(result).toBe('C4');
    });
  });

  describe('classification symmetry (Property)', () => {
    // AC10 Design Doc Section 9 (Determinism): "classifyEdge(A, B) shall return
    //   the same class regardless of argument order"
    // Test Type: Property
    // Property: For any valid material pair (A, B) with A !== B,
    //   classifyEdge(A, B) === classifyEdge(B, A)
    // Generator: Selected representative pairs from each class (C2, C3, C4)
    // Shrinking: single-pair minimal case
    // ROI: 18.7 | Business Value: 8 | Frequency: 6 | Defect Detection: 8
    // @category: core-functionality
    // @dependency: Router, TilesetRegistry
    // @complexity: low

    it('should return the same class regardless of argument order for C2 pair (grass, water)', () => {
      const { registry, router } = buildPipeline(makePresetAPriorities());
      const forward = classifyEdge('grass', 'water', router, registry);
      const backward = classifyEdge('water', 'grass', router, registry);
      expect(forward).toBe(backward);
      expect(forward).toBe('C2');
    });

    it('should return the same class regardless of argument order for C3 pair (deep-water, grass)', () => {
      const { registry, router } = buildPipeline(makePresetAPriorities());
      const forward = classifyEdge('deep-water', 'grass', router, registry);
      const backward = classifyEdge('grass', 'deep-water', router, registry);
      expect(forward).toBe(backward);
      expect(forward).toBe('C3');
    });

    it('should return the same class regardless of argument order for C4 pair (deep-water, water)', () => {
      const { registry, router } = buildPipeline(makePresetAPriorities());
      const forward = classifyEdge('deep-water', 'water', router, registry);
      const backward = classifyEdge('water', 'deep-water', router, registry);
      expect(forward).toBe(backward);
      expect(forward).toBe('C4');
    });
  });
});
