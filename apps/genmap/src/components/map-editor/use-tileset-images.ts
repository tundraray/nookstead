'use client';

import { useState, useEffect } from 'react';

const TOTAL_TILESETS = 26;

/**
 * Build terrain key strings: 'terrain-01' through 'terrain-26'.
 */
function buildTerrainKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= TOTAL_TILESETS; i++) {
    keys.push(`terrain-${String(i).padStart(2, '0')}`);
  }
  return keys;
}

const TERRAIN_KEYS = buildTerrainKeys();

export interface TilesetImagesResult {
  images: Map<string, HTMLImageElement>;
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
}

/**
 * Preloads all 26 tileset PNG images from /tilesets/terrain-01.png through terrain-26.png.
 * Returns a map from terrain key to loaded HTMLImageElement and loading progress.
 * Missing images are handled gracefully (logged as warnings, not blocking).
 */
export function useTilesetImages(): TilesetImagesResult {
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(
    () => new Map()
  );
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let loaded = 0;
    const imageMap = new Map<string, HTMLImageElement>();

    function checkComplete() {
      loaded++;
      if (!cancelled) {
        setLoadedCount(loaded);
        if (loaded >= TOTAL_TILESETS) {
          setImages(new Map(imageMap));
          setIsLoading(false);
        }
      }
    }

    for (const key of TERRAIN_KEYS) {
      const img = new Image();
      img.src = `/tilesets/${key}.png`;
      img.onload = () => {
        if (!cancelled) {
          imageMap.set(key, img);
        }
        checkComplete();
      };
      img.onerror = () => {
        console.warn(`Failed to load tileset image: /tilesets/${key}.png`);
        checkComplete();
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { images, isLoading, loadedCount, totalCount: TOTAL_TILESETS };
}
