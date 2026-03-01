import {
  GameObjectCache,
} from '../../src/game/services/game-object-cache';
import type {
  GameObjectDefinition,
  SpriteMeta,
  AtlasFrameMeta,
} from '@nookstead/shared';

describe('GameObjectCache', () => {
  let cache: GameObjectCache;

  const mockGameObjects: Record<string, GameObjectDefinition> = {
    'obj-1': {
      id: 'obj-1',
      name: 'Oak Tree',
      layers: [
        {
          frameId: 'frame-1',
          spriteId: 'sprite-1',
          xOffset: 0,
          yOffset: -16,
          layerOrder: 0,
        },
        {
          frameId: 'frame-2',
          spriteId: 'sprite-1',
          xOffset: 0,
          yOffset: 0,
          layerOrder: 1,
        },
      ],
      collisionZones: [
        {
          id: 'zone-1',
          label: 'trunk',
          type: 'collision',
          shape: 'rectangle',
          x: 4,
          y: 12,
          width: 8,
          height: 4,
        },
      ],
    },
    'obj-2': {
      id: 'obj-2',
      name: 'Fence',
      layers: [
        {
          frameId: 'frame-3',
          spriteId: 'sprite-2',
          xOffset: 0,
          yOffset: 0,
          layerOrder: 0,
        },
      ],
      collisionZones: [],
    },
  };

  const mockSprites: Record<string, SpriteMeta> = {
    'sprite-1': {
      id: 'sprite-1',
      name: 'Trees Sheet',
      s3Url: 'https://s3.example.com/trees.png?signed=abc',
    },
    'sprite-2': {
      id: 'sprite-2',
      name: 'Fences Sheet',
      s3Url: 'https://s3.example.com/fences.png?signed=def',
    },
  };

  const mockAtlasFrames: Record<string, AtlasFrameMeta> = {
    'frame-1': {
      id: 'frame-1',
      spriteId: 'sprite-1',
      frameX: 0,
      frameY: 0,
      frameW: 16,
      frameH: 32,
    },
    'frame-2': {
      id: 'frame-2',
      spriteId: 'sprite-1',
      frameX: 16,
      frameY: 0,
      frameW: 16,
      frameH: 16,
    },
    'frame-3': {
      id: 'frame-3',
      spriteId: 'sprite-2',
      frameX: 0,
      frameY: 0,
      frameW: 16,
      frameH: 16,
    },
  };

  beforeEach(() => {
    cache = new GameObjectCache();
  });

  describe('populate()', () => {
    it('should store all game objects, sprites, and atlas frames', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      expect(cache.getObjectDefinition('obj-1')).toEqual(mockGameObjects['obj-1']);
      expect(cache.getObjectDefinition('obj-2')).toEqual(mockGameObjects['obj-2']);
      expect(cache.getSpriteUrl('sprite-1')).toBe(mockSprites['sprite-1'].s3Url);
      expect(cache.getSpriteUrl('sprite-2')).toBe(mockSprites['sprite-2'].s3Url);
      expect(cache.getFrameData('frame-1')).toEqual(mockAtlasFrames['frame-1']);
    });
  });

  describe('getObjectDefinition()', () => {
    it('should return the correct definition for a known objectId', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      const def = cache.getObjectDefinition('obj-1');
      expect(def).toEqual(
        expect.objectContaining({
          id: 'obj-1',
          name: 'Oak Tree',
        })
      );
      expect(def?.layers).toHaveLength(2);
      expect(def?.collisionZones).toHaveLength(1);
    });

    it('should return undefined for an unknown objectId', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      expect(cache.getObjectDefinition('nonexistent')).toBeUndefined();
    });

    it('should return undefined when cache is not populated', () => {
      expect(cache.getObjectDefinition('obj-1')).toBeUndefined();
    });
  });

  describe('getSpriteUrl()', () => {
    it('should return the correct S3 URL for a known spriteId', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      expect(cache.getSpriteUrl('sprite-1')).toBe(
        'https://s3.example.com/trees.png?signed=abc'
      );
    });

    it('should return undefined for an unknown spriteId', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      expect(cache.getSpriteUrl('nonexistent')).toBeUndefined();
    });
  });

  describe('getFrameData()', () => {
    it('should return the correct frame data for a known frameId', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      const frame = cache.getFrameData('frame-1');
      expect(frame).toEqual(
        expect.objectContaining({
          spriteId: 'sprite-1',
          frameX: 0,
          frameY: 0,
          frameW: 16,
          frameH: 32,
        })
      );
    });

    it('should return undefined for an unknown frameId', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      expect(cache.getFrameData('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllSpriteIds()', () => {
    it('should return all unique sprite IDs', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      const spriteIds = cache.getAllSpriteIds();
      expect(spriteIds).toHaveLength(2);
      expect(spriteIds).toContain('sprite-1');
      expect(spriteIds).toContain('sprite-2');
    });

    it('should return an empty array when cache is not populated', () => {
      expect(cache.getAllSpriteIds()).toEqual([]);
    });
  });

  describe('getFrameIdsForSprite()', () => {
    it('should return frame IDs belonging to the given sprite', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      const frameIds = cache.getFrameIdsForSprite('sprite-1');
      expect(frameIds).toHaveLength(2);
      expect(frameIds).toContain('frame-1');
      expect(frameIds).toContain('frame-2');
    });

    it('should return only frames for the specified sprite', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      const frameIds = cache.getFrameIdsForSprite('sprite-2');
      expect(frameIds).toHaveLength(1);
      expect(frameIds).toContain('frame-3');
    });

    it('should return an empty array for an unknown sprite', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      expect(cache.getFrameIdsForSprite('nonexistent')).toEqual([]);
    });

    it('should return an empty array when cache is not populated', () => {
      expect(cache.getFrameIdsForSprite('sprite-1')).toEqual([]);
    });
  });

  describe('populate() overwrites previous data', () => {
    it('should replace old data when populate is called again', () => {
      cache.populate({
        gameObjects: mockGameObjects,
        sprites: mockSprites,
        atlasFrames: mockAtlasFrames,
      });

      expect(cache.getObjectDefinition('obj-1')).toBeDefined();

      // Repopulate with different data
      cache.populate({
        gameObjects: {
          'obj-3': {
            id: 'obj-3',
            name: 'Rock',
            layers: [],
            collisionZones: [],
          },
        },
        sprites: {},
        atlasFrames: {},
      });

      expect(cache.getObjectDefinition('obj-1')).toBeUndefined();
      expect(cache.getObjectDefinition('obj-3')).toBeDefined();
      expect(cache.getAllSpriteIds()).toEqual([]);
    });
  });
});
