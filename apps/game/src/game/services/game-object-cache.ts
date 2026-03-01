import type {
  GameObjectDefinition,
  SpriteMeta,
  AtlasFrameMeta,
} from '@nookstead/shared';

export type { GameObjectDefinition, SpriteMeta, AtlasFrameMeta };

interface GameObjectCacheData {
  gameObjects: Record<string, GameObjectDefinition>;
  sprites: Record<string, SpriteMeta>;
  atlasFrames: Record<string, AtlasFrameMeta>;
}

/**
 * Client-side cache for game object definitions, sprite metadata,
 * and atlas frame data fetched from the game-data API.
 *
 * Populated once by Preloader after fetching /api/game-data,
 * then consumed by ObjectRenderer during the Game scene.
 */
export class GameObjectCache {
  private gameObjects = new Map<string, GameObjectDefinition>();
  private sprites = new Map<string, SpriteMeta>();
  private atlasFrames = new Map<string, AtlasFrameMeta>();

  /**
   * Populate the cache from the game-data API response.
   * Overwrites any previously stored data.
   */
  populate(data: GameObjectCacheData): void {
    this.gameObjects = new Map(Object.entries(data.gameObjects));
    this.sprites = new Map(Object.entries(data.sprites));
    this.atlasFrames = new Map(Object.entries(data.atlasFrames));
    console.log(
      `[GameObjectCache] Loaded ${this.gameObjects.size} objects, ` +
        `${this.sprites.size} sprites, ${this.atlasFrames.size} frames`
    );
  }

  /** Look up a game object definition by its ID. */
  getObjectDefinition(objectId: string): GameObjectDefinition | undefined {
    return this.gameObjects.get(objectId);
  }

  /** Get the presigned S3 URL for a sprite by its ID. */
  getSpriteUrl(spriteId: string): string | undefined {
    return this.sprites.get(spriteId)?.s3Url;
  }

  /** Get atlas frame metadata (position and dimensions) by frame ID. */
  getFrameData(frameId: string): AtlasFrameMeta | undefined {
    return this.atlasFrames.get(frameId);
  }

  /** Get all unique sprite IDs stored in the cache (for Preloader asset loading). */
  getAllSpriteIds(): string[] {
    return [...this.sprites.keys()];
  }

  /** Get all frame IDs that belong to a given sprite (for defining texture frame regions). */
  getFrameIdsForSprite(spriteId: string): string[] {
    const frameIds: string[] = [];
    for (const [frameId, frame] of this.atlasFrames) {
      if (frame.spriteId === spriteId) {
        frameIds.push(frameId);
      }
    }
    return frameIds;
  }
}
