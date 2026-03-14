/**
 * Two-level game object classification hierarchy.
 * Derived from GDD spatial domains (house interior, yard/exterior, farm, public town).
 *
 * Soft-enforced: these are the predefined values shown first in editor dropdowns.
 * Custom values are accepted by the DB (VARCHAR) but not represented in these types.
 *
 * @see ADR-0011 Game Object Type System
 */

export const GAME_OBJECT_CATEGORIES = [
  'interior',
  'exterior',
  'farm',
  'public',
] as const;

export type GameObjectCategory = (typeof GAME_OBJECT_CATEGORIES)[number];

export const GAME_OBJECT_TYPES = {
  interior: ['furniture', 'decor', 'lighting'] as const,
  exterior: [
    'fence', // Decorative fence/gate objects (e.g., garden archway). NOT fence system segments (see ADR-0010).
    'gate',
    'path',
    'bench',
    'lantern',
    'flowerbed',
    'utility_building',
  ] as const,
  farm: ['crop', 'tree', 'animal_enclosure', 'crafting_station'] as const,
  public: ['town_building', 'market_stall', 'transport_station'] as const,
} as const satisfies Record<GameObjectCategory, readonly string[]>;

export type GameObjectType<C extends GameObjectCategory = GameObjectCategory> =
  (typeof GAME_OBJECT_TYPES)[C][number];

/**
 * Type guard: check if a string is a known GameObjectCategory.
 */
export function isGameObjectCategory(
  value: string
): value is GameObjectCategory {
  return (GAME_OBJECT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Type guard: check if a string is a known GameObjectType for a given category.
 */
export function isGameObjectType(
  category: GameObjectCategory,
  value: string
): value is GameObjectType<typeof category> {
  return (GAME_OBJECT_TYPES[category] as readonly string[]).includes(value);
}

/**
 * Get all known object types as a flat array (across all categories).
 */
export function getAllGameObjectTypes(): string[] {
  return Object.values(GAME_OBJECT_TYPES).flat();
}
