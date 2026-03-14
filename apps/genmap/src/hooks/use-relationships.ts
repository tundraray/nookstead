'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const PAGE_SIZE = 20;

// Serialized relationship row (dates as ISO strings from API)
export interface RelationshipRow {
  id: string;
  botId: string;
  userId: string;
  socialType: string;
  isWorker: boolean;
  score: number;
  hiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useRelationships(botId: string | null) {
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const botIdRef = useRef(botId);
  botIdRef.current = botId;

  const fetchRelationships = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/npcs/${id}/relationships?limit=${PAGE_SIZE}&offset=0`
      );
      if (!res.ok) throw new Error('Failed to fetch relationships');
      const data: RelationshipRow[] = await res.json();
      setRelationships(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !botIdRef.current) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/npcs/${botIdRef.current}/relationships?limit=${PAGE_SIZE}&offset=${relationships.length}`
      );
      if (!res.ok) throw new Error('Failed to fetch relationships');
      const data: RelationshipRow[] = await res.json();
      setRelationships((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [relationships.length, isLoadingMore, hasMore]);

  useEffect(() => {
    if (!botId) {
      setRelationships([]);
      return;
    }
    fetchRelationships(botId);
  }, [botId, fetchRelationships]);

  return {
    relationships,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
  };
}
