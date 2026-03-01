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
import { loadMaterialCacheFromData } from '../services/material-cache';
import { GameObjectCache } from '../services/game-object-cache';
import type { MaterialProperties } from '@nookstead/map-lib';
import type {
  GameObjectDefinition,
  SpriteMeta,
  AtlasFrameMeta,
} from '@nookstead/shared';

interface TilesetMeta {
  key: string;
  name: string;
  s3Url: string;
}

interface GameData {
  materials: MaterialProperties[];
  tilesets: TilesetMeta[];
  gameObjects: Record<string, GameObjectDefinition>;
  sprites: Record<string, SpriteMeta>;
  atlasFrames: Record<string, AtlasFrameMeta>;
}

async function fetchGameData(): Promise<GameData> {
  const res = await fetch('/api/game-data');
  if (!res.ok) {
    throw new Error(
      `[Preloader] Failed to fetch game data: ${res.status} ${res.statusText}`
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
    // Fetch combined game data (materials + tilesets + game objects with signed URLs)
    let tilesets: TilesetMeta[] = [];
    const objectCache = new GameObjectCache();
    try {
      const gameData = await fetchGameData();
      loadMaterialCacheFromData(gameData.materials);
      tilesets = gameData.tilesets;

      // Populate the game object cache from API response
      objectCache.populate({
        gameObjects: gameData.gameObjects,
        sprites: gameData.sprites,
        atlasFrames: gameData.atlasFrames,
      });
    } catch (err) {
      console.error('[Preloader] Failed to load game data:', err);
    }

    // Store the cache in Phaser's global registry for Game scene access
    this.game.registry.set('gameObjectCache', objectCache);

    // Collect object sprite IDs for loading
    const objectSpriteIds = objectCache.getAllSpriteIds();

    // Track which object sprites fail to load so we can skip their frames
    const failedSpriteIds = new Set<string>();
    this.load.on(
      'loaderror',
      (file: Phaser.Loader.File) => {
        const spriteId = objectSpriteIds.find((id) => id === file.key);
        if (spriteId) {
          console.warn(
            `[Preloader] Failed to load object sprite: ${spriteId}`
          );
          failedSpriteIds.add(spriteId);
        }
      }
    );

    // Queue tileset spritesheets from S3 presigned URLs
    const hasAssetsToLoad = tilesets.length > 0 || objectSpriteIds.length > 0;

    for (const tileset of tilesets) {
      this.load.spritesheet(tileset.key, tileset.s3Url, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
    }

    // Queue object sprite images from S3 presigned URLs
    for (const spriteId of objectSpriteIds) {
      const s3Url = objectCache.getSpriteUrl(spriteId);
      if (s3Url) {
        this.load.image(spriteId, s3Url);
      }
    }

    // Manually start the loader and wait for completion
    if (hasAssetsToLoad) {
      await new Promise<void>((resolve) => {
        this.load.once('complete', resolve);
        this.load.start();
      });
    }

    // Define named frame regions on each successfully loaded object sprite texture
    for (const spriteId of objectSpriteIds) {
      if (failedSpriteIds.has(spriteId)) continue;

      const texture = this.textures.get(spriteId);
      if (!texture || texture.key === '__MISSING') continue;

      // Add all atlas frames belonging to this sprite as named texture regions
      for (const frameId of objectCache.getFrameIdsForSprite(spriteId)) {
        const frame = objectCache.getFrameData(frameId);
        if (frame) {
          texture.add(
            frameId,
            0,
            frame.frameX,
            frame.frameY,
            frame.frameW,
            frame.frameH
          );
        }
      }
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
