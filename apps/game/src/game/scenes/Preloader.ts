import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { registerAnimations } from '../characters/animations';
import { getSkins } from '../characters/skin-registry';
import { CHARACTER_FRAME_HEIGHT, FRAME_SIZE, TILE_SIZE } from '../constants';
import { TERRAINS } from '../terrain';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  init() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, 468, 32).setStrokeStyle(1, 0xffffff);

    const bar = this.add.rectangle(cx - 230, cy, 4, 28, 0xffffff);

    this.load.on('progress', (progress: number) => {
      bar.width = 4 + 460 * progress;
    });
  }

  preload() {
    this.load.setPath('assets');

    for (const terrain of TERRAINS) {
      this.load.spritesheet(terrain.key, `tilesets/${terrain.file}`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
    }

    // Load character spritesheets
    for (const skin of getSkins()) {
      this.load.spritesheet(skin.sheetKey, skin.sheetPath, {
        frameWidth: TILE_SIZE,
        frameHeight: CHARACTER_FRAME_HEIGHT,
      });
    }
  }

  create() {
    // Register character animations
    for (const skin of getSkins()) {
      const texture = this.textures.get(skin.sheetKey);
      const source = texture.getSourceImage() as HTMLImageElement;
      registerAnimations(this, skin.sheetKey, source.width, TILE_SIZE);
    }

    EventBus.emit('preload-complete');
    this.scene.start('Game');
  }
}
