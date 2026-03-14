'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { NpcMemory, NpcMemoryOverride } from '@nookstead/shared';

const PAGE_SIZE = 20;

export function useNpcMemories(botId: string | null) {
  const [memories, setMemories] = useState<NpcMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [override, setOverride] = useState<NpcMemoryOverride | null>(null);
  const [isLoadingOverride, setIsLoadingOverride] = useState(false);

  const botIdRef = useRef(botId);
  botIdRef.current = botId;

  const fetchMemories = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/npcs/${id}/memories?limit=${PAGE_SIZE}&offset=0`
      );
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data: NpcMemory[] = await res.json();
      setMemories(data);
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
        `/api/npcs/${botIdRef.current}/memories?limit=${PAGE_SIZE}&offset=${memories.length}`
      );
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data: NpcMemory[] = await res.json();
      setMemories((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [memories.length, isLoadingMore, hasMore]);

  const deleteMemory = useCallback(async (memoryId: string) => {
    if (!botIdRef.current) return;
    await fetch(`/api/npcs/${botIdRef.current}/memories`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memoryId }),
    });
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
  }, []);

  const fetchOverride = useCallback(async (id: string) => {
    setIsLoadingOverride(true);
    try {
      const res = await fetch(`/api/npcs/${id}/memory-override`);
      if (!res.ok) throw new Error('Failed to fetch override');
      const data: NpcMemoryOverride | null = await res.json();
      setOverride(data);
    } catch {
      // Non-critical — no override is a valid state
    } finally {
      setIsLoadingOverride(false);
    }
  }, []);

  const saveOverride = useCallback(
    async (data: Partial<NpcMemoryOverride>) => {
      if (!botIdRef.current) return;
      const res = await fetch(
        `/api/npcs/${botIdRef.current}/memory-override`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error('Failed to save override');
      const updated: NpcMemoryOverride = await res.json();
      setOverride(updated);
    },
    []
  );

  const deleteOverride = useCallback(async () => {
    if (!botIdRef.current) return;
    await fetch(`/api/npcs/${botIdRef.current}/memory-override`, {
      method: 'DELETE',
    });
    setOverride(null);
  }, []);

  useEffect(() => {
    if (!botId) {
      setMemories([]);
      setOverride(null);
      return;
    }
    fetchMemories(botId);
    fetchOverride(botId);
  }, [botId, fetchMemories, fetchOverride]);

  return {
    memories,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    deleteMemory,
    override,
    isLoadingOverride,
    saveOverride,
    deleteOverride,
  };
}
