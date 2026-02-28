/**
 * Custom skin loader for Phaser integration.
 *
 * Reads the pre-baked spritesheet data URL and recipe from localStorage,
 * registers it as a Phaser spritesheet texture, and creates a SkinDefinition
 * for use by the skin registry and animation system.
 */

import type { SkinDefinition } from './skin-registry';
import {
  CUSTOM_SKIN_KEY,
  CUSTOM_SKIN_TEXTURE_WIDTH,
  registerCustomSkin,
} from './skin-registry';
import { SKIN_RECIPE_KEY, SKIN_SHEET_KEY } from '@/components/character-generator/types';

interface StoredRecipe {
  type: 'custom' | 'preset';
  skin?: string;
}

/**
 * Check if a custom skin exists in localStorage.
 */
export function hasCustomSkin(): boolean {
  try {
    const recipe = localStorage.getItem(SKIN_RECIPE_KEY);
    if (!recipe) return false;
    const parsed: StoredRecipe = JSON.parse(recipe);
    return parsed.type === 'custom';
  } catch {
    return false;
  }
}

/**
 * Check if a preset skin is selected in localStorage.
 * Returns the preset skin key, or null.
 */
export function getPresetSkinKey(): string | null {
  try {
    const recipe = localStorage.getItem(SKIN_RECIPE_KEY);
    if (!recipe) return null;
    const parsed: StoredRecipe = JSON.parse(recipe);
    if (parsed.type === 'preset' && parsed.skin) return parsed.skin;
    return null;
  } catch {
    return null;
  }
}

/**
 * Load a custom skin from localStorage into Phaser's TextureManager.
 *
 * Creates an Image element from the stored data URL, waits for it to load,
 * then registers it as a spritesheet texture with 16x32 frame dimensions.
 *
 * @returns SkinDefinition for the loaded custom skin, or null on failure
 */
export async function loadCustomSkinTexture(
  scene: Phaser.Scene
): Promise<SkinDefinition | null> {
  try {
    const dataUrl = localStorage.getItem(SKIN_SHEET_KEY);
    if (!dataUrl) {
      console.warn('Custom skin sheet not found in localStorage');
      return null;
    }

    if (!dataUrl.startsWith('data:image/png;base64,')) {
      console.warn('Invalid custom skin data URL format');
      localStorage.removeItem(SKIN_SHEET_KEY);
      localStorage.removeItem(SKIN_RECIPE_KEY);
      return null;
    }

    // Remove existing custom skin texture if present
    if (scene.textures.exists(CUSTOM_SKIN_KEY)) {
      scene.textures.remove(CUSTOM_SKIN_KEY);
    }

    // Load the data URL as an image
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load custom skin image'));
      image.src = dataUrl;
    });

    // Register as a Phaser spritesheet
    scene.textures.addSpriteSheet(CUSTOM_SKIN_KEY, img, {
      frameWidth: 16,
      frameHeight: 32,
    });

    const skinDef: SkinDefinition = {
      key: CUSTOM_SKIN_KEY,
      sheetPath: '',
      sheetKey: CUSTOM_SKIN_KEY,
      type: 'custom',
      textureWidth: CUSTOM_SKIN_TEXTURE_WIDTH,
    };

    registerCustomSkin(skinDef);
    console.info('Custom skin loaded and registered');
    return skinDef;
  } catch (error) {
    console.error('Failed to load custom skin:', error);
    return null;
  }
}
