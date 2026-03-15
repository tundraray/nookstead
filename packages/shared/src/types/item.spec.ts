import {
  ITEM_CATEGORIES,
  ITEM_TYPES,
  ITEM_DEFINITIONS,
  isItemCategory,
  isItemType,
  getItemDefinition,
} from './item';
import type { ItemCategory, ItemType, ItemDefinition } from './item';

describe('Item type system', () => {
  describe('ITEM_CATEGORIES', () => {
    it('should contain exactly 7 categories', () => {
      expect(ITEM_CATEGORIES).toHaveLength(7);
    });

    it.each([
      'tool',
      'seed',
      'crop',
      'material',
      'consumable',
      'gift',
      'special',
    ] as const)('should include "%s"', (category) => {
      expect(ITEM_CATEGORIES).toContain(category);
    });
  });

  describe('ITEM_TYPES', () => {
    it('should have a key for every category', () => {
      for (const category of ITEM_CATEGORIES) {
        expect(ITEM_TYPES).toHaveProperty(category);
        expect(Array.isArray(ITEM_TYPES[category])).toBe(true);
        expect(ITEM_TYPES[category].length).toBeGreaterThan(0);
      }
    });

    it('should include hoe in tool category', () => {
      expect(ITEM_TYPES.tool).toContain('hoe');
    });

    it('should include seed_radish in seed category', () => {
      expect(ITEM_TYPES.seed).toContain('seed_radish');
    });
  });

  describe('isItemCategory', () => {
    it('should return true for valid category "tool"', () => {
      expect(isItemCategory('tool')).toBe(true);
    });

    it('should return true for valid category "special"', () => {
      expect(isItemCategory('special')).toBe(true);
    });

    it('should return false for invalid category', () => {
      expect(isItemCategory('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isItemCategory('')).toBe(false);
    });
  });

  describe('isItemType', () => {
    it('should return true for valid item type within its category', () => {
      expect(isItemType('tool', 'hoe')).toBe(true);
    });

    it('should return false for item type not in the given category', () => {
      expect(isItemType('tool', 'carrot_seed')).toBe(false);
    });

    it('should return false for nonexistent item type', () => {
      expect(isItemType('seed', 'nonexistent')).toBe(false);
    });
  });

  describe('getItemDefinition', () => {
    it('should return a valid definition for "hoe"', () => {
      const def = getItemDefinition('hoe');

      expect(def).toBeDefined();
      expect(def!.itemType).toBe('hoe');
      expect(def!.category).toBe('tool');
      expect(def!.stackable).toBe(false);
      expect(def!.maxStack).toBe(1);
      expect(def!.displayName).toBe('Hoe');
    });

    it('should return undefined for unknown item type', () => {
      expect(getItemDefinition('unknown_item')).toBeUndefined();
    });

    it('should return a stackable definition for "wood"', () => {
      const def = getItemDefinition('wood');

      expect(def).toBeDefined();
      expect(def!.stackable).toBe(true);
      expect(def!.maxStack).toBe(99);
      expect(def!.category).toBe('material');
    });

    it('should return a definition with spriteRect tuple', () => {
      const def = getItemDefinition('hoe');

      expect(def).toBeDefined();
      expect(def!.spriteRect).toHaveLength(4);
      expect(def!.spriteRect.every((v) => typeof v === 'number')).toBe(true);
    });

    it('should return a definition for "town_key" with description', () => {
      const def = getItemDefinition('town_key');

      expect(def).toBeDefined();
      expect(def!.category).toBe('special');
      expect(def!.stackable).toBe(false);
      expect(def!.maxStack).toBe(1);
      expect(def!.description).toBeDefined();
    });

    it('should return a definition for "bouquet_mixed"', () => {
      const def = getItemDefinition('bouquet_mixed');

      expect(def).toBeDefined();
      expect(def!.category).toBe('gift');
      expect(def!.stackable).toBe(true);
    });
  });

  describe('ITEM_DEFINITIONS completeness', () => {
    it('should have at least one item defined for each category that has entries', () => {
      const definedCategories = new Set(
        Object.values(ITEM_DEFINITIONS).map((d) => d.category)
      );

      // At minimum, tool, seed, crop, material, gift, special should have definitions
      expect(definedCategories).toContain('tool');
      expect(definedCategories).toContain('seed');
      expect(definedCategories).toContain('crop');
      expect(definedCategories).toContain('material');
      expect(definedCategories).toContain('gift');
      expect(definedCategories).toContain('special');
    });

    it('should have consistent itemType keys matching definition keys', () => {
      for (const [key, def] of Object.entries(ITEM_DEFINITIONS)) {
        expect(def.itemType).toBe(key);
      }
    });
  });
});
