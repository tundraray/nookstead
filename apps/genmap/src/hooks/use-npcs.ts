'use client';

import { useState, useEffect, useCallback } from 'react';

const PAGE_SIZE = 20;

export interface Npc {
  id: string;
  mapId: string;
  name: string;
  skin: string;
  worldX: number;
  worldY: number;
  direction: string;
  personality: string | null;
  role: string | null;
  speechStyle: string | null;
  bio: string | null;
  age: number | null;
  traits: string[] | null;
  goals: string[] | null;
  fears: string[] | null;
  interests: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export function useNpcs() {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchNpcs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/npcs?limit=${PAGE_SIZE}&offset=0`);
      if (!res.ok) throw new Error('Failed to fetch NPCs');
      const data: Npc[] = await res.json();
      setNpcs(data);
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
        `/api/npcs?limit=${PAGE_SIZE}&offset=${npcs.length}`
      );
      if (!res.ok) throw new Error('Failed to fetch NPCs');
      const data: Npc[] = await res.json();
      setNpcs((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [npcs.length, isLoadingMore, hasMore]);

  useEffect(() => {
    fetchNpcs();
  }, [fetchNpcs]);

  return {
    npcs,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch: fetchNpcs,
  };
}
