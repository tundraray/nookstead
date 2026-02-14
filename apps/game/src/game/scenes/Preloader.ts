import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { TILE_SIZE } from '../constants';
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
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
      });
    }

    this.load.spritesheet('ui-elements', 'ui/hud.png', {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
  }

  create() {
    EventBus.emit('preload-complete');
    this.scene.start('Game');
  }
}
