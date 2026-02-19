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
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const frame = layerData.frames[y][x];
          if (frame === EMPTY_FRAME) continue;

          stamp.setTexture(layerData.terrainKey, frame);
          this.rt.draw(stamp, x * tileSize, y * tileSize);
        }
      }
    }

    stamp.destroy();
    return this.rt;
  }

  /**
   * Re-render a 3x3 area around a changed cell for live editing.
   * Recomputes autotile frames for the cell and its 8 neighbors.
   */
  updateCell(
    map: GeneratedMap,
    x: number,
    y: number,
    _newTerrain: string,
  ): void {
    if (!this.rt) return;

    const { tileSize, frameSize } = this.config;
    const tileScale = tileSize / frameSize;

    const stamp = this.scene.add
      .sprite(0, 0, '')
      .setScale(tileScale)
      .setOrigin(0, 0)
      .setVisible(false);

    // Clear and redraw the 3x3 neighborhood
    const minX = Math.max(0, x - 1);
    const maxX = Math.min(map.width - 1, x + 1);
    const minY = Math.max(0, y - 1);
    const maxY = Math.min(map.height - 1, y + 1);

    // Erase the 3x3 area
    this.rt.erase(
      this.scene.add
        .rectangle(
          minX * tileSize,
          minY * tileSize,
          (maxX - minX + 1) * tileSize,
          (maxY - minY + 1) * tileSize,
          0xffffff,
        )
        .setOrigin(0, 0),
    );

    // Redraw all layers for the 3x3 area
    for (const layerData of map.layers) {
      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          const frame = layerData.frames[cy][cx];
          if (frame === EMPTY_FRAME) continue;

          stamp.setTexture(layerData.terrainKey, frame);
          this.rt.draw(stamp, cx * tileSize, cy * tileSize);
        }
      }
    }

    stamp.destroy();
  }

  /** Clean up resources. */
  destroy(): void {
    if (this.rt) {
      this.rt.destroy();
      this.rt = null;
    }
  }
}
