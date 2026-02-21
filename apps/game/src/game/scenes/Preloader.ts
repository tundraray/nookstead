import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { registerAnimations } from '../characters/animations';
import { getSkins, getSkinByKey } from '../characters/skin-registry';
import {
  hasCustomSkin,
  getPresetSkinKey,
  loadCustomSkinTexture,
} from '../characters/custom-skin-loader';
import { CHARACTER_FRAME_HEIGHT, FRAME_SIZE, TILE_SIZE } from '../constants';
import { loadMaterialCache } from '../services/material-cache';

interface TilesetMeta {
  key: string;
  name: string;
  s3Url: string;
}

async function fetchTilesetMetadata(): Promise<TilesetMeta[]> {
  const res = await fetch('/api/tilesets');
  if (!res.ok) {
    throw new Error(
      `[Preloader] Failed to fetch tileset metadata: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

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

    // Load all preset character spritesheets (local assets)
    for (const skin of getSkins()) {
      this.load.spritesheet(skin.sheetKey, skin.sheetPath, {
        frameWidth: TILE_SIZE,
        frameHeight: CHARACTER_FRAME_HEIGHT,
      });
    }
  }

  async create() {
    // Fetch tileset metadata from API and pre-load material cache in parallel
    let tilesets: TilesetMeta[] = [];
    try {
      const [fetchedTilesets] = await Promise.all([
        fetchTilesetMetadata(),
        loadMaterialCache(),
      ]);
      tilesets = fetchedTilesets;
    } catch (err) {
      console.error('[Preloader] Failed to load tileset metadata:', err);
    }

    // Queue tileset spritesheets from S3 presigned URLs
    if (tilesets.length > 0) {
      for (const tileset of tilesets) {
        this.load.spritesheet(tileset.key, tileset.s3Url, {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE,
        });
      }

      // Manually start the loader and wait for completion
      await new Promise<void>((resolve) => {
        this.load.once('complete', resolve);
        this.load.start();
      });
    }

    // Register animations for all preset skins
    for (const skin of getSkins()) {
      const texture = this.textures.get(skin.sheetKey);
      const source = texture.getSourceImage() as HTMLImageElement;
      registerAnimations(this, skin.sheetKey, source.width, TILE_SIZE);
    }

    // Load custom skin from localStorage if present
    if (hasCustomSkin()) {
      const customSkin = await loadCustomSkinTexture(this);
      if (customSkin) {
        registerAnimations(
          this,
          customSkin.sheetKey,
          customSkin.textureWidth,
          TILE_SIZE
        );
      }
    }

    // Check if a preset skin is selected in localStorage
    const presetKey = getPresetSkinKey();
    if (presetKey) {
      const skin = getSkinByKey(presetKey);
      if (skin) {
        console.info(`Preset skin selected: ${presetKey}`);
      }
    }

    EventBus.emit('preload-complete');
    this.scene.start('Loading');
  }
}
