import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { RelationshipData } from '@nookstead/shared';

// Mock the db module before importing the service
jest.mock('@nookstead/db', () => ({
  updateRelationship: jest.fn(),
}));

import {
  validateAction,
  processAction,
  evaluateProgression,
  getAvailableActions,
  SCORE_DELTAS,
  RELATIONSHIP_THRESHOLDS,
  FATIGUE_DEFAULTS,
} from './RelationshipService.js';
import { updateRelationship } from '@nookstead/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdateRelationship = updateRelationship as jest.Mock<any>;

function makeRelationship(
  overrides: Partial<RelationshipData> = {}
): RelationshipData {
  return {
    botId: 'bot-1',
    userId: 'user-1',
    socialType: 'acquaintance',
    isWorker: false,
    score: 15,
    hiredAt: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockRow(rel: RelationshipData) {
  return {
    id: 'row-1',
    botId: rel.botId,
    userId: rel.userId,
    socialType: rel.socialType,
    isWorker: rel.isWorker,
    score: rel.score,
    hiredAt: rel.hiredAt ? new Date(rel.hiredAt) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('validateAction', () => {
  it('rejects give_gift as stranger', () => {
    const rel = makeRelationship({ socialType: 'stranger' });
    expect(validateAction({ type: 'give_gift', params: { giftId: 'flowers' } }, rel)).not.toBeNull();
  });

  it('allows give_gift as acquaintance', () => {
    const rel = makeRelationship({ socialType: 'acquaintance' });
    expect(validateAction({ type: 'give_gift', params: { giftId: 'flowers' } }, rel)).toBeNull();
  });

  it('rejects hire as acquaintance', () => {
    const rel = makeRelationship({ socialType: 'acquaintance' });
    expect(validateAction({ type: 'hire' }, rel)).not.toBeNull();
  });

  it('allows hire as friend', () => {
    const rel = makeRelationship({ socialType: 'friend' });
    expect(validateAction({ type: 'hire' }, rel)).toBeNull();
  });

  it('rejects hire when already isWorker', () => {
    const rel = makeRelationship({ socialType: 'friend', isWorker: true });
    expect(validateAction({ type: 'hire' }, rel)).not.toBeNull();
  });

  it('rejects dismiss when not worker', () => {
    const rel = makeRelationship({ isWorker: false });
    expect(validateAction({ type: 'dismiss' }, rel)).not.toBeNull();
  });

  it('allows dismiss when isWorker=true', () => {
    const rel = makeRelationship({ isWorker: true });
    expect(validateAction({ type: 'dismiss' }, rel)).toBeNull();
  });

  it('rejects ask_about as friend', () => {
    const rel = makeRelationship({ socialType: 'friend' });
    expect(validateAction({ type: 'ask_about', params: { topic: 'test' } }, rel)).not.toBeNull();
  });

  it('allows ask_about as close_friend', () => {
    const rel = makeRelationship({ socialType: 'close_friend' });
    expect(validateAction({ type: 'ask_about', params: { topic: 'test' } }, rel)).toBeNull();
  });

  it('rejects any action as rival', () => {
    const rel = makeRelationship({ socialType: 'rival' });
    expect(validateAction({ type: 'give_gift', params: { giftId: 'flowers' } }, rel)).not.toBeNull();
  });
});

describe('processAction — score increments', () => {
  const mockDb = {} as Parameters<typeof processAction>[0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('give_gift with flowers increments score by 3', async () => {
    const rel = makeRelationship({ score: 15 });
    mockUpdateRelationship.mockResolvedValue(makeMockRow({ ...rel, score: 18 }) as never);

    await processAction(mockDb, 'bot-1', 'user-1', { type: 'give_gift', params: { giftId: 'flowers' } }, rel, 'Player');
    expect(mockUpdateRelationship).toHaveBeenCalledWith(mockDb, 'bot-1', 'user-1', { score: 18 });
  });

  it('give_gift with silver_ring increments score by 7', async () => {
    const rel = makeRelationship({ score: 20 });
    mockUpdateRelationship.mockResolvedValue(makeMockRow({ ...rel, score: 27 }) as never);

    await processAction(mockDb, 'bot-1', 'user-1', { type: 'give_gift', params: { giftId: 'silver_ring' } }, rel, 'Player');
    expect(mockUpdateRelationship).toHaveBeenCalledWith(mockDb, 'bot-1', 'user-1', { score: 27 });
  });

  it('hire increments score by 3 and sets isWorker=true', async () => {
    const rel = makeRelationship({ socialType: 'friend', score: 35 });
    mockUpdateRelationship.mockResolvedValue(makeMockRow({ ...rel, score: 38, isWorker: true }) as never);

    await processAction(mockDb, 'bot-1', 'user-1', { type: 'hire' }, rel, 'Player');
    expect(mockUpdateRelationship).toHaveBeenCalledWith(
      mockDb, 'bot-1', 'user-1',
      expect.objectContaining({ isWorker: true, score: 38 })
    );
  });

  it('dismiss decrements score by 5 and sets isWorker=false', async () => {
    const rel = makeRelationship({ socialType: 'friend', isWorker: true, score: 35 });
    mockUpdateRelationship.mockResolvedValue(makeMockRow({ ...rel, score: 30, isWorker: false }) as never);

    await processAction(mockDb, 'bot-1', 'user-1', { type: 'dismiss' }, rel, 'Player');
    expect(mockUpdateRelationship).toHaveBeenCalledWith(
      mockDb, 'bot-1', 'user-1',
      expect.objectContaining({ isWorker: false, score: 30 })
    );
  });

  it('invalid give_gift as stranger returns success=false, no DB call', async () => {
    const rel = makeRelationship({ socialType: 'stranger' });
    const result = await processAction(mockDb, 'bot-1', 'user-1', { type: 'give_gift', params: { giftId: 'flowers' } }, rel, 'Player');
    expect(result.success).toBe(false);
    expect(mockUpdateRelationship).not.toHaveBeenCalled();
  });
});

describe('processAction — promptInjection', () => {
  const mockDb = {} as Parameters<typeof processAction>[0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('give_gift injection contains the gift label', async () => {
    const rel = makeRelationship({ score: 15 });
    mockUpdateRelationship.mockResolvedValue(makeMockRow({ ...rel, score: 18 }) as never);

    const result = await processAction(mockDb, 'bot-1', 'user-1', { type: 'give_gift', params: { giftId: 'flowers' } }, rel, 'Player');
    expect(result.success).toBe(true);
    expect(result.promptInjection).toContain('Цветы');
  });

  it('hire injection contains player name', async () => {
    const rel = makeRelationship({ socialType: 'friend', score: 35 });
    mockUpdateRelationship.mockResolvedValue(makeMockRow({ ...rel, score: 38, isWorker: true }) as never);

    const result = await processAction(mockDb, 'bot-1', 'user-1', { type: 'hire' }, rel, 'TestPlayer');
    expect(result.promptInjection).toContain('TestPlayer');
  });

  it('ask_about injection contains the topic', async () => {
    const rel = makeRelationship({ socialType: 'close_friend', score: 65 });
    const result = await processAction(mockDb, 'bot-1', 'user-1', { type: 'ask_about', params: { topic: 'рыбалка' } }, rel, 'Player');
    expect(result.promptInjection).toContain('рыбалка');
  });

  it('dismiss injection is non-empty', async () => {
    const rel = makeRelationship({ isWorker: true, score: 35 });
    mockUpdateRelationship.mockResolvedValue(makeMockRow({ ...rel, score: 30, isWorker: false }) as never);

    const result = await processAction(mockDb, 'bot-1', 'user-1', { type: 'dismiss' }, rel, 'Player');
    expect(result.promptInjection).toBeTruthy();
  });
});

describe('processAction — return shape', () => {
  const mockDb = {} as Parameters<typeof processAction>[0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successful give_gift has updatedRelationship', async () => {
    const rel = makeRelationship({ score: 15 });
    mockUpdateRelationship.mockResolvedValue(makeMockRow({ ...rel, score: 18 }) as never);

    const result = await processAction(mockDb, 'bot-1', 'user-1', { type: 'give_gift', params: { giftId: 'flowers' } }, rel, 'Player');
    expect(result.success).toBe(true);
    expect(result.updatedRelationship).toBeDefined();
  });

  it('failed action has non-empty message', async () => {
    const rel = makeRelationship({ socialType: 'stranger' });
    const result = await processAction(mockDb, 'bot-1', 'user-1', { type: 'give_gift', params: { giftId: 'flowers' } }, rel, 'Player');
    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
  });
});

describe('evaluateProgression — threshold boundaries', () => {
  it('score=9 → stranger', () => {
    expect(evaluateProgression(makeRelationship({ score: 9 }))).toBe('stranger');
  });

  it('score=10 → acquaintance', () => {
    expect(evaluateProgression(makeRelationship({ score: 10 }))).toBe('acquaintance');
  });

  it('score=29 → acquaintance', () => {
    expect(evaluateProgression(makeRelationship({ score: 29 }))).toBe('acquaintance');
  });

  it('score=30 → friend', () => {
    expect(evaluateProgression(makeRelationship({ score: 30 }))).toBe('friend');
  });

  it('score=59 → friend', () => {
    expect(evaluateProgression(makeRelationship({ score: 59 }))).toBe('friend');
  });

  it('score=60 → close_friend', () => {
    expect(evaluateProgression(makeRelationship({ score: 60 }))).toBe('close_friend');
  });

  it('score=89 → close_friend', () => {
    expect(evaluateProgression(makeRelationship({ score: 89 }))).toBe('close_friend');
  });

  it('score=90 with romanceable → romantic', () => {
    expect(evaluateProgression(makeRelationship({ score: 90 }), ['romanceable'])).toBe('romantic');
  });

  it('score=90 without romanceable → close_friend (cap)', () => {
    expect(evaluateProgression(makeRelationship({ score: 90 }))).toBe('close_friend');
  });

  it('score=-1 → rival', () => {
    expect(evaluateProgression(makeRelationship({ score: -1 }))).toBe('rival');
  });

  it('score=-10 → rival', () => {
    expect(evaluateProgression(makeRelationship({ score: -10 }))).toBe('rival');
  });
});

describe('getAvailableActions', () => {
  it('stranger → []', () => {
    expect(getAvailableActions(makeRelationship({ socialType: 'stranger' }))).toEqual([]);
  });

  it('rival → []', () => {
    expect(getAvailableActions(makeRelationship({ socialType: 'rival' }))).toEqual([]);
  });

  it('acquaintance + isWorker=false → [give_gift]', () => {
    expect(getAvailableActions(makeRelationship({ socialType: 'acquaintance', isWorker: false }))).toEqual(['give_gift']);
  });

  it('acquaintance + isWorker=true → [give_gift, dismiss]', () => {
    expect(getAvailableActions(makeRelationship({ socialType: 'acquaintance', isWorker: true }))).toEqual(['give_gift', 'dismiss']);
  });

  it('friend + isWorker=false → contains hire, not dismiss', () => {
    const result = getAvailableActions(makeRelationship({ socialType: 'friend', isWorker: false }));
    expect(result).toContain('hire');
    expect(result).not.toContain('dismiss');
    expect(result).toContain('give_gift');
  });

  it('friend + isWorker=true → contains dismiss, not hire', () => {
    const result = getAvailableActions(makeRelationship({ socialType: 'friend', isWorker: true }));
    expect(result).toContain('dismiss');
    expect(result).not.toContain('hire');
    expect(result).toContain('give_gift');
  });

  it('close_friend + isWorker=false → contains hire, give_gift, ask_about', () => {
    const result = getAvailableActions(makeRelationship({ socialType: 'close_friend', isWorker: false }));
    expect(result).toContain('hire');
    expect(result).toContain('give_gift');
    expect(result).toContain('ask_about');
  });

  it('close_friend + isWorker=true → contains dismiss, give_gift, ask_about', () => {
    const result = getAvailableActions(makeRelationship({ socialType: 'close_friend', isWorker: true }));
    expect(result).toContain('dismiss');
    expect(result).not.toContain('hire');
    expect(result).toContain('give_gift');
    expect(result).toContain('ask_about');
  });
});

describe('exported constants', () => {
  it('SCORE_DELTAS has hire and dismiss values', () => {
    expect(SCORE_DELTAS.hire).toBe(3);
    expect(SCORE_DELTAS.dismiss).toBe(-5);
  });

  it('should not include normalDialogue in SCORE_DELTAS', () => {
    expect('normalDialogue' in SCORE_DELTAS).toBe(false);
  });

  it('RELATIONSHIP_THRESHOLDS has expected values', () => {
    expect(RELATIONSHIP_THRESHOLDS.acquaintance).toBe(10);
    expect(RELATIONSHIP_THRESHOLDS.friend).toBe(30);
    expect(RELATIONSHIP_THRESHOLDS.close_friend).toBe(60);
    expect(RELATIONSHIP_THRESHOLDS.romantic).toBe(90);
  });

  it('FATIGUE_DEFAULTS has expected values', () => {
    expect(FATIGUE_DEFAULTS.maxTurnsBeforeTired).toBe(8);
    expect(FATIGUE_DEFAULTS.maxTurnsBeforeEnd).toBe(12);
  });
});
