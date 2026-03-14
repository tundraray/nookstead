'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const PAGE_SIZE = 20;

export interface AdminDialogueSession {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  userId: string;
  userName: string | null;
  userEmail: string;
  messageCount: number;
}

export interface DialogueMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
}

export function useNpcDialogues(botId: string | null) {
  const [sessions, setSessions] = useState<AdminDialogueSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const botIdRef = useRef(botId);
  botIdRef.current = botId;

  const fetchSessions = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/npcs/${id}/dialogues?limit=${PAGE_SIZE}&offset=0`
      );
      if (!res.ok) throw new Error('Failed to fetch dialogue sessions');
      const data: AdminDialogueSession[] = await res.json();
      setSessions(data);
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
        `/api/npcs/${botIdRef.current}/dialogues?limit=${PAGE_SIZE}&offset=${sessions.length}`
      );
      if (!res.ok) throw new Error('Failed to fetch dialogue sessions');
      const data: AdminDialogueSession[] = await res.json();
      setSessions((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [sessions.length, isLoadingMore, hasMore]);

  const refetch = useCallback(async () => {
    if (!botIdRef.current) return;
    await fetchSessions(botIdRef.current);
  }, [fetchSessions]);

  const fetchSessionMessages = useCallback(
    async (sessionId: string): Promise<DialogueMessage[]> => {
      if (!botIdRef.current) {
        throw new Error('No NPC selected');
      }
      const res = await fetch(
        `/api/npcs/${botIdRef.current}/dialogues?sessionId=${sessionId}`
      );
      if (!res.ok) throw new Error('Failed to fetch session messages');
      const data: DialogueMessage[] = await res.json();
      return data;
    },
    []
  );

  useEffect(() => {
    if (!botId) {
      setSessions([]);
      setIsLoading(false);
      setError(null);
      setHasMore(true);
      return;
    }
    fetchSessions(botId);
  }, [botId, fetchSessions]);

  return {
    sessions,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    fetchSessionMessages,
  };
}
