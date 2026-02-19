'use client';

import { useState, useEffect, useCallback } from 'react';

const PAGE_SIZE = 20;

interface Sprite {
  id: string;
  name: string;
  s3Url: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export function useSprites() {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchSprites = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sprites?limit=${PAGE_SIZE}&offset=0`);
      if (!res.ok) throw new Error('Failed to fetch sprites');
      const data: Sprite[] = await res.json();
      setSprites(data);
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
        `/api/sprites?limit=${PAGE_SIZE}&offset=${sprites.length}`
      );
      if (!res.ok) throw new Error('Failed to fetch sprites');
      const data: Sprite[] = await res.json();
      setSprites((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [sprites.length, isLoadingMore, hasMore]);

  useEffect(() => {
    fetchSprites();
  }, [fetchSprites]);

  return {
    sprites,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refetch: fetchSprites,
    loadMore,
  };
}
