// TilesetRegistry Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC1: Graph Construction (FR1)
// Generated: 2026-02-22

import type { TilesetInfo } from '../types/material-types';
// TODO: uncomment when module is implemented
// import { TilesetRegistry } from './tileset-registry';

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

/**
 * Reference tileset set from Design Doc (11 tilesets, 5 base + 6 transition).
 */
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
// TilesetRegistry
// ---------------------------------------------------------------------------

describe('TilesetRegistry', () => {
  describe('constructor', () => {
    // AC1: "When TilesetRegistry is initialized with a set of tilesets"
    // ROI: 85 | Business Value: 10 (foundation) | Frequency: 10
    // @category: core-functionality
    // @dependency: none
    // @complexity: medium

    it('should construct from reference tileset set without errors', () => {
      // Arrange: Reference tilesets (11 entries)
      // Act: new TilesetRegistry(makeReferenceTilesets())
      // Assert: No throw, instance created

      // TODO: implement
    });

    it('should construct from empty tileset array', () => {
      // Arrange: Empty array []
      // Act: new TilesetRegistry([])
      // Assert: No throw, getAllMaterials() returns empty set

      // TODO: implement
    });

    it('should skip entries without fromMaterialKey', () => {
      // Arrange: [{ key: 'ts-x', name: 'X' }] -- no fromMaterialKey
      // Act: new TilesetRegistry([...])
      // Assert: getAllMaterials() does not include material from skipped entry

      // TODO: implement
    });

    it('should treat self-edge tilesets (from === to) as base tilesets, not graph edges', () => {
      // AC1: "If a tileset has fromMaterialKey === toMaterialKey, then the system
      //        shall treat it as a base tileset and not add a self-edge to the graphs"
      // Arrange: [{ key: 'ts-g', name: 'grass', fromMaterialKey: 'grass', toMaterialKey: 'grass' }]
      // Act: new TilesetRegistry([...])
      // Assert: hasTileset('grass', 'grass') returns false (no self-edge)
      //         getBaseTilesetKey('grass') returns 'ts-g'

      // TODO: implement
    });
  });

  describe('hasTileset / getTilesetKey', () => {
    // AC1: "compatGraph[A] containing every material B where either A_B or B_A tileset exists"
    // ROI: 90 | Business Value: 10 (core lookup) | Frequency: 10
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return true for existing transition pair (soil, grass)', () => {
      // Arrange: Registry from reference tilesets
      // Assert: hasTileset('soil', 'grass') === true
      //         getTilesetKey('soil', 'grass') === 'ts-soil-grass'

      // TODO: implement
    });

    it('should return false for missing transition pair (soil, water)', () => {
      // Arrange: Registry from reference tilesets
      // Assert: hasTileset('soil', 'water') === false
      //         getTilesetKey('soil', 'water') === undefined

      // TODO: implement
    });

    it('should return false for reversed pair when only forward exists', () => {
      // Arrange: Registry from reference tilesets
      //   deep-water -> water exists, but water -> deep-water does NOT
      // Assert: hasTileset('deep-water', 'water') === true
      //         hasTileset('water', 'deep-water') === false

      // TODO: implement
    });
  });

  describe('getBaseTilesetKey', () => {
    // ROI: 80 | Business Value: 9 | Frequency: 8
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return base tileset key for material with standalone entry', () => {
      // Arrange: Registry from reference tilesets
      // Assert: getBaseTilesetKey('deep-water') === 'ts-deep-water'
      //         getBaseTilesetKey('grass') === 'ts-grass'

      // TODO: implement
    });

    it('should return undefined for unknown material', () => {
      // Arrange: Registry from reference tilesets
      // Assert: getBaseTilesetKey('lava') === undefined

      // TODO: implement
    });
  });

  describe('getAllMaterials', () => {
    // ROI: 75 | Business Value: 7 | Frequency: 5
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return all unique materials from reference tilesets', () => {
      // Arrange: Registry from reference tilesets
      // Assert: getAllMaterials() contains: deep-water, water, grass, soil, sand
      //         getAllMaterials().size === 5

      // TODO: implement
    });
  });

  describe('getAllTransitionPairs', () => {
    // ROI: 70 | Business Value: 6 | Frequency: 3
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return all transition pairs as [from, to] tuples', () => {
      // Arrange: Registry from reference tilesets (6 transition pairs)
      // Assert: getAllTransitionPairs() has length 6
      //         Includes ['deep-water', 'water'], ['water', 'grass'], ['grass', 'water'],
      //                  ['soil', 'grass'], ['sand', 'water'], ['sand', 'grass']

      // TODO: implement
    });
  });

  describe('getTilesetInfo', () => {
    // ROI: 65 | Business Value: 5 | Frequency: 3
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return TilesetInfo for existing key', () => {
      // Arrange: Registry from reference tilesets
      // Assert: getTilesetInfo('ts-soil-grass')?.fromMaterialKey === 'soil'
      //         getTilesetInfo('ts-soil-grass')?.toMaterialKey === 'grass'

      // TODO: implement
    });

    it('should return undefined for unknown key', () => {
      // Arrange: Registry from reference tilesets
      // Assert: getTilesetInfo('ts-nonexistent') === undefined

      // TODO: implement
    });
  });

  describe('immutability', () => {
    // AC1: "shall represent graphs using ReadonlyMap<string, ReadonlySet<string>>"
    // ROI: 60 | Business Value: 7 | Frequency: 2
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should be immutable after construction', () => {
      // Arrange: Registry from reference tilesets
      // Assert: Verify that returned collections (getAllMaterials, getAllTransitionPairs)
      //         are readonly and cannot be mutated externally

      // TODO: implement
    });
  });
});
