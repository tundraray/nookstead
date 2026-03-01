import type { Scene } from 'phaser';
import type { GeneratedMap } from '@nookstead/map-lib';
import { EMPTY_FRAME } from '@nookstead/map-lib';
import type { MapRendererConfig } from './types';
import { DEFAULT_CONFIG } from './types';

/**
 * Renders GeneratedMap data using Phaser's RenderTexture stamp pattern.
 * Shared between the main game and the map editor for consistent output.
 */
export class MapRenderer {
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private readonly config: MapRendererConfig;

  constructor(
    private readonly scene: Scene,
    config?: Partial<MapRendererConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Render all layers of a GeneratedMap into a RenderTexture.
   * Returns the RenderTexture for further composition.
   */
  render(map: GeneratedMap): Phaser.GameObjects.RenderTexture {
    const { tileSize, frameSize } = this.config;
    const mapPixelW = map.width * tileSize;
    const mapPixelH = map.height * tileSize;
    const tileScale = tileSize / frameSize;

    this.rt = this.scene.add.renderTexture(0, 0, mapPixelW, mapPixelH);
    this.rt.setOrigin(0, 0);

    const stamp = this.scene.add
      .sprite(0, 0, '')
      .setScale(tileScale)
      .setOrigin(0, 0)
      .setVisible(false);

    for (const layerData of map.layers) {
      if (!layerData.frames) continue;
      const rowCount = Math.min(map.height, layerData.frames.length);
      for (let y = 0; y < rowCount; y++) {
        const row = layerData.frames[y];
        if (!row) continue;
        const colCount = Math.min(map.width, row.length);
        for (let x = 0; x < colCount; x++) {
          const frame = row[x];
          if (frame === EMPTY_FRAME) continue;

          const textureKey = layerData.tilesetKeys?.[y]?.[x] || layerData.terrainKey;
          if (!this.scene.textures.exists(textureKey)) continue;
          stamp.setTexture(textureKey, frame);
          this.rt.draw(stamp, x * tileSize, y * tileSize);
        }
      }
    }

    stamp.destroy();
    return this.rt;
  }

  /** Clean up resources. */
  destroy(): void {
    if (this.rt) {
      this.rt.destroy();
      this.rt = null;
    }
  }
}
