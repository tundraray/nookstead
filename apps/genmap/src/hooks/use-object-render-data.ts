'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  ObjectRenderEntry,
  ObjectRenderLayer,
} from '@/components/map-editor/canvas-renderer';

/**
 * Minimal shape of a game object layer returned by the API.
 * Only the fields needed for sprite/frame lookup are included.
 */
interface GameObjectLayer {
  frameId: string;
  spriteId: string;
  xOffset: number;
  yOffset: number;
  layerOrder: number;
}

/** Minimal shape of a game object returned by GET /api/objects/:id. */
interface GameObjectResponse {
  id: string;
  layers: GameObjectLayer[];
}

/** Sprite info returned by GET /api/sprites/:id (with signed s3Url). */
interface SpriteInfo {
  id: string;
  s3Url: string;
}

/** Atlas frame returned by GET /api/sprites/:id/frames. */
interface AtlasFrame {
  id: string;
  spriteId: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
}

/**
 * Loads sprite images and frame data for ALL layers of each game object.
 *
 * For each object ID, fetches the game object definition, then for every
 * layer fetches sprite metadata and frame data. Multiple layers sharing
 * the same spriteId reuse a single image load.
 *
 * @param objectIds - Unique game object IDs to load render data for.
 * @returns Map from objectId to ObjectRenderEntry with all layers.
 */
export function useObjectRenderData(
  objectIds: string[],
): Map<string, ObjectRenderEntry> {
  const [renderData, setRenderData] = useState<Map<string, ObjectRenderEntry>>(
    () => new Map(),
  );
  const cache = useRef<Map<string, ObjectRenderEntry>>(new Map());

  useEffect(() => {
    if (objectIds.length === 0) return;

    let cancelled = false;

    async function loadAll() {
      const newEntries = new Map<string, ObjectRenderEntry>(cache.current);
      const toLoad = objectIds.filter((id) => !cache.current.has(id));

      if (toLoad.length === 0) {
        setRenderData(new Map(newEntries));
        return;
      }

      // Shared caches for sprite images and frame lists (avoid duplicate fetches)
      const spriteImageCache = new Map<string, HTMLImageElement>();
      const spriteFrameCache = new Map<string, AtlasFrame[]>();

      async function loadSpriteImage(spriteId: string): Promise<HTMLImageElement | null> {
        if (spriteImageCache.has(spriteId)) return spriteImageCache.get(spriteId)!;

        try {
          const res = await fetch(`/api/sprites/${spriteId}`);
          if (!res.ok) return null;
          const sprite: SpriteInfo = await res.json();

          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = sprite.s3Url;
          });

          spriteImageCache.set(spriteId, image);
          return image;
        } catch {
          return null;
        }
      }

      async function loadSpriteFrames(spriteId: string): Promise<AtlasFrame[]> {
        if (spriteFrameCache.has(spriteId)) return spriteFrameCache.get(spriteId)!;

        try {
          const res = await fetch(`/api/sprites/${spriteId}/frames`);
          if (!res.ok) return [];
          const frames: AtlasFrame[] = await res.json();
          spriteFrameCache.set(spriteId, frames);
          return frames;
        } catch {
          return [];
        }
      }

      await Promise.all(
        toLoad.map(async (objectId) => {
          try {
            const objRes = await fetch(`/api/objects/${objectId}`);
            if (!objRes.ok) return;
            const obj: GameObjectResponse = await objRes.json();

            if (obj.layers.length === 0) return;

            // Sort by layerOrder (lowest rendered first)
            const sorted = [...obj.layers].sort(
              (a, b) => a.layerOrder - b.layerOrder,
            );

            // Collect unique spriteIds and prefetch in parallel
            const uniqueSpriteIds = [...new Set(sorted.map((l) => l.spriteId))];
            await Promise.all(
              uniqueSpriteIds.map(async (sid) => {
                await Promise.all([loadSpriteImage(sid), loadSpriteFrames(sid)]);
              }),
            );

            // Build render layers
            const renderLayers: ObjectRenderLayer[] = [];
            for (const layer of sorted) {
              const image = spriteImageCache.get(layer.spriteId);
              const frames = spriteFrameCache.get(layer.spriteId);
              if (!image || !frames) continue;

              const frame = frames.find((f) => f.id === layer.frameId);
              if (!frame) continue;

              renderLayers.push({
                image,
                frameX: frame.frameX,
                frameY: frame.frameY,
                frameW: frame.frameW,
                frameH: frame.frameH,
                xOffset: layer.xOffset,
                yOffset: layer.yOffset,
              });
            }

            if (renderLayers.length > 0) {
              newEntries.set(objectId, { layers: renderLayers });
            }
          } catch {
            // Silently skip failed objects
          }
        }),
      );

      if (!cancelled) {
        cache.current = newEntries;
        setRenderData(new Map(newEntries));
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [[...objectIds].sort().join(',')]);

  return renderData;
}
