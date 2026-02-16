/**
 * Character skin definition.
 *
 * Each entry describes one visual appearance option for a player character,
 * mapping a logical key to its spritesheet asset path and Phaser texture key.
 */
export interface SkinDefinition {
  /** Unique identifier for this skin, e.g. 'scout'. */
  key: string;
  /** Relative path to the spritesheet PNG under the assets directory. */
  sheetPath: string;
  /** Phaser texture key used when loading and referencing this spritesheet. */
  sheetKey: string;
}

/**
 * Registry of all available character skins.
 *
 * To add a new skin, append an entry to this array. No other code changes
 * are required in the animation or movement systems.
 */
const SKIN_REGISTRY: readonly SkinDefinition[] = [
  {
    key: 'scout_1',
    sheetPath: 'characters/scout_1.png',
    sheetKey: 'scout_1',
  },
  {
    key: 'scout_2',
    sheetPath: 'characters/scout_2.png',
    sheetKey: 'scout_2',
  },
  {
    key: 'scout_3',
    sheetPath: 'characters/scout_3.png',
    sheetKey: 'scout_3',
  },
  {
    key: 'scout_4',
    sheetPath: 'characters/scout_4.png',
    sheetKey: 'scout_4',
  },
  {
    key: 'scout_5',
    sheetPath: 'characters/scout_5.png',
    sheetKey: 'scout_5',
  },
  {
    key: 'scout_6',
    sheetPath: 'characters/scout_6.png',
    sheetKey: 'scout_6',
  },
];

/**
 * Returns a copy of all registered character skins.
 */
export function getSkins(): SkinDefinition[] {
  return [...SKIN_REGISTRY];
}

/**
 * Returns the default character skin (first entry in the registry).
 */
export function getDefaultSkin(): SkinDefinition {
  return SKIN_REGISTRY[0];
}

/**
 * Look up a skin definition by its key (e.g., 'scout_3').
 * Returns undefined if no skin matches.
 */
export function getSkinByKey(key: string): SkinDefinition | undefined {
  return SKIN_REGISTRY.find((s) => s.key === key);
}
