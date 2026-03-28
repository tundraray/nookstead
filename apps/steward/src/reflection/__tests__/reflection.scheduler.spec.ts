import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReflectionScheduler } from '../reflection.scheduler.js';
import { ReflectionService } from '../reflection.service.js';
import type { ReflectionOutput } from '../reflection.schema.js';

// ---- DB function mocks ----

const mockGetBotsNeedingReflection = jest.fn();
const mockGetRecentMemoriesForBot = jest.fn();
const mockCreateReflectionMemory = jest.fn();

jest.mock('@nookstead/db', () => {
  // Mock the db.update chain: db.update(table).set(data).where(condition) -> Promise
  const mockWhere = jest.fn().mockResolvedValue(undefined);
  const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = jest.fn().mockReturnValue({ set: mockSet });
  const mockFindFirst = jest.fn();

  return {
    getGameDb: jest.fn(() => ({
      update: mockUpdate,
      query: {
        npcBots: {
          findFirst: mockFindFirst,
        },
      },
    })),
    getBotsNeedingReflection: (...args: unknown[]) =>
      mockGetBotsNeedingReflection(...args),
    getRecentMemoriesForBot: (...args: unknown[]) =>
      mockGetRecentMemoriesForBot(...args),
    createReflectionMemory: (...args: unknown[]) =>
      mockCreateReflectionMemory(...args),
    eq: jest.fn((..._args: unknown[]) => 'eq-condition'),
    npcBots: { id: 'id' },
  };
});

// ---- Embedding mocks ----

const mockEmbedText = jest.fn();
const mockUpsertMemoryVector = jest.fn();

jest.mock('../../shared/embedding.service.js', () => ({
  EmbeddingService: jest.fn().mockImplementation(() => ({
    embedText: mockEmbedText,
  })),
}));

jest.mock('../../shared/vector-store.service.js', () => ({
  VectorStore: jest.fn().mockImplementation(() => ({
    upsertMemoryVector: mockUpsertMemoryVector,
  })),
}));

// ---- Test data ----

const validOutput: ReflectionOutput = {
  summary: 'Good day at the farm.',
  mood: 'happy',
  moodIntensity: 7,
  moodRationale: 'Player was kind.',
  plan: 'Help the farmer tomorrow.',
};

const botRow = {
  id: 'bot-1',
  name: 'Alice',
  personality: 'Cheerful',
  role: 'Farmer',
  bio: 'A happy farmer.',
  traits: ['cheerful'],
  goals: ['grow crops'],
  interests: ['gardening'],
  mood: 'neutral',
  moodIntensity: 5,
};

const dbMod = require('@nookstead/db');

function getMockDb() {
  return dbMod.getGameDb();
}

describe('ReflectionScheduler', () => {
  let scheduler: ReflectionScheduler;
  let mockGenerateReflection: jest.Mock;
  let mockUpdateBotMood: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockGenerateReflection = jest.fn();

    // Reset the DB mock chain for each test
    const db = getMockDb();
    mockUpdateBotMood = db.update().set().where;
    mockUpdateBotMood.mockResolvedValue(undefined);
    db.update().set.mockReturnValue({ where: mockUpdateBotMood });
    db.update.mockReturnValue({ set: db.update().set });

    // Default: findFirst returns botRow
    db.query.npcBots.findFirst.mockResolvedValue(botRow);

    // Default: memories
    mockGetRecentMemoriesForBot.mockResolvedValue([]);

    // Default: createReflectionMemory returns a row
    mockCreateReflectionMemory.mockResolvedValue({
      id: 'mem-001',
      botId: 'bot-1',
      type: 'reflection',
      content: 'test',
      importance: 10,
      createdAt: new Date(),
    });

    // Default: embedding succeeds
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    mockUpsertMemoryVector.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReflectionScheduler,
        {
          provide: ReflectionService,
          useValue: {
            generateReflection: mockGenerateReflection,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_GENERATIVE_AI_API_KEY')
                return 'test-google-key';
              if (key === 'QDRANT_URL') return 'http://localhost:6333';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    scheduler = module.get<ReflectionScheduler>(ReflectionScheduler);
  });

  // Test 1 -- AC9/AC14: Does not re-reflect bots that already reflected today
  it('should not reflect bots that already have reflection today', async () => {
    mockGetBotsNeedingReflection.mockResolvedValue([]);
    await scheduler.runOnce();
    expect(mockGenerateReflection).not.toHaveBeenCalled();
    expect(mockCreateReflectionMemory).not.toHaveBeenCalled();
  });

  // Test 2 -- AC15: Continues to next bot when one fails
  it('should continue processing remaining bots when one fails', async () => {
    const bots = [
      { id: 'bot-1', name: 'Alice' },
      { id: 'bot-2', name: 'Bob' },
    ];
    mockGetBotsNeedingReflection.mockResolvedValue(bots);
    mockGenerateReflection
      .mockRejectedValueOnce(new Error('fail')) // bot-1 fails
      .mockResolvedValue(validOutput); // bot-2 succeeds
    await scheduler.runOnce();
    expect(mockCreateReflectionMemory).toHaveBeenCalledTimes(1);
    expect(mockCreateReflectionMemory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ botId: 'bot-2' })
    );
  });

  // Test 3 -- AC7: Creates memory with type='reflection' and importance=10
  it('should create reflection memory with correct fields', async () => {
    mockGetBotsNeedingReflection.mockResolvedValue([
      { id: 'bot-1', name: 'Alice' },
    ]);
    mockGenerateReflection.mockResolvedValue(validOutput);
    await scheduler.runOnce();
    expect(mockCreateReflectionMemory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ importance: 10 })
    );
  });

  // Test 4 -- AC3: Updates mood on npc_bots after successful reflection
  it('should update mood fields on npc_bots after successful reflection', async () => {
    mockGetBotsNeedingReflection.mockResolvedValue([
      { id: 'bot-1', name: 'Alice' },
    ]);
    mockGenerateReflection.mockResolvedValue(validOutput);
    await scheduler.runOnce();
    expect(mockUpdateBotMood).toHaveBeenCalled();
  });

  // Test 5 -- AC12: Calls embedding service after successful reflection
  it('should call embedding service for successful reflections', async () => {
    mockGetBotsNeedingReflection.mockResolvedValue([
      { id: 'bot-1', name: 'Alice' },
    ]);
    mockGenerateReflection.mockResolvedValue(validOutput);
    await scheduler.runOnce();
    // Give fire-and-forget a tick to execute
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockEmbedText).toHaveBeenCalled();
  });

  // Test 6 -- Concurrency guard: second handleCron() is no-op while first is running
  it('should not start a second run while first is in progress', async () => {
    mockGetBotsNeedingReflection.mockResolvedValue([
      { id: 'bot-1', name: 'Alice' },
    ]);
    let resolveFn: () => void;
    mockGenerateReflection.mockImplementation(
      () =>
        new Promise<ReflectionOutput>((resolve) => {
          resolveFn = () => resolve(validOutput);
        })
    );
    const first = scheduler.handleCron();
    // Yield to microtask queue so runOnce reaches generateReflection
    await new Promise((r) => setTimeout(r, 0));
    const second = scheduler.handleCron(); // should be no-op
    resolveFn!();
    await Promise.all([first, second]);
    expect(mockCreateReflectionMemory).toHaveBeenCalledTimes(1);
  });

  // Test 7 -- AC15: Per-NPC error does not stop others (explicit log assertion)
  it('should log error for failed bot and continue', async () => {
    const logSpy = jest.spyOn(scheduler['logger'], 'error');
    const bots = [
      { id: 'bot-1', name: 'Alice' },
      { id: 'bot-2', name: 'Bob' },
    ];
    mockGetBotsNeedingReflection.mockResolvedValue(bots);
    mockGenerateReflection
      .mockResolvedValueOnce(null) // bot-1: service returned null (LLM failure)
      .mockResolvedValue(validOutput);
    await scheduler.runOnce();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('bot-1'),
      expect.anything()
    );
    expect(mockCreateReflectionMemory).toHaveBeenCalledTimes(1);
  });
});
