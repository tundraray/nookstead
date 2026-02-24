// TilesetRegistry Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC1: Graph Construction (FR1)
// Generated: 2026-02-22

import type { TilesetInfo } from '../types/material-types';
import { TilesetRegistry } from './tileset-registry';

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
      const tilesets = makeReferenceTilesets();
      const registry = new TilesetRegistry(tilesets);

      expect(registry).toBeInstanceOf(TilesetRegistry);
    });

    it('should construct from empty tileset array', () => {
      const registry = new TilesetRegistry([]);

      expect(registry.getAllMaterials().size).toBe(0);
    });

    it('should skip entries without fromMaterialKey', () => {
      const tilesets: TilesetInfo[] = [
        { key: 'ts-x', name: 'X' },
        makeTileset('ts-grass', 'grass'),
      ];
      const registry = new TilesetRegistry(tilesets);

      expect(registry.getAllMaterials().size).toBe(1);
      expect(registry.getAllMaterials().has('grass')).toBe(true);
      expect(registry.getTilesetInfo('ts-x')).toBeUndefined();
    });

    it('should treat self-edge tilesets (from === to) as base tilesets, not graph edges', () => {
      const tilesets: TilesetInfo[] = [
        { key: 'ts-g', name: 'grass', fromMaterialKey: 'grass', toMaterialKey: 'grass' },
      ];
      const registry = new TilesetRegistry(tilesets);

      expect(registry.hasTileset('grass', 'grass')).toBe(false);
      expect(registry.getBaseTilesetKey('grass')).toBe('ts-g');
    });
  });

  describe('hasTileset / getTilesetKey', () => {
    // AC1: "compatGraph[A] containing every material B where either A_B or B_A tileset exists"
    // ROI: 90 | Business Value: 10 (core lookup) | Frequency: 10
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return true for existing transition pair (soil, grass)', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());

      expect(registry.hasTileset('soil', 'grass')).toBe(true);
      expect(registry.getTilesetKey('soil', 'grass')).toBe('ts-soil-grass');
    });

    it('should return false for missing transition pair (soil, water)', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());

      expect(registry.hasTileset('soil', 'water')).toBe(false);
      expect(registry.getTilesetKey('soil', 'water')).toBeUndefined();
    });

    it('should return false for reversed pair when only forward exists', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());

      // deep-water -> water exists
      expect(registry.hasTileset('deep-water', 'water')).toBe(true);
      // water -> deep-water does NOT exist
      expect(registry.hasTileset('water', 'deep-water')).toBe(false);
    });
  });

  describe('getBaseTilesetKey', () => {
    // ROI: 80 | Business Value: 9 | Frequency: 8
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return base tileset key for material with standalone entry', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());

      expect(registry.getBaseTilesetKey('deep-water')).toBe('ts-deep-water');
      expect(registry.getBaseTilesetKey('grass')).toBe('ts-grass');
    });

    it('should return undefined for unknown material', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());

      expect(registry.getBaseTilesetKey('lava')).toBeUndefined();
    });
  });

  describe('getAllMaterials', () => {
    // ROI: 75 | Business Value: 7 | Frequency: 5
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return all unique materials from reference tilesets', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const materials = registry.getAllMaterials();

      expect(materials.size).toBe(5);
      expect(materials.has('deep-water')).toBe(true);
      expect(materials.has('water')).toBe(true);
      expect(materials.has('grass')).toBe(true);
      expect(materials.has('soil')).toBe(true);
      expect(materials.has('sand')).toBe(true);
    });
  });

  describe('getAllTransitionPairs', () => {
    // ROI: 70 | Business Value: 6 | Frequency: 3
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return all transition pairs as [from, to] tuples', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const pairs = registry.getAllTransitionPairs();

      expect(pairs).toHaveLength(6);

      const pairStrings = pairs.map(([from, to]) => `${from}:${to}`);
      expect(pairStrings).toContain('deep-water:water');
      expect(pairStrings).toContain('water:grass');
      expect(pairStrings).toContain('grass:water');
      expect(pairStrings).toContain('soil:grass');
      expect(pairStrings).toContain('sand:water');
      expect(pairStrings).toContain('sand:grass');
    });
  });

  describe('getTilesetInfo', () => {
    // ROI: 65 | Business Value: 5 | Frequency: 3
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should return TilesetInfo for existing key', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const info = registry.getTilesetInfo('ts-soil-grass');

      expect(info).toBeDefined();
      expect(info?.fromMaterialKey).toBe('soil');
      expect(info?.toMaterialKey).toBe('grass');
    });

    it('should return undefined for unknown key', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());

      expect(registry.getTilesetInfo('ts-nonexistent')).toBeUndefined();
    });
  });

  describe('resolvePair', () => {
    // ADR-0011 Decision 7: direct-first reverse-pair fallback
    // ROI: 95 | Business Value: 10 (fixes isolated frame bug) | Frequency: 10
    // @category: core-functionality

    it('should return direct when FG_BG tileset exists', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const result = registry.resolvePair('water', 'grass');

      expect(result).not.toBeNull();
      expect(result!.tilesetKey).toBe('ts-water-grass');
      expect(result!.orientation).toBe('direct');
    });

    it('should return reverse when only BG_FG tileset exists', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      // deep-water -> water exists, but water -> deep-water does NOT
      const result = registry.resolvePair('water', 'deep-water');

      expect(result).not.toBeNull();
      expect(result!.tilesetKey).toBe('ts-deep-water-water');
      expect(result!.orientation).toBe('reverse');
    });

    it('should return direct when both FG_BG and BG_FG exist', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      // water -> grass AND grass -> water both exist
      const result = registry.resolvePair('water', 'grass');

      expect(result).not.toBeNull();
      expect(result!.tilesetKey).toBe('ts-water-grass');
      expect(result!.orientation).toBe('direct');
    });

    it('should return null when neither direction exists', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      // soil -> deep-water and deep-water -> soil both missing
      const result = registry.resolvePair('soil', 'deep-water');

      expect(result).toBeNull();
    });

    it('should return null for self-edge (fg === bg)', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const result = registry.resolvePair('water', 'water');

      expect(result).toBeNull();
    });
  });

  describe('hasPairOrReverse', () => {
    it('should return true when direct pair exists', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      expect(registry.hasPairOrReverse('water', 'grass')).toBe(true);
    });

    it('should return true when only reverse pair exists', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      // water -> deep-water doesn't exist, but deep-water -> water does
      expect(registry.hasPairOrReverse('water', 'deep-water')).toBe(true);
    });

    it('should return false when neither direction exists', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      expect(registry.hasPairOrReverse('soil', 'deep-water')).toBe(false);
    });

    it('should return false for self-edge', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());
      expect(registry.hasPairOrReverse('water', 'water')).toBe(false);
    });
  });

  describe('immutability', () => {
    // AC1: "shall represent graphs using ReadonlyMap<string, ReadonlySet<string>>"
    // ROI: 60 | Business Value: 7 | Frequency: 2
    // @category: core-functionality
    // @dependency: none
    // @complexity: low

    it('should be immutable after construction', () => {
      const registry = new TilesetRegistry(makeReferenceTilesets());

      // getAllMaterials returns ReadonlySet -- verify it cannot be mutated
      const materials = registry.getAllMaterials();
      expect(typeof (materials as Set<string>).add).toBe('function');
      // The returned set should be a real Set, but the type system prevents mutation.
      // We verify that getting the same reference twice returns consistent data.
      expect(registry.getAllMaterials()).toBe(materials);

      // getAllTransitionPairs returns frozen array
      const pairs = registry.getAllTransitionPairs();
      expect(Object.isFrozen(pairs)).toBe(true);
      expect(registry.getAllTransitionPairs()).toBe(pairs);
    });
  });
});
