/**
 * Item type system — categories, types, definitions, and type guards.
 *
 * Follows the same `as const satisfies Record<>` pattern as
 * `GAME_OBJECT_TYPES` in `game-object.ts`.
 *
 * @see design-025-item-inventory-system.md (Component 1)
 */

export const ITEM_CATEGORIES = [
  'tool',
  'seed',
  'crop',
  'material',
  'consumable',
  'gift',
  'special',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_TYPES = {
  tool: ['hoe', 'watering_can', 'sickle'] as const,
  seed: [
    'seed_radish',
    'seed_potato',
    'seed_strawberry',
    'seed_tomato',
    'seed_pumpkin',
  ] as const,
  crop: ['radish', 'potato', 'strawberry', 'tomato', 'pumpkin'] as const,
  material: ['wood', 'stone', 'fertilizer', 'wild_herb'] as const,
  consumable: ['bread_rosemary', 'chocolate_eclair'] as const,
  gift: ['bouquet_mixed', 'fishing_bait', 'rare_book'] as const,
  special: ['town_key', 'notebook_page'] as const,
} as const satisfies Record<ItemCategory, readonly string[]>;

export type ItemType<C extends ItemCategory = ItemCategory> =
  (typeof ITEM_TYPES)[C][number];

export interface ItemDefinition {
  itemType: string;
  displayName: string;
  category: ItemCategory;
  stackable: boolean;
  maxStack: number;
  spriteRect: [number, number, number, number]; // [x, y, w, h]
  description?: string;
}

/**
 * Static item definitions registry.
 *
 * Sprite rect values are placeholders `[x, y, 16, 16]` — these will be
 * updated when the item sprite sheet is created (separate art task).
 */
export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  hoe: {
    itemType: 'hoe',
    displayName: 'Hoe',
    category: 'tool',
    stackable: false,
    maxStack: 1,
    spriteRect: [0, 0, 16, 16],
    description: 'Till the soil for planting.',
  },
  watering_can: {
    itemType: 'watering_can',
    displayName: 'Watering Can',
    category: 'tool',
    stackable: false,
    maxStack: 1,
    spriteRect: [16, 0, 16, 16],
    description: 'Water your crops.',
  },
  sickle: {
    itemType: 'sickle',
    displayName: 'Sickle',
    category: 'tool',
    stackable: false,
    maxStack: 1,
    spriteRect: [32, 0, 16, 16],
    description: 'Harvest crops.',
  },
  seed_radish: {
    itemType: 'seed_radish',
    displayName: 'Radish Seeds',
    category: 'seed',
    stackable: true,
    maxStack: 99,
    spriteRect: [0, 16, 16, 16],
  },
  seed_potato: {
    itemType: 'seed_potato',
    displayName: 'Potato Seeds',
    category: 'seed',
    stackable: true,
    maxStack: 99,
    spriteRect: [16, 16, 16, 16],
  },
  radish: {
    itemType: 'radish',
    displayName: 'Radish',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteRect: [0, 32, 16, 16],
  },
  potato: {
    itemType: 'potato',
    displayName: 'Potato',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteRect: [16, 32, 16, 16],
  },
  wood: {
    itemType: 'wood',
    displayName: 'Wood',
    category: 'material',
    stackable: true,
    maxStack: 99,
    spriteRect: [0, 48, 16, 16],
  },
  stone: {
    itemType: 'stone',
    displayName: 'Stone',
    category: 'material',
    stackable: true,
    maxStack: 99,
    spriteRect: [16, 48, 16, 16],
  },
  bouquet_mixed: {
    itemType: 'bouquet_mixed',
    displayName: 'Mixed Bouquet',
    category: 'gift',
    stackable: true,
    maxStack: 10,
    spriteRect: [0, 64, 16, 16],
  },
  town_key: {
    itemType: 'town_key',
    displayName: 'Town Key',
    category: 'special',
    stackable: false,
    maxStack: 1,
    spriteRect: [0, 80, 16, 16],
    description: 'Key to the town gate.',
  },
};

/**
 * Type guard: check if a string is a known ItemCategory.
 */
export function isItemCategory(value: string): value is ItemCategory {
  return (ITEM_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Type guard: check if a string is a known ItemType for a given category.
 */
export function isItemType(
  category: ItemCategory,
  value: string
): value is ItemType<typeof category> {
  return (ITEM_TYPES[category] as readonly string[]).includes(value);
}

/**
 * Look up the static definition for an item type.
 * Returns `undefined` if no definition exists.
 */
export function getItemDefinition(
  itemType: string
): ItemDefinition | undefined {
  return ITEM_DEFINITIONS[itemType];
}
