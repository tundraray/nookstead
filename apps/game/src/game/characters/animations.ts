/**
 * Animation registration module for character sprite sheets.
 *
 * Bridges the pure-data frame-map module with the Phaser AnimationManager.
 * Derives columns-per-row at runtime from the actual loaded texture
 * dimensions (per ADR-004) to prevent silent breakage if the sprite
 * sheet changes.
 *
 * Must be called after the sprite sheet texture is fully loaded.
 */

import { getAnimationDefs, computeColumnsPerRow } from './frame-map';

/**
 * Register all 27 character animations in the Phaser AnimationManager.
 *
 * Computes the columns-per-row value at runtime from the provided texture
 * dimensions, then iterates over all animation definitions from the
 * frame-map module and registers each one with `scene.anims.create`.
 *
 * @param scene - The Phaser scene whose AnimationManager receives the animations
 * @param sheetKey - Sprite sheet texture key (e.g. 'char-scout')
 * @param textureWidth - Actual width of the loaded texture in pixels
 * @param frameWidth - Width of a single frame in pixels
 */
export function registerAnimations(
  scene: Phaser.Scene,
  sheetKey: string,
  textureWidth: number,
  frameWidth: number
): void {
  const colsPerRow = computeColumnsPerRow(textureWidth, frameWidth);
  console.info(
    `Registering animations for ${sheetKey}: ${colsPerRow} columns per row`
  );

  const defs = getAnimationDefs('scout', sheetKey);

  for (const def of defs) {
    scene.anims.create({
      key: def.key,
      frames: scene.anims.generateFrameNumbers(sheetKey, {
        frames: def.frames,
      }),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  }
}
