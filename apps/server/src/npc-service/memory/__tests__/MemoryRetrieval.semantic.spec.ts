import { describe, it, expect } from '@jest/globals';
import {
  scoreAndRankMemories,
  SEMANTIC_TOP_K,
  type RetrievalConfig,
} from '../MemoryRetrieval.js';
import type { NpcMemoryRow } from '@nookstead/db';

const baseConfig: RetrievalConfig = {
  topK: 10,
  halfLifeHours: 48,
  recencyWeight: 1.0,
  importanceWeight: 1.0,
  semanticWeight: 0.0,
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

describe('scoreAndRankMemories — 3D semantic scoring', () => {
  const now = new Date('2026-03-14T12:00:00Z');

  it('SEMANTIC_TOP_K is exported as 20', () => {
    expect(SEMANTIC_TOP_K).toBe(20);
  });

  it('high semantic score ranks above medium recency+importance when semanticWeight > 0 (AC5)', () => {
    // Memory A: old (3 days), low importance (2), but high semantic score (0.9)
    const semanticMemory = makeMemory({
      id: 'semantic-high',
      createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000), // 3 days old
      importance: 2,
    });
    // Memory B: fresh (0 hours), medium importance (5), zero semantic score
    const recentMemory = makeMemory({
      id: 'recent-medium',
      createdAt: now,
      importance: 5,
    });

    const config: RetrievalConfig = {
      ...baseConfig,
      recencyWeight: 1.0,
      importanceWeight: 1.0,
      semanticWeight: 2.0,
    };

    const semanticScores = new Map<string, number>([
      ['semantic-high', 0.9],
    ]);

    const result = scoreAndRankMemories(
      [recentMemory, semanticMemory],
      config,
      now,
      semanticScores
    );

    // semantic-high: recency ~0.354 * 1.0 + importance 0.2 * 1.0 + semantic 0.9 * 2.0 = ~2.354
    // recent-medium: recency 1.0 * 1.0 + importance 0.5 * 1.0 + semantic 0.0 * 2.0 = 1.5
    expect(result[0].memory.id).toBe('semantic-high');
    expect(result[1].memory.id).toBe('recent-medium');
  });

  it('backward compatibility: semanticWeight=0 produces identical totalScore to Phase 0 (AC6)', () => {
    const memory = makeMemory({
      id: 'mem-1',
      createdAt: now,
      importance: 7,
    });

    const configWithZeroSemantic: RetrievalConfig = {
      ...baseConfig,
      semanticWeight: 0.0,
    };

    const semanticScores = new Map<string, number>([
      ['mem-1', 0.95],
    ]);

    const withScores = scoreAndRankMemories(
      [memory],
      configWithZeroSemantic,
      now,
      semanticScores
    );
    const withoutScores = scoreAndRankMemories(
      [memory],
      configWithZeroSemantic,
      now
    );

    // When semanticWeight=0, the semantic component is zeroed out
    // totalScore should be identical regardless of whether semanticScores is provided
    expect(withScores[0].totalScore).toBe(withoutScores[0].totalScore);
    // Phase 0 formula: 1.0 * 1.0 + 1.0 * 0.7 = 1.7
    expect(withScores[0].totalScore).toBeCloseTo(1.7, 2);
  });

  it('backward compatibility: semanticScores=undefined produces identical totalScore to Phase 0 (AC6)', () => {
    const memory = makeMemory({
      id: 'mem-1',
      createdAt: now,
      importance: 7,
    });

    const result = scoreAndRankMemories([memory], baseConfig, now, undefined);

    // Phase 0 formula: recencyWeight(1.0) * recency(1.0) + importanceWeight(1.0) * importance(0.7) = 1.7
    expect(result[0].totalScore).toBeCloseTo(1.7, 2);
    expect(result[0].semanticScore).toBe(0.0);
  });

  it('memories not in semanticScores map get semanticScore: 0.0', () => {
    const memoryA = makeMemory({
      id: 'in-map',
      createdAt: now,
      importance: 5,
    });
    const memoryB = makeMemory({
      id: 'not-in-map',
      createdAt: now,
      importance: 5,
    });

    const config: RetrievalConfig = {
      ...baseConfig,
      semanticWeight: 1.0,
    };

    const semanticScores = new Map<string, number>([
      ['in-map', 0.8],
    ]);

    const result = scoreAndRankMemories(
      [memoryA, memoryB],
      config,
      now,
      semanticScores
    );

    const inMap = result.find((r) => r.memory.id === 'in-map');
    const notInMap = result.find((r) => r.memory.id === 'not-in-map');

    expect(inMap).toBeDefined();
    expect(notInMap).toBeDefined();
    expect(inMap?.semanticScore).toBe(0.8);
    expect(notInMap?.semanticScore).toBe(0.0);
  });

  it('weights are applied correctly with concrete number assertions', () => {
    const memory = makeMemory({
      id: 'mem-1',
      createdAt: now, // recency = 1.0
      importance: 6, // normalizedImportance = 0.6
    });

    const config: RetrievalConfig = {
      ...baseConfig,
      recencyWeight: 0.5,
      importanceWeight: 0.3,
      semanticWeight: 0.2,
    };

    const semanticScores = new Map<string, number>([
      ['mem-1', 0.75],
    ]);

    const result = scoreAndRankMemories(
      [memory],
      config,
      now,
      semanticScores
    );

    // totalScore = 0.5 * 1.0 + 0.3 * 0.6 + 0.2 * 0.75
    //            = 0.5 + 0.18 + 0.15
    //            = 0.83
    expect(result[0].recencyScore).toBeCloseTo(1.0, 2);
    expect(result[0].importanceScore).toBeCloseTo(0.6, 2);
    expect(result[0].semanticScore).toBe(0.75);
    expect(result[0].totalScore).toBeCloseTo(0.83, 4);
  });

  it('empty semanticScores map gives all memories semanticScore: 0.0 (AC7/AC8)', () => {
    const memoryA = makeMemory({
      id: 'mem-a',
      createdAt: now,
      importance: 5,
    });
    const memoryB = makeMemory({
      id: 'mem-b',
      createdAt: now,
      importance: 5,
    });

    const config: RetrievalConfig = {
      ...baseConfig,
      semanticWeight: 1.0,
    };

    const emptyScores = new Map<string, number>();

    const result = scoreAndRankMemories(
      [memoryA, memoryB],
      config,
      now,
      emptyScores
    );

    expect(result).toHaveLength(2);
    expect(result[0].semanticScore).toBe(0.0);
    expect(result[1].semanticScore).toBe(0.0);

    // Without semantic contribution: totalScore = 1.0 * 1.0 + 1.0 * 0.5 + 1.0 * 0.0 = 1.5
    expect(result[0].totalScore).toBeCloseTo(1.5, 2);
  });
});
