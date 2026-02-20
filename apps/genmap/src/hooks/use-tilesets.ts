'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Tileset } from '@nookstead/db';

/** Tileset record as returned by the API, including tags. */
export type TilesetWithTags = Tileset & { tags: string[] };

export interface UseTilesetsOptions {
  search?: string;
  materialId?: string;
  tag?: string;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface UseTilesetsReturn {
  tilesets: TilesetWithTags[];
  isLoading: boolean;
  error: string | null;
  uploadTileset: (formData: FormData) => Promise<Tileset[]>;
  deleteTileset: (id: string) => Promise<void>;
  refresh: () => void;
}

function buildQueryString(options?: UseTilesetsOptions): string {
  if (!options) return '';
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.materialId) params.set('materialId', options.materialId);
  if (options.tag) params.set('tag', options.tag);
  if (options.sort) params.set('sort', options.sort);
  if (options.order) params.set('order', options.order);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useTilesets(options?: UseTilesetsOptions): UseTilesetsReturn {
  const [tilesets, setTilesets] = useState<TilesetWithTags[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize options for stable dependency tracking
  const serializedOptions = JSON.stringify(options ?? {});
  const optionsRef = useRef(serializedOptions);
  optionsRef.current = serializedOptions;

  const fetchTilesets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentOptions: UseTilesetsOptions = JSON.parse(optionsRef.current);
      const qs = buildQueryString(
        Object.keys(currentOptions).length > 0 ? currentOptions : undefined
      );
      const res = await fetch(`/api/tilesets${qs}`);
      if (!res.ok) throw new Error('Failed to fetch tilesets');
      const data: TilesetWithTags[] = await res.json();
      setTilesets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadTileset = useCallback(
    async (formData: FormData): Promise<Tileset[]> => {
      const res = await fetch('/api/tilesets', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      await fetchTilesets();
      return data.tilesets;
    },
    [fetchTilesets]
  );

  const deleteTileset = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(`/api/tilesets/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Delete failed');
      }
      await fetchTilesets();
    },
    [fetchTilesets]
  );

  useEffect(() => {
    fetchTilesets();
  }, [fetchTilesets, serializedOptions]);

  return {
    tilesets,
    isLoading,
    error,
    uploadTileset,
    deleteTileset,
    refresh: fetchTilesets,
  };
}
