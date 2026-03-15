'use client';

import { useState, useEffect } from 'react';

export interface NpcPlayerStatus {
  id: string;
  botId: string;
  userId: string;
  status: string;
  reason: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export function useNpcStatuses(botId: string | null) {
  const [statuses, setStatuses] = useState<NpcPlayerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!botId) return;
    setIsLoading(true);
    setError(null);

    fetch(`/api/npcs/${botId}/statuses`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load statuses');
        return r.json();
      })
      .then((data: NpcPlayerStatus[]) => setStatuses(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Unknown error')
      )
      .finally(() => setIsLoading(false));
  }, [botId]);

  return { statuses, isLoading, error };
}
