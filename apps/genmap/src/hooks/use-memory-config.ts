'use client';

import { useState, useCallback, useEffect } from 'react';
import type { MemoryStreamConfig } from '@nookstead/shared';

export function useMemoryConfig() {
  const [config, setConfig] = useState<MemoryStreamConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/npcs/memory-config');
      if (!res.ok) throw new Error('Failed to load config');
      const data: MemoryStreamConfig = await res.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const save = useCallback(
    async (data: Partial<MemoryStreamConfig>) => {
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/npcs/memory-config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to save config');
        const updated: MemoryStreamConfig = await res.json();
        setConfig(updated);
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, isLoading, error, isSaving, save, refetch: fetchConfig };
}
