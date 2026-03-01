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
  /** Skin type: 'preset' for built-in scouts, 'custom' for character generator skins. */
  type: 'preset' | 'custom';
  /** Spritesheet width in pixels (927 for scouts, 896 for custom). */
  textureWidth: number;
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
    type: 'preset',
    textureWidth: 927,
  },
  {
    key: 'scout_2',
    sheetPath: 'characters/scout_2.png',
    sheetKey: 'scout_2',
    type: 'preset',
    textureWidth: 927,
  },
  {
    key: 'scout_3',
    sheetPath: 'characters/scout_3.png',
    sheetKey: 'scout_3',
    type: 'preset',
    textureWidth: 927,
  },
  {
    key: 'scout_4',
    sheetPath: 'characters/scout_4.png',
    sheetKey: 'scout_4',
    type: 'preset',
    textureWidth: 927,
  },
  {
    key: 'scout_5',
    sheetPath: 'characters/scout_5.png',
    sheetKey: 'scout_5',
    type: 'preset',
    textureWidth: 927,
  },
  {
    key: 'scout_6',
    sheetPath: 'characters/scout_6.png',
    sheetKey: 'scout_6',
    type: 'preset',
    textureWidth: 927,
  },
];

/** Custom skin key used in Phaser's TextureManager. */
export const CUSTOM_SKIN_KEY = 'custom-skin';

/** Custom skin texture width (896px, 56 columns). */
export const CUSTOM_SKIN_TEXTURE_WIDTH = 896;

/** Mutable custom skin slot (set by custom-skin-loader). */
let customSkin: SkinDefinition | null = null;

/**
 * Register a custom skin definition.
 * Called by custom-skin-loader after loading from localStorage.
 */
export function registerCustomSkin(skin: SkinDefinition): void {
  customSkin = skin;
}

/**
 * Returns a copy of all registered preset character skins.
 */
export function getSkins(): SkinDefinition[] {
  return [...SKIN_REGISTRY];
}

/**
 * Returns the active skin: custom if registered, otherwise default preset.
 */
export function getActiveSkin(): SkinDefinition {
  return customSkin ?? SKIN_REGISTRY[0];
}

/**
 * Look up a skin definition by its key (e.g., 'scout_3' or 'custom-skin').
 * Returns undefined if no skin matches.
 */
export function getSkinByKey(key: string): SkinDefinition | undefined {
  if (customSkin && customSkin.key === key) return customSkin;
  return SKIN_REGISTRY.find((s) => s.key === key);
}
