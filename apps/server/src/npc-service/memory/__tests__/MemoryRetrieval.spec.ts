import { describe, it, expect } from '@jest/globals';
import {
  scoreAndRankMemories,
  type RetrievalConfig,
} from '../MemoryRetrieval.js';
import type { NpcMemoryRow } from '@nookstead/db';

const baseConfig: RetrievalConfig = {
  topK: 10,
  halfLifeHours: 48,
  recencyWeight: 1.0,
  importanceWeight: 1.0,
  tokenBudget: 400,
};

function makeMemory(
  overrides: Partial<NpcMemoryRow> & { createdAt: Date }
): NpcMemoryRow {
  return {
    id: overrides.id ?? 'test-id',
    botId: overrides.botId ?? 'bot-1',
    userId: overrides.userId ?? 'user-1',
    type: overrides.type ?? 'interaction',
    content: overrides.content ?? 'Test memory content.',
    importance: overrides.importance ?? 5,
    dialogueSessionId: overrides.dialogueSessionId ?? null,
    createdAt: overrides.createdAt,
  };
}

describe('scoreAndRankMemories', () => {
  const now = new Date('2026-03-14T12:00:00Z');

  it('returns empty array for no memories', () => {
    const result = scoreAndRankMemories([], baseConfig, now);
    expect(result).toEqual([]);
  });

  it('scores a fresh memory with recency ~1.0', () => {
    const memory = makeMemory({ createdAt: now });
    const result = scoreAndRankMemories([memory], baseConfig, now);

    expect(result).toHaveLength(1);
    expect(result[0].recencyScore).toBeCloseTo(1.0, 2);
    expect(result[0].importanceScore).toBeCloseTo(0.5, 2);
  });

  it('scores a 48-hour-old memory with recency ~0.5', () => {
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const memory = makeMemory({ createdAt: twoDaysAgo });
    const result = scoreAndRankMemories([memory], baseConfig, now);

    expect(result).toHaveLength(1);
    expect(result[0].recencyScore).toBeCloseTo(0.5, 1);
  });

  it('scores a 96-hour-old memory with recency ~0.25', () => {
    const fourDaysAgo = new Date(now.getTime() - 96 * 60 * 60 * 1000);
    const memory = makeMemory({ createdAt: fourDaysAgo });
    const result = scoreAndRankMemories([memory], baseConfig, now);

    expect(result).toHaveLength(1);
    expect(result[0].recencyScore).toBeCloseTo(0.25, 1);
  });

  it('ranks higher-importance memories above lower-importance', () => {
    const lowImportance = makeMemory({
      id: 'low',
      createdAt: now,
      importance: 2,
    });
    const highImportance = makeMemory({
      id: 'high',
      createdAt: now,
      importance: 9,
    });
    const result = scoreAndRankMemories(
      [lowImportance, highImportance],
      baseConfig,
      now
    );

    expect(result[0].memory.id).toBe('high');
    expect(result[1].memory.id).toBe('low');
  });

  it('respects topK limit', () => {
    const memories = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `m-${i}`, createdAt: now, importance: 5 })
    );
    const config = { ...baseConfig, topK: 5 };
    const result = scoreAndRankMemories(memories, config, now);

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('trims to token budget', () => {
    const longContent = 'A'.repeat(500); // ~143 tokens at 3.5 chars/token
    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory({ id: `m-${i}`, createdAt: now, content: longContent })
    );
    const config = { ...baseConfig, tokenBudget: 200 };
    const result = scoreAndRankMemories(memories, config, now);

    // With ~143 tokens per memory and a 200 token budget, only 1 should fit
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('higher importance compensates for older memory', () => {
    // Important old memory vs. trivial recent memory
    const oldImportant = makeMemory({
      id: 'old-important',
      createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000), // 3 days old
      importance: 10,
    });
    const freshTrivial = makeMemory({
      id: 'fresh-trivial',
      createdAt: now,
      importance: 1,
    });
    const result = scoreAndRankMemories(
      [freshTrivial, oldImportant],
      baseConfig,
      now
    );

    // Old important: recency ~0.35 + importance 1.0 = ~1.35
    // Fresh trivial: recency ~1.0 + importance 0.1 = ~1.1
    expect(result[0].memory.id).toBe('old-important');
  });

  it('uses configurable weights', () => {
    const memory = makeMemory({ createdAt: now, importance: 5 });

    const recencyOnly = scoreAndRankMemories(
      [memory],
      { ...baseConfig, recencyWeight: 2.0, importanceWeight: 0.0 },
      now
    );
    const importanceOnly = scoreAndRankMemories(
      [memory],
      { ...baseConfig, recencyWeight: 0.0, importanceWeight: 2.0 },
      now
    );

    // Recency-only: totalScore = 2.0 * 1.0 + 0 = 2.0
    expect(recencyOnly[0].totalScore).toBeCloseTo(2.0, 1);
    // Importance-only: totalScore = 0 + 2.0 * 0.5 = 1.0
    expect(importanceOnly[0].totalScore).toBeCloseTo(1.0, 1);
  });
});
