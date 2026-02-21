'use client';

import { useState, useEffect } from 'react';

export interface TilesetImagesResult {
  images: Map<string, HTMLImageElement>;
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
}

/** Shape of a tileset record returned by GET /api/tilesets. */
interface TilesetApiRecord {
  key: string;
  s3Url: string;
}

/**
 * Loads tileset images from the API using presigned S3 URLs.
 *
 * Fetches the tileset list from GET /api/tilesets, then loads each tileset's
 * image via its presigned S3 URL. Returns a Map<string, HTMLImageElement>
 * keyed by tileset.key (e.g., 'terrain-01'), maintaining full backward
 * compatibility with canvas-renderer.ts which uses tilesetImages.get(layer.terrainKey).
 *
 * Presigned URLs expire after ~1 hour. For the development workflow (internal tool),
 * refreshing the page will fetch new presigned URLs.
 */
export function useTilesetImages(): TilesetImagesResult {
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(
    () => new Map()
  );
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      try {
        const res = await fetch('/api/tilesets');
        if (!res.ok) {
          console.warn(
            `[TilesetImages] Failed to fetch tilesets: ${res.status}`
          );
          if (!cancelled) setIsLoading(false);
          return;
        }

        const tilesets: TilesetApiRecord[] = await res.json();
        if (cancelled) return;

        const total = tilesets.length;
        setTotalCount(total);

        if (total === 0) {
          setIsLoading(false);
          return;
        }

        let loaded = 0;
        const imageMap = new Map<string, HTMLImageElement>();

        function checkComplete() {
          loaded++;
          if (!cancelled) {
            setLoadedCount(loaded);
            if (loaded >= total) {
              setImages(new Map(imageMap));
              setIsLoading(false);
            }
          }
        }

        for (const tileset of tilesets) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = tileset.s3Url;
          img.onload = () => {
            if (!cancelled) {
              imageMap.set(tileset.key, img);
            }
            checkComplete();
          };
          img.onerror = () => {
            console.warn(
              `[TilesetImages] Failed to load tileset: ${tileset.key}`
            );
            checkComplete();
          };
        }
      } catch (err) {
        console.warn('[TilesetImages] Error loading tileset images:', err);
        if (!cancelled) setIsLoading(false);
      }
    }

    loadImages();

    return () => {
      cancelled = true;
    };
  }, []);

  return { images, isLoading, loadedCount, totalCount };
}
