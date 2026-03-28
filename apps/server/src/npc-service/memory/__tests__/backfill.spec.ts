import { describe, it, expect, beforeEach } from '@jest/globals';

const mockGetAllMemoriesForBackfill = jest.fn();
jest.mock('@nookstead/db', () => ({
  getAllMemoriesForBackfill: mockGetAllMemoriesForBackfill,
}));

import type { EmbeddingService } from '../EmbeddingService.js';
import type { VectorStore } from '../VectorStore.js';
import type { NpcMemoryRow } from '@nookstead/db';
import {
  backfillMemoryEmbeddings,
  type BackfillResult,
} from '../backfill.js';

// --- Helpers ---

function makeMemoryRow(overrides: Partial<NpcMemoryRow> = {}): NpcMemoryRow {
  return {
    id: overrides.id ?? 'mem-1',
    botId: overrides.botId ?? 'bot-1',
    userId: overrides.userId ?? 'user-1',
    type: overrides.type ?? 'interaction',
    content: overrides.content ?? 'Some memory content.',
    importance: overrides.importance ?? 5,
    dialogueSessionId: overrides.dialogueSessionId ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-03-28T12:00:00Z'),
  };
}

function make768Vector(fill = 0.1): number[] {
  return Array.from({ length: 768 }, () => fill);
}

function makeMockEmbeddingService(): jest.Mocked<
  Pick<EmbeddingService, 'embedText' | 'embedTexts'>
> {
  return {
    embedText: jest.fn(),
    embedTexts: jest.fn(),
  };
}

function makeMockVectorStore(): jest.Mocked<
  Pick<
    VectorStore,
    | 'ensureCollection'
    | 'upsertMemoryVector'
    | 'searchSimilar'
    | 'deleteMemoryVector'
    | 'healthCheck'
    | 'getExistingIds'
  >
> {
  return {
    ensureCollection: jest.fn(),
    upsertMemoryVector: jest.fn(),
    searchSimilar: jest.fn(),
    deleteMemoryVector: jest.fn(),
    healthCheck: jest.fn(),
    getExistingIds: jest.fn(),
  };
}

const fakeDb = {} as never;

describe('backfillMemoryEmbeddings', () => {
  let embeddingService: ReturnType<typeof makeMockEmbeddingService>;
  let vectorStore: ReturnType<typeof makeMockVectorStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    embeddingService = makeMockEmbeddingService();
    vectorStore = makeMockVectorStore();
  });

  function callBackfill(
    memories: NpcMemoryRow[],
    opts?: { batchSize?: number; delayMs?: number }
  ): Promise<BackfillResult> {
    mockGetAllMemoriesForBackfill.mockResolvedValue(memories);
    return backfillMemoryEmbeddings({
      embeddingService: embeddingService as unknown as EmbeddingService,
      vectorStore: vectorStore as unknown as VectorStore,
      db: fakeDb,
      batchSize: opts?.batchSize ?? 10,
      delayMs: opts?.delayMs ?? 0,
    });
  }

  it('should identify memories without Qdrant vectors and embed only those (AC9)', async () => {
    const memories = [
      makeMemoryRow({ id: 'mem-1', content: 'Memory one' }),
      makeMemoryRow({ id: 'mem-2', content: 'Memory two' }),
      makeMemoryRow({ id: 'mem-3', content: 'Memory three' }),
    ];

    // mem-2 already has a vector in Qdrant
    vectorStore.getExistingIds.mockResolvedValue(new Set(['mem-2']));
    const vec1 = make768Vector(0.1);
    const vec3 = make768Vector(0.3);
    embeddingService.embedTexts.mockResolvedValue([vec1, vec3]);
    vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

    const result = await callBackfill(memories);

    // Should have checked Qdrant for all 3 IDs
    expect(vectorStore.getExistingIds).toHaveBeenCalledWith([
      'mem-1',
      'mem-2',
      'mem-3',
    ]);
    // Should embed only the 2 missing ones
    expect(embeddingService.embedTexts).toHaveBeenCalledWith([
      'Memory one',
      'Memory three',
    ]);
    // Should upsert both
    expect(vectorStore.upsertMemoryVector).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(3);
    expect(result.embedded).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('should skip all memories that already have Qdrant vectors', async () => {
    const memories = [
      makeMemoryRow({ id: 'mem-1' }),
      makeMemoryRow({ id: 'mem-2' }),
    ];

    vectorStore.getExistingIds.mockResolvedValue(new Set(['mem-1', 'mem-2']));

    const result = await callBackfill(memories);

    expect(embeddingService.embedTexts).not.toHaveBeenCalled();
    expect(vectorStore.upsertMemoryVector).not.toHaveBeenCalled();
    expect(result.total).toBe(2);
    expect(result.embedded).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('should process memories in batches of configurable batchSize (AC10)', async () => {
    const memories = [
      makeMemoryRow({ id: 'mem-1', content: 'Content 1' }),
      makeMemoryRow({ id: 'mem-2', content: 'Content 2' }),
      makeMemoryRow({ id: 'mem-3', content: 'Content 3' }),
      makeMemoryRow({ id: 'mem-4', content: 'Content 4' }),
      makeMemoryRow({ id: 'mem-5', content: 'Content 5' }),
    ];

    vectorStore.getExistingIds.mockResolvedValue(new Set());
    embeddingService.embedTexts.mockResolvedValue([
      make768Vector(0.1),
      make768Vector(0.2),
    ]);
    vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

    // Batch size 2 => 3 batches (2+2+1)
    await callBackfill(memories, { batchSize: 2 });

    // getExistingIds called 3 times (once per batch)
    expect(vectorStore.getExistingIds).toHaveBeenCalledTimes(3);
    expect(vectorStore.getExistingIds).toHaveBeenNthCalledWith(1, [
      'mem-1',
      'mem-2',
    ]);
    expect(vectorStore.getExistingIds).toHaveBeenNthCalledWith(2, [
      'mem-3',
      'mem-4',
    ]);
    expect(vectorStore.getExistingIds).toHaveBeenNthCalledWith(3, ['mem-5']);

    // embedTexts called 3 times
    expect(embeddingService.embedTexts).toHaveBeenCalledTimes(3);
  });

  it('should handle partial failures: some embeddings null, function still resolves', async () => {
    const memories = [
      makeMemoryRow({ id: 'mem-1', content: 'Content 1' }),
      makeMemoryRow({ id: 'mem-2', content: 'Content 2' }),
      makeMemoryRow({ id: 'mem-3', content: 'Content 3' }),
    ];

    vectorStore.getExistingIds.mockResolvedValue(new Set());
    // Second embedding fails (null), others succeed
    embeddingService.embedTexts.mockResolvedValue([
      make768Vector(0.1),
      null,
      make768Vector(0.3),
    ]);
    vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

    const result = await callBackfill(memories);

    // Only 2 upserts (mem-1 and mem-3)
    expect(vectorStore.upsertMemoryVector).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(3);
    expect(result.embedded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('should return failed=total when all embeddings fail, without throwing', async () => {
    const memories = [
      makeMemoryRow({ id: 'mem-1', content: 'Content 1' }),
      makeMemoryRow({ id: 'mem-2', content: 'Content 2' }),
    ];

    vectorStore.getExistingIds.mockResolvedValue(new Set());
    embeddingService.embedTexts.mockResolvedValue([null, null]);

    const result = await callBackfill(memories);

    expect(vectorStore.upsertMemoryVector).not.toHaveBeenCalled();
    expect(result.total).toBe(2);
    expect(result.embedded).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.skipped).toBe(0);
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should return correct summary with durationMs', async () => {
    const memories = [makeMemoryRow({ id: 'mem-1', content: 'Content' })];

    vectorStore.getExistingIds.mockResolvedValue(new Set());
    embeddingService.embedTexts.mockResolvedValue([make768Vector()]);
    vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

    const result = await callBackfill(memories);

    expect(result).toEqual({
      total: 1,
      embedded: 1,
      failed: 0,
      skipped: 0,
      durationMs: expect.any(Number),
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty memories array gracefully', async () => {
    const result = await callBackfill([]);

    expect(vectorStore.getExistingIds).not.toHaveBeenCalled();
    expect(embeddingService.embedTexts).not.toHaveBeenCalled();
    expect(result).toEqual({
      total: 0,
      embedded: 0,
      failed: 0,
      skipped: 0,
      durationMs: expect.any(Number),
    });
  });

  it('should pass correct payload to upsertMemoryVector', async () => {
    const memory = makeMemoryRow({
      id: 'mem-99',
      botId: 'bot-7',
      userId: 'user-3',
      importance: 8,
      content: 'Important memory',
      createdAt: new Date('2026-01-15T10:30:00Z'),
    });

    vectorStore.getExistingIds.mockResolvedValue(new Set());
    const vector = make768Vector(0.5);
    embeddingService.embedTexts.mockResolvedValue([vector]);
    vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

    await callBackfill([memory]);

    expect(vectorStore.upsertMemoryVector).toHaveBeenCalledWith(
      'mem-99',
      vector,
      {
        botId: 'bot-7',
        userId: 'user-3',
        importance: 8,
        createdAt: '2026-01-15T10:30:00.000Z',
      }
    );
  });
});
