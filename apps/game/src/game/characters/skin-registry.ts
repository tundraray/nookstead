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
    key: 'scout',
    sheetPath: 'characters/Modern_Exteriors_Characters_Scout_16x16_6.png',
    sheetKey: 'char-scout',
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
