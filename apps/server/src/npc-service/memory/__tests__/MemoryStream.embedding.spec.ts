import { describe, it, expect, beforeEach } from '@jest/globals';

// --- Mocks must be set up BEFORE importing the module under test ---

const mockGenerateText = jest.fn();
jest.mock('ai', () => ({
  generateText: mockGenerateText,
}));

const mockCreateOpenAI = jest.fn().mockReturnValue(jest.fn());
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI,
}));

const mockCreateMemory = jest.fn();
const mockGetDialogueSessionMessages = jest.fn();
const mockGetMemoryCount = jest.fn();
const mockDeleteOldestMemories = jest.fn();
jest.mock('@nookstead/db', () => ({
  createMemory: mockCreateMemory,
  getDialogueSessionMessages: mockGetDialogueSessionMessages,
  getMemoryCount: mockGetMemoryCount,
  deleteOldestMemories: mockDeleteOldestMemories,
}));

const mockScoreImportance = jest.fn();
jest.mock('../ImportanceScorer.js', () => ({
  scoreImportance: mockScoreImportance,
}));

import { MemoryStream } from '../MemoryStream.js';
import type { EmbeddingService } from '../EmbeddingService.js';
import type { VectorStore } from '../VectorStore.js';
import type { CreateDialogueMemoryParams, CreateActionMemoryParams } from '../MemoryStream.js';
import type { NpcMemoryRow, MemoryConfigValues } from '@nookstead/db';

// --- Helpers ---

function makeMemoryRow(overrides: Partial<NpcMemoryRow> = {}): NpcMemoryRow {
  return {
    id: overrides.id ?? 'mem-uuid-1',
    botId: overrides.botId ?? 'bot-1',
    userId: overrides.userId ?? 'user-1',
    type: overrides.type ?? 'interaction',
    content: overrides.content ?? 'Summary of dialogue.',
    importance: overrides.importance ?? 5,
    dialogueSessionId: overrides.dialogueSessionId ?? 'session-1',
    createdAt: overrides.createdAt ?? new Date('2026-03-28T12:00:00Z'),
  };
}

function makeConfig(): MemoryConfigValues {
  return {
    maxMemoriesPerNpc: 100,
    topK: 10,
    halfLifeHours: 48,
    recencyWeight: 1.0,
    importanceWeight: 1.0,
    semanticWeight: 0,
    tokenBudget: 1000,
    importanceFirstMeeting: 7,
    importanceNormalDialogue: 4,
    importanceEmotionalDialogue: 6,
    importanceGiftReceived: 5,
    importanceQuestRelated: 8,
  };
}

function makeMockEmbeddingService(): jest.Mocked<EmbeddingService> {
  return {
    embedText: jest.fn(),
    embedTexts: jest.fn(),
  } as unknown as jest.Mocked<EmbeddingService>;
}

function makeMockVectorStore(): jest.Mocked<VectorStore> {
  return {
    ensureCollection: jest.fn(),
    upsertMemoryVector: jest.fn(),
    searchSimilar: jest.fn(),
    deleteMemoryVector: jest.fn(),
    healthCheck: jest.fn(),
  } as unknown as jest.Mocked<VectorStore>;
}

const fakeDb = {} as never;

/**
 * Flush microtask queue so fire-and-forget .then().catch() chains complete.
 * We iterate multiple times to ensure nested promise chains settle.
 */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

// --- Test suite ---

describe('MemoryStream embedding integration', () => {
  let embeddingService: jest.Mocked<EmbeddingService>;
  let vectorStore: jest.Mocked<VectorStore>;
  let memoryRow: NpcMemoryRow;

  beforeEach(() => {
    jest.clearAllMocks();

    embeddingService = makeMockEmbeddingService();
    vectorStore = makeMockVectorStore();
    memoryRow = makeMemoryRow();

    // Default DB mock: createMemory returns a valid NpcMemoryRow
    mockCreateMemory.mockResolvedValue(memoryRow);
    mockGetDialogueSessionMessages.mockResolvedValue([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]);
    mockGetMemoryCount.mockResolvedValue(5);
    mockScoreImportance.mockReturnValue(5);
    mockGenerateText.mockResolvedValue({ text: 'Summary of dialogue.' });
  });

  function makeStream(opts?: {
    embeddingService?: EmbeddingService | null;
    vectorStore?: VectorStore | null;
  }): MemoryStream {
    return new MemoryStream({
      apiKey: 'test-api-key',
      embeddingService:
        opts && 'embeddingService' in opts
          ? opts.embeddingService
          : embeddingService,
      vectorStore:
        opts && 'vectorStore' in opts ? opts.vectorStore : vectorStore,
    });
  }

  function dialogueParams(): CreateDialogueMemoryParams {
    return {
      db: fakeDb,
      botId: 'bot-1',
      userId: 'user-1',
      dialogueSessionId: 'session-1',
      isFirstMeeting: false,
      botName: 'Baker',
      playerName: 'Alex',
      config: makeConfig(),
    };
  }

  function actionParams(): CreateActionMemoryParams {
    return {
      db: fakeDb,
      botId: 'bot-1',
      userId: 'user-1',
      playerName: 'Alex',
      memoryTemplate: '{player} gave a gift.',
      importance: 5,
      dialogueSessionId: 'session-1',
    };
  }

  describe('createDialogueMemory', () => {
    it('should call embedText with the memory content after createMemory succeeds', async () => {
      const vector = Array.from({ length: 768 }, () => 0.1);
      embeddingService.embedText.mockResolvedValue(vector);
      vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

      const stream = makeStream();
      await stream.createDialogueMemory(dialogueParams());
      await flushPromises();

      expect(embeddingService.embedText).toHaveBeenCalledTimes(1);
      expect(embeddingService.embedText).toHaveBeenCalledWith(memoryRow.content);
    });

    it('should call upsertMemoryVector with memory id, vector, and payload', async () => {
      const vector = Array.from({ length: 768 }, () => 0.2);
      embeddingService.embedText.mockResolvedValue(vector);
      vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

      const stream = makeStream();
      await stream.createDialogueMemory(dialogueParams());
      await flushPromises();

      expect(vectorStore.upsertMemoryVector).toHaveBeenCalledTimes(1);
      expect(vectorStore.upsertMemoryVector).toHaveBeenCalledWith(
        memoryRow.id,
        vector,
        {
          botId: 'bot-1',
          userId: 'user-1',
          importance: 5,
          createdAt: memoryRow.createdAt.toISOString(),
        }
      );
    });

    it('should NOT call upsertMemoryVector when embedText returns null', async () => {
      embeddingService.embedText.mockResolvedValue(null);

      const stream = makeStream();
      await stream.createDialogueMemory(dialogueParams());
      await flushPromises();

      expect(embeddingService.embedText).toHaveBeenCalledTimes(1);
      expect(vectorStore.upsertMemoryVector).not.toHaveBeenCalled();
    });

    it('should NOT throw when upsertMemoryVector rejects (AC2: error isolation)', async () => {
      const vector = Array.from({ length: 768 }, () => 0.1);
      embeddingService.embedText.mockResolvedValue(vector);
      vectorStore.upsertMemoryVector.mockRejectedValue(
        new Error('Qdrant connection refused')
      );

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const stream = makeStream();
      // createDialogueMemory must NOT throw
      await expect(
        stream.createDialogueMemory(dialogueParams())
      ).resolves.toBeUndefined();
      await flushPromises();

      // Error should be logged with memoryId context
      expect(consoleSpy).toHaveBeenCalledWith(
        '[MemoryStream] Failed to embed memory:',
        expect.objectContaining({ memoryId: memoryRow.id })
      );

      consoleSpy.mockRestore();
    });

    it('should NOT attempt embedding when embeddingService is null', async () => {
      const stream = makeStream({ embeddingService: null });
      await stream.createDialogueMemory(dialogueParams());
      await flushPromises();

      expect(embeddingService.embedText).not.toHaveBeenCalled();
      expect(vectorStore.upsertMemoryVector).not.toHaveBeenCalled();
    });

    it('should NOT attempt upsert when vectorStore is null', async () => {
      const stream = makeStream({ vectorStore: null });
      await stream.createDialogueMemory(dialogueParams());
      await flushPromises();

      expect(embeddingService.embedText).not.toHaveBeenCalled();
      expect(vectorStore.upsertMemoryVector).not.toHaveBeenCalled();
    });
  });

  describe('createActionMemory', () => {
    it('should call embedText with the action memory content', async () => {
      const vector = Array.from({ length: 768 }, () => 0.3);
      embeddingService.embedText.mockResolvedValue(vector);
      vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

      const actionMemoryRow = makeMemoryRow({
        id: 'action-mem-1',
        content: 'Alex gave a gift.',
        type: 'gift',
      });
      mockCreateMemory.mockResolvedValue(actionMemoryRow);

      const stream = makeStream();
      await stream.createActionMemory(actionParams());
      await flushPromises();

      expect(embeddingService.embedText).toHaveBeenCalledTimes(1);
      expect(embeddingService.embedText).toHaveBeenCalledWith('Alex gave a gift.');
    });

    it('should call upsertMemoryVector with correct payload for action memories', async () => {
      const vector = Array.from({ length: 768 }, () => 0.4);
      embeddingService.embedText.mockResolvedValue(vector);
      vectorStore.upsertMemoryVector.mockResolvedValue(undefined);

      const actionMemoryRow = makeMemoryRow({
        id: 'action-mem-2',
        content: 'Alex gave a gift.',
        type: 'gift',
        importance: 5,
      });
      mockCreateMemory.mockResolvedValue(actionMemoryRow);

      const stream = makeStream();
      await stream.createActionMemory(actionParams());
      await flushPromises();

      expect(vectorStore.upsertMemoryVector).toHaveBeenCalledTimes(1);
      expect(vectorStore.upsertMemoryVector).toHaveBeenCalledWith(
        actionMemoryRow.id,
        vector,
        {
          botId: 'bot-1',
          userId: 'user-1',
          importance: 5,
          createdAt: actionMemoryRow.createdAt.toISOString(),
        }
      );
    });
  });
});
