'use client';

import { useState } from 'react';
import { useNpcMemories } from '@/hooks/use-npc-memories';
import type { NpcMemoryOverride } from '@nookstead/shared';

const OVERRIDE_FIELDS: Array<{
  key: keyof Omit<NpcMemoryOverride, 'botId'>;
  label: string;
  step: number;
}> = [
  { key: 'topK', label: 'Top K', step: 1 },
  { key: 'halfLifeHours', label: 'Half-life (hours)', step: 1 },
  { key: 'recencyWeight', label: 'Recency weight', step: 0.1 },
  { key: 'importanceWeight', label: 'Importance weight', step: 0.1 },
  { key: 'maxMemoriesPerNpc', label: 'Max memories', step: 10 },
  { key: 'tokenBudget', label: 'Token budget', step: 50 },
];

function importanceBadgeColor(importance: number): string {
  if (importance <= 3) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (importance <= 6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

export function NpcMemoriesTab({ botId }: { botId: string }) {
  const {
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
  } = useNpcMemories(botId);

  const [overrideForm, setOverrideForm] = useState<
    Record<string, string>
  >({});
  const [overrideInitialized, setOverrideInitialized] = useState(false);

  // Initialize override form when data loads
  if (override && !overrideInitialized) {
    const initial: Record<string, string> = {};
    for (const field of OVERRIDE_FIELDS) {
      const val = override[field.key];
      initial[field.key] = val != null ? String(val) : '';
    }
    setOverrideForm(initial);
    setOverrideInitialized(true);
  }
  if (!override && !isLoadingOverride && !overrideInitialized) {
    setOverrideInitialized(true);
  }

  const handleOverrideChange = (key: string, value: string) => {
    setOverrideForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveOverride = async () => {
    const data: Record<string, number | null> = {};
    for (const field of OVERRIDE_FIELDS) {
      const val = overrideForm[field.key];
      data[field.key] = val !== '' && val !== undefined ? Number(val) : null;
    }
    await saveOverride(data);
  };

  const handleDeleteOverride = async () => {
    await deleteOverride();
    setOverrideForm({});
    setOverrideInitialized(false);
  };

  return (
    <div className="space-y-6">
      {/* Memory List */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Memories</h3>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading memories...</p>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {!isLoading && memories.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No memories yet. Memories are created after dialogues end.
          </p>
        )}

        {memories.length > 0 && (
          <div className="space-y-2">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="flex items-start gap-3 p-3 rounded-md border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{memory.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${importanceBadgeColor(memory.importance)}`}
                    >
                      {memory.importance}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {memory.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(memory.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteMemory(memory.id)}
                  className="shrink-0 text-xs text-destructive hover:text-destructive/80"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {hasMore && memories.length > 0 && (
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="mt-3 text-sm text-primary hover:underline disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>

      {/* Per-NPC Override */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-1">Per-NPC Override</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Leave empty to use global defaults. Set a value to override for
          this NPC only.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {OVERRIDE_FIELDS.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`override-${field.key}`}
                className="block text-xs font-medium mb-1"
              >
                {field.label}
              </label>
              <input
                id={`override-${field.key}`}
                type="number"
                step={field.step}
                value={overrideForm[field.key] ?? ''}
                onChange={(e) =>
                  handleOverrideChange(field.key, e.target.value)
                }
                placeholder="Global default"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSaveOverride}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save Override
          </button>
          {override && (
            <button
              onClick={handleDeleteOverride}
              className="inline-flex items-center justify-center rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Reset to Global
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
