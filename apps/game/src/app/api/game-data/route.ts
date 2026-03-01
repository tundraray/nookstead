import { NextResponse } from 'next/server';
import {
  getDb,
  listMaterials,
  listTilesets,
  listGameObjects,
  getSprite,
  getFramesBySprite,
} from '@nookstead/db';
import { generatePresignedGetUrl } from '@nookstead/s3';
import type {
  GameObjectDefinition,
  SpriteMeta,
  AtlasFrameMeta,
} from '@nookstead/shared';

export async function GET() {
  try {
    const db = getDb();
    const [rawMaterials, rawTilesets, rawGameObjects] = await Promise.all([
      listMaterials(db),
      listTilesets(db),
      listGameObjects(db),
    ]);

    const materials = rawMaterials.map((m) => ({
      key: m.key,
      walkable: m.walkable,
      speedModifier: m.speedModifier,
      swimRequired: m.swimRequired,
      damaging: m.damaging,
    }));

    const tilesets = await Promise.all(
      rawTilesets.map(async (t) => ({
        key: t.key,
        name: t.name,
        s3Url: await generatePresignedGetUrl(t.s3Key),
      }))
    );

    // Collect unique sprite IDs referenced by game object layers
    const spriteIds = new Set<string>();
    for (const obj of rawGameObjects) {
      const layers = obj.layers as { spriteId: string }[];
      for (const layer of layers) {
        spriteIds.add(layer.spriteId);
      }
    }

    // Resolve sprites and their frames in parallel
    const spriteEntries = await Promise.all(
      [...spriteIds].map(async (spriteId) => {
        const [sprite, frames] = await Promise.all([
          getSprite(db, spriteId),
          getFramesBySprite(db, spriteId),
        ]);
        return { spriteId, sprite, frames };
      })
    );

    // Build sprites map with presigned S3 URLs
    const sprites: Record<string, SpriteMeta> = {};
    for (const { spriteId, sprite } of spriteEntries) {
      if (sprite) {
        sprites[spriteId] = {
          id: sprite.id,
          name: sprite.name,
          s3Url: await generatePresignedGetUrl(sprite.s3Key),
        };
      }
    }

    // Build atlas frames map
    const atlasFrames: Record<string, AtlasFrameMeta> = {};
    for (const { frames } of spriteEntries) {
      for (const frame of frames) {
        atlasFrames[frame.id] = {
          id: frame.id,
          spriteId: frame.spriteId,
          frameX: frame.frameX,
          frameY: frame.frameY,
          frameW: frame.frameW,
          frameH: frame.frameH,
        };
      }
    }

    // Build game objects map
    const gameObjects: Record<string, GameObjectDefinition> = {};
    for (const obj of rawGameObjects) {
      gameObjects[obj.id] = {
        id: obj.id,
        name: obj.name,
        layers: obj.layers as GameObjectDefinition['layers'],
        collisionZones:
          (obj.collisionZones as GameObjectDefinition['collisionZones']) ?? [],
      };
    }

    return NextResponse.json({
      materials,
      tilesets,
      gameObjects,
      sprites,
      atlasFrames,
    });
  } catch (err) {
    console.error('[GameDataAPI] Failed to build game data:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
