'use client';

import { useState, useEffect, useCallback } from 'react';

const PAGE_SIZE = 20;

interface GameObjectLayer {
  frameId: string;
  spriteId: string;
  xOffset: number;
  yOffset: number;
  layerOrder: number;
}

interface GameObject {
  id: string;
  name: string;
  description: string | null;
  layers: GameObjectLayer[];
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export function useGameObjects() {
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchObjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/objects?limit=${PAGE_SIZE}&offset=0`);
      if (!res.ok) throw new Error('Failed to fetch objects');
      const data: GameObject[] = await res.json();
      setObjects(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/objects?limit=${PAGE_SIZE}&offset=${objects.length}`
      );
      if (!res.ok) throw new Error('Failed to fetch objects');
      const data: GameObject[] = await res.json();
      setObjects((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [objects.length, isLoadingMore, hasMore]);

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  return {
    objects,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refetch: fetchObjects,
    loadMore,
  };
}
