import type { ToolContext } from '../index.js';
import type { DrizzleClient } from '@nookstead/db';
import { adjustRelationshipSchema } from '../adjust-relationship.js';
import { createMemorySchema } from '../create-memory.js';
import { endConversationSchema } from '../end-conversation.js';
import { expressEmotionSchema, EMOTIONS } from '../express-emotion.js';

// ── Module mocks ────────────────────────────────────────────

const mockAdjustRelationshipScore = jest.fn().mockResolvedValue({
  botId: 'bot-uuid',
  userId: 'user-uuid',
  score: 10,
  socialType: 'acquaintance',
  isWorker: false,
  hiredAt: null,
  updatedAt: new Date(),
});

const mockUpdateRelationship = jest.fn().mockResolvedValue({
  botId: 'bot-uuid',
  userId: 'user-uuid',
  score: 10,
  socialType: 'acquaintance',
  isWorker: false,
  hiredAt: null,
  updatedAt: new Date(),
});

const mockCreateMemory = jest.fn().mockResolvedValue({ id: 'mem-uuid' });
const mockCreatePlayerStatus = jest.fn().mockResolvedValue({ id: 'status-uuid' });

// Mock npcBots table for Drizzle update chain
const mockWhere = jest.fn().mockResolvedValue([]);
const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
const mockDbUpdate = jest.fn().mockReturnValue({ set: mockSet });

jest.mock('@nookstead/db', () => ({
  adjustRelationshipScore: (...args: unknown[]) => mockAdjustRelationshipScore(...args),
  updateRelationship: (...args: unknown[]) => mockUpdateRelationship(...args),
  createMemory: (...args: unknown[]) => mockCreateMemory(...args),
  createPlayerStatus: (...args: unknown[]) => mockCreatePlayerStatus(...args),
  npcBots: { id: 'npc_bots.id' },
  eq: jest.fn().mockReturnValue('eq-condition'),
}));

jest.mock('@nookstead/shared', () => ({
  ServerMessage: {
    DIALOGUE_SCORE_CHANGE: 'dialogue_score_change',
    DIALOGUE_EMOTION: 'dialogue_emotion',
  },
}));

jest.mock('../../../relationships/index.js', () => ({
  evaluateProgression: jest.fn().mockReturnValue('acquaintance'),
  rowToRelationshipData: jest.fn().mockImplementation((row: Record<string, unknown>) => ({
    botId: row.botId,
    userId: row.userId,
    socialType: row.socialType,
    isWorker: row.isWorker,
    score: row.score,
    hiredAt: null,
    updatedAt: (row.updatedAt as Date).toISOString(),
  })),
}));

// ── Helpers ─────────────────────────────────────────────────

function mockContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    db: { update: mockDbUpdate } as unknown as DrizzleClient,
    botId: 'bot-uuid',
    userId: 'user-uuid',
    playerName: 'TestPlayer',
    sendToClient: jest.fn(),
    endConversation: jest.fn(),
    persona: {
      personality: 'kind',
      traits: ['friendly'],
      role: null,
      speechStyle: null,
      bio: 'test bio',
      age: null,
      goals: null,
      fears: null,
      interests: null,
    },
    cumulativeDelta: 0,
    endRequested: false,
    ...overrides,
  };
}

// ── Import tool factories after mocks ───────────────────────

import { adjustRelationshipTool } from '../adjust-relationship.js';
import { createMemoryTool } from '../create-memory.js';
import { endConversationTool } from '../end-conversation.js';
import { expressEmotionTool } from '../express-emotion.js';

// ── Tests ───────────────────────────────────────────────────

describe('adjust_relationship tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdjustRelationshipScore.mockResolvedValue({
      botId: 'bot-uuid',
      userId: 'user-uuid',
      score: 10,
      socialType: 'acquaintance',
      isWorker: false,
      hiredAt: null,
      updatedAt: new Date(),
    });
  });

  describe('Zod schema validation', () => {
    it('should accept delta=2 with reason', () => {
      const result = adjustRelationshipSchema.safeParse({ delta: 2, reason: 'was kind' });
      expect(result.success).toBe(true);
    });

    it('should accept delta=-5 with reason', () => {
      const result = adjustRelationshipSchema.safeParse({ delta: -5, reason: 'insulted' });
      expect(result.success).toBe(true);
    });

    it('should reject delta=4 (max is 3)', () => {
      const result = adjustRelationshipSchema.safeParse({ delta: 4, reason: 'test' });
      expect(result.success).toBe(false);
    });

    it('should reject delta=-8 (min is -7)', () => {
      const result = adjustRelationshipSchema.safeParse({ delta: -8, reason: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('execute function', () => {
    it('should call adjustRelationshipScore and send DIALOGUE_SCORE_CHANGE for positive delta', async () => {
      const ctx = mockContext();
      const t = adjustRelationshipTool(ctx);

      const result = await t.execute!({ delta: 2, reason: 'was kind' }, {
        toolCallId: 'tc-1',
        messages: [],
      });

      expect(result).toBe('Отношение изменено на 2');
      expect(mockAdjustRelationshipScore).toHaveBeenCalledWith(ctx.db, 'bot-uuid', 'user-uuid', 2);
      expect(ctx.sendToClient).toHaveBeenCalledWith('dialogue_score_change', {
        delta: 2,
        newScore: 10,
        reason: 'was kind',
        newSocialType: 'acquaintance',
      });
    });

    it('should call adjustRelationshipScore and send DIALOGUE_SCORE_CHANGE for negative delta', async () => {
      mockAdjustRelationshipScore.mockResolvedValue({
        botId: 'bot-uuid',
        userId: 'user-uuid',
        score: -3,
        socialType: 'rival',
        isWorker: false,
        hiredAt: null,
        updatedAt: new Date(),
      });
      const ctx = mockContext();
      const t = adjustRelationshipTool(ctx);

      const result = await t.execute!({ delta: -5, reason: 'insulted' }, {
        toolCallId: 'tc-2',
        messages: [],
      });

      expect(result).toBe('Отношение изменено на -5');
      expect(mockAdjustRelationshipScore).toHaveBeenCalledWith(ctx.db, 'bot-uuid', 'user-uuid', -5);
      expect(ctx.sendToClient).toHaveBeenCalledWith('dialogue_score_change', expect.objectContaining({
        delta: -5,
        reason: 'insulted',
      }));
    });

    it('should update cumulativeDelta on success', async () => {
      const ctx = mockContext();
      const t = adjustRelationshipTool(ctx);

      await t.execute!({ delta: 2, reason: 'test' }, { toolCallId: 'tc-3', messages: [] });

      expect(ctx.cumulativeDelta).toBe(2);
    });

    it('should reject when cumulative delta exceeds positive cap (+5)', async () => {
      const ctx = mockContext({ cumulativeDelta: 3 });
      const t = adjustRelationshipTool(ctx);

      const result = await t.execute!({ delta: 3, reason: 'too much' }, {
        toolCallId: 'tc-4',
        messages: [],
      });

      expect(result).toBe('Превышен лимит изменений за один ход');
      expect(mockAdjustRelationshipScore).not.toHaveBeenCalled();
      expect(ctx.cumulativeDelta).toBe(3); // unchanged
    });

    it('should reject when cumulative delta exceeds negative cap (-10)', async () => {
      const ctx = mockContext({ cumulativeDelta: -6 });
      const t = adjustRelationshipTool(ctx);

      const result = await t.execute!({ delta: -5, reason: 'too much' }, {
        toolCallId: 'tc-5',
        messages: [],
      });

      expect(result).toBe('Превышен лимит изменений за один ход');
      expect(mockAdjustRelationshipScore).not.toHaveBeenCalled();
      expect(ctx.cumulativeDelta).toBe(-6); // unchanged
    });

    it('should return error string on DB error without throwing', async () => {
      mockAdjustRelationshipScore.mockRejectedValue(new Error('DB connection lost'));
      const ctx = mockContext();
      const t = adjustRelationshipTool(ctx);

      const result = await t.execute!({ delta: 1, reason: 'test' }, {
        toolCallId: 'tc-6',
        messages: [],
      });

      expect(result).toBe('Не удалось изменить отношение');
    });

    it('should attempt mood update with correct direction for negative delta', async () => {
      const ctx = mockContext();
      const t = adjustRelationshipTool(ctx);

      await t.execute!({ delta: -3, reason: 'rude' }, { toolCallId: 'tc-7', messages: [] });

      // Mood update goes through db.update chain
      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        mood: 'annoyed',
      }));
    });

    it('should attempt mood update with happy for positive delta', async () => {
      const ctx = mockContext();
      const t = adjustRelationshipTool(ctx);

      await t.execute!({ delta: 2, reason: 'kind' }, { toolCallId: 'tc-8', messages: [] });

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        mood: 'happy',
      }));
    });
  });
});

describe('create_memory tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Zod schema validation', () => {
    it('should accept valid content and importance=5', () => {
      const result = createMemorySchema.safeParse({ content: 'Player was friendly', importance: 5 });
      expect(result.success).toBe(true);
    });

    it('should reject importance=0 (min is 1)', () => {
      const result = createMemorySchema.safeParse({ content: 'test', importance: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject importance=11 (max is 10)', () => {
      const result = createMemorySchema.safeParse({ content: 'test', importance: 11 });
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const result = createMemorySchema.safeParse({ content: '', importance: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('execute function', () => {
    it('should call createMemory and return confirmation string', async () => {
      const ctx = mockContext();
      const t = createMemoryTool(ctx);

      const result = await t.execute!(
        { content: 'Player shared a story', importance: 7 },
        { toolCallId: 'tc-10', messages: [] }
      );

      expect(result).toBe('Воспоминание записано');
      expect(mockCreateMemory).toHaveBeenCalledWith(ctx.db, {
        botId: 'bot-uuid',
        userId: 'user-uuid',
        content: 'Player shared a story',
        importance: 7,
        type: 'tool',
        dialogueSessionId: undefined,
      });
    });

    it('should return error string on DB error without throwing', async () => {
      mockCreateMemory.mockRejectedValue(new Error('DB error'));
      const ctx = mockContext();
      const t = createMemoryTool(ctx);

      const result = await t.execute!(
        { content: 'test', importance: 5 },
        { toolCallId: 'tc-11', messages: [] }
      );

      expect(result).toBe('Не удалось записать воспоминание');
    });
  });
});

describe('end_conversation tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Zod schema validation', () => {
    it('should accept valid reason with defaults', () => {
      const result = endConversationSchema.safeParse({ reason: 'I am offended' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.setIgnore).toBe(false);
        expect(result.data.ignoreDurationMinutes).toBe(60);
      }
    });

    it('should reject ignoreDurationMinutes=4 (min is 5)', () => {
      const result = endConversationSchema.safeParse({
        reason: 'test',
        setIgnore: true,
        ignoreDurationMinutes: 4,
      });
      expect(result.success).toBe(false);
    });

    it('should reject ignoreDurationMinutes=1441 (max is 1440)', () => {
      const result = endConversationSchema.safeParse({
        reason: 'test',
        setIgnore: true,
        ignoreDurationMinutes: 1441,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('execute function', () => {
    it('should set context.endRequested to true', async () => {
      const ctx = mockContext();
      const t = endConversationTool(ctx);

      await t.execute!(
        { reason: 'goodbye', setIgnore: false, ignoreDurationMinutes: 60 },
        { toolCallId: 'tc-20', messages: [] }
      );

      expect(ctx.endRequested).toBe(true);
    });

    it('should NOT call createPlayerStatus when setIgnore is false', async () => {
      const ctx = mockContext();
      const t = endConversationTool(ctx);

      await t.execute!(
        { reason: 'tired', setIgnore: false, ignoreDurationMinutes: 60 },
        { toolCallId: 'tc-21', messages: [] }
      );

      expect(mockCreatePlayerStatus).not.toHaveBeenCalled();
    });

    it('should call createPlayerStatus when setIgnore is true', async () => {
      const ctx = mockContext();
      const t = endConversationTool(ctx);

      await t.execute!(
        { reason: 'very rude', setIgnore: true, ignoreDurationMinutes: 30 },
        { toolCallId: 'tc-22', messages: [] }
      );

      expect(mockCreatePlayerStatus).toHaveBeenCalledWith(
        ctx.db,
        'bot-uuid',
        'user-uuid',
        'ignore',
        'very rude',
        30
      );
    });

    it('should NOT call context.endConversation (deferred to ChunkRoom)', async () => {
      const ctx = mockContext();
      const t = endConversationTool(ctx);

      await t.execute!(
        { reason: 'goodbye', setIgnore: false, ignoreDurationMinutes: 60 },
        { toolCallId: 'tc-23', messages: [] }
      );

      expect(ctx.endConversation).not.toHaveBeenCalled();
    });

    it('should keep endRequested=true even on DB error', async () => {
      mockCreatePlayerStatus.mockRejectedValue(new Error('DB error'));
      const ctx = mockContext();
      const t = endConversationTool(ctx);

      const result = await t.execute!(
        { reason: 'angry', setIgnore: true, ignoreDurationMinutes: 60 },
        { toolCallId: 'tc-24', messages: [] }
      );

      expect(ctx.endRequested).toBe(true);
      expect(typeof result).toBe('string');
    });

    it('should return farewell string', async () => {
      const ctx = mockContext();
      const t = endConversationTool(ctx);

      const result = await t.execute!(
        { reason: 'goodbye', setIgnore: false, ignoreDurationMinutes: 60 },
        { toolCallId: 'tc-25', messages: [] }
      );

      expect(result).toBe('Разговор завершён');
    });
  });
});

describe('express_emotion tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Zod schema validation', () => {
    it('should accept all 12 valid emotion values', () => {
      for (const emotion of EMOTIONS) {
        const result = expressEmotionSchema.safeParse({ emotion, intensity: 3 });
        expect(result.success).toBe(true);
      }
    });

    it('should reject unknown emotion "jealous"', () => {
      const result = expressEmotionSchema.safeParse({ emotion: 'jealous', intensity: 3 });
      expect(result.success).toBe(false);
    });

    it('should reject intensity=0 (min is 1)', () => {
      const result = expressEmotionSchema.safeParse({ emotion: 'happy', intensity: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject intensity=6 (max is 5)', () => {
      const result = expressEmotionSchema.safeParse({ emotion: 'happy', intensity: 6 });
      expect(result.success).toBe(false);
    });
  });

  describe('execute function', () => {
    it('should send DIALOGUE_EMOTION to client with correct payload', async () => {
      const ctx = mockContext();
      const t = expressEmotionTool(ctx);

      const result = await t.execute!(
        { emotion: 'happy', intensity: 3 },
        { toolCallId: 'tc-30', messages: [] }
      );

      expect(result).toBe('Эмоция выражена');
      expect(ctx.sendToClient).toHaveBeenCalledWith('dialogue_emotion', {
        emotion: 'happy',
        intensity: 3,
      });
    });

    it('should not make any DB calls', async () => {
      const ctx = mockContext();
      const t = expressEmotionTool(ctx);

      await t.execute!(
        { emotion: 'sad', intensity: 2 },
        { toolCallId: 'tc-31', messages: [] }
      );

      expect(mockAdjustRelationshipScore).not.toHaveBeenCalled();
      expect(mockCreateMemory).not.toHaveBeenCalled();
      expect(mockCreatePlayerStatus).not.toHaveBeenCalled();
    });
  });
});
