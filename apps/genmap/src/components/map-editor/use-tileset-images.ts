'use client';

import { useState, useEffect } from 'react';

export interface TilesetImagesResult {
  images: Map<string, HTMLImageElement>;
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
}

/**
 * Loads tileset images from presigned S3 URLs.
 *
 * Accepts a list of tilesets with keys and signed URLs, then loads each image.
 * Returns a Map<string, HTMLImageElement> keyed by tileset.key (e.g., 'terrain-01').
 *
 * When `tilesets` is null/undefined, the hook stays in loading state (waiting for data).
 */
export function useTilesetImages(
  tilesets: { key: string; s3Url: string }[] | null | undefined,
): TilesetImagesResult {
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(
    () => new Map()
  );
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tilesets) return;

    let cancelled = false;

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

    return () => {
      cancelled = true;
    };
  }, [tilesets]);

  return { images, isLoading, loadedCount, totalCount };
}
