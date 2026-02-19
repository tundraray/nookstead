'use client';

import { useState, useEffect, useCallback } from 'react';

const PAGE_SIZE = 20;

export type MapTypeFilter = 'player_homestead' | 'town_district' | 'template';

export interface EditorMapListItem {
  id: string;
  name: string;
  mapType: string;
  width: number;
  height: number;
  updatedAt: string;
}

export function useEditorMaps() {
  const [maps, setMaps] = useState<EditorMapListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [mapTypeFilter, setMapTypeFilter] = useState<MapTypeFilter | null>(
    null
  );

  const fetchMaps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', '0');
      if (mapTypeFilter) {
        params.set('mapType', mapTypeFilter);
      }
      const res = await fetch(`/api/editor-maps?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch maps');
      const data: EditorMapListItem[] = await res.json();
      setMaps(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [mapTypeFilter]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(maps.length));
      if (mapTypeFilter) {
        params.set('mapType', mapTypeFilter);
      }
      const res = await fetch(`/api/editor-maps?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch maps');
      const data: EditorMapListItem[] = await res.json();
      setMaps((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [maps.length, isLoadingMore, hasMore, mapTypeFilter]);

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  return {
    maps,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    mapTypeFilter,
    setMapTypeFilter,
    refetch: fetchMaps,
    loadMore,
  };
}
