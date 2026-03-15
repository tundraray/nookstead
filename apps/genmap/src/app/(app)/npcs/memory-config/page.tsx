'use client';

import { useState, useEffect } from 'react';
import { useMemoryConfig } from '@/hooks/use-memory-config';
import type { MemoryStreamConfig } from '@nookstead/shared';

const FIELD_DEFS: Array<{
  key: keyof MemoryStreamConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  description: string;
}> = [
  {
    key: 'topK',
    label: 'Top K (memories in prompt)',
    min: 1,
    max: 50,
    step: 1,
    description: 'How many memories NPC "remembers" during dialogue',
  },
  {
    key: 'halfLifeHours',
    label: 'Half-life (hours)',
    min: 1,
    max: 720,
    step: 1,
    description:
      'After this many hours, memory recency score drops to 50%',
  },
  {
    key: 'recencyWeight',
    label: 'Recency weight',
    min: 0,
    max: 10,
    step: 0.1,
    description: 'How much recency affects memory ranking',
  },
  {
    key: 'importanceWeight',
    label: 'Importance weight',
    min: 0,
    max: 10,
    step: 0.1,
    description: 'How much importance affects memory ranking',
  },
  {
    key: 'maxMemoriesPerNpc',
    label: 'Max memories per NPC',
    min: 10,
    max: 5000,
    step: 10,
    description: 'Oldest memories are deleted when limit is exceeded',
  },
  {
    key: 'tokenBudget',
    label: 'Token budget',
    min: 50,
    max: 2000,
    step: 50,
    description: 'Max tokens for memory section in NPC prompt',
  },
  {
    key: 'importanceFirstMeeting',
    label: 'Importance: First meeting',
    min: 1,
    max: 10,
    step: 1,
    description: 'Importance score for first dialogue with a player',
  },
  {
    key: 'importanceNormalDialogue',
    label: 'Importance: Normal dialogue',
    min: 1,
    max: 10,
    step: 1,
    description: 'Importance score for regular dialogues',
  },
  {
    key: 'importanceEmotionalDialogue',
    label: 'Importance: Emotional dialogue',
    min: 1,
    max: 10,
    step: 1,
    description: 'Reserved for Phase 1+',
  },
  {
    key: 'importanceGiftReceived',
    label: 'Importance: Gift received',
    min: 1,
    max: 10,
    step: 1,
    description: 'Reserved for Phase 1+',
  },
  {
    key: 'importanceQuestRelated',
    label: 'Importance: Quest related',
    min: 1,
    max: 10,
    step: 1,
    description: 'Reserved for Phase 1+',
  },
];

export default function MemoryConfigPage() {
  const { config, isLoading, error, isSaving, save } = useMemoryConfig();
  const [form, setForm] = useState<MemoryStreamConfig | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) setForm({ ...config });
  }, [config]);

  const handleChange = (key: keyof MemoryStreamConfig, value: string) => {
    if (!form) return;
    const num = Number(value);
    if (!isNaN(num)) {
      setForm({ ...form, [key]: num });
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setSaveSuccess(false);
    try {
      await save(form);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // error is set in the hook
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading config...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error ?? 'Failed to load config'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Memory Stream Config</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Global parameters for NPC memory system. Per-NPC overrides can be set
        on individual NPC pages.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md text-sm">
          Config saved successfully
        </div>
      )}

      <div className="space-y-4">
        {FIELD_DEFS.map((field) => (
          <div key={field.key}>
            <label
              htmlFor={field.key}
              className="block text-sm font-medium mb-1"
            >
              {field.label}
            </label>
            <input
              id={field.key}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={form[field.key]}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {field.description}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isSaving ? 'Saving...' : 'Save Config'}
      </button>
    </div>
  );
}
