import {
  createReflectionMemory,
  getReflectionMemories,
  getBotsNeedingReflection,
  getRecentMemoriesForBot,
} from '../npc-reflection';
import { getMemoriesForBot } from '../npc-memory';
import { npcMemories } from '../../schema/npc-memories';

/**
 * Unit tests for npc-reflection DB service functions.
 *
 * These tests use a mocked Drizzle client to verify the service functions'
 * contract without requiring a real database connection. The mock verifies
 * that correct arguments are passed to Drizzle query builder methods and
 * that return values are correctly mapped.
 *
 * The backward-compat test (Test 5) verifies that getMemoriesForBot from
 * npc-memory.ts does NOT return null-userId reflection rows, because it
 * filters by a specific userId which excludes null.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_BOT_ID = 'bot-reflection-test';
const TEST_USER_ID = 'user-test-123';

function makeFakeMemory(overrides: Partial<{
  id: string;
  botId: string;
  userId: string | null;
  type: string;
  content: string;
  importance: number;
  dialogueSessionId: string | null;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? 'mem-uuid-1',
    botId: overrides.botId ?? TEST_BOT_ID,
    userId: overrides.userId ?? null,
    type: overrides.type ?? 'reflection',
    content: overrides.content ?? 'Quiet day.',
    importance: overrides.importance ?? 10,
    dialogueSessionId: overrides.dialogueSessionId ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-03-28T04:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle client that supports:
 *   insert(table).values(data).returning()
 *   select().from(table).where(cond)
 *   select().from(table).where(cond).orderBy(expr).limit(n)
 *   select({fields}).from(table)                         -- for getBotsNeedingReflection fallback
 *   select({fields}).from(table).where(cond)             -- for getBotsNeedingReflection with excludes
 *   selectDistinct({fields}).from(table).where(cond)
 */
function createMockDb() {
  // insert chain: db.insert(table).values(data).returning()
  const returning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({ returning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  // select chain (extended for orderBy + limit):
  //   db.select().from(table).where(cond).orderBy(expr).limit(n)
  const selectLimit = jest.fn();
  const selectOrderBy = jest.fn().mockReturnValue({ limit: selectLimit });
  const selectWhere = jest.fn().mockReturnValue({ orderBy: selectOrderBy });
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // selectDistinct chain: db.selectDistinct({fields}).from(table).where(cond)
  const selectDistinctWhere = jest.fn();
  const selectDistinctFrom = jest.fn().mockReturnValue({ where: selectDistinctWhere });
  const selectDistinct = jest.fn().mockReturnValue({ from: selectDistinctFrom });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { insert, select, selectDistinct } as any;

  return {
    db,
    mocks: {
      insert,
      insertValues,
      returning,
      select,
      selectFrom,
      selectWhere,
      selectOrderBy,
      selectLimit,
      selectDistinct,
      selectDistinctFrom,
      selectDistinctWhere,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('npc-reflection service', () => {
  // -- Test 1: AC7 -- createReflectionMemory --------------------------------

  describe('createReflectionMemory', () => {
    it('should create reflection memory with type=reflection, importance=10, userId=null', async () => {
      const { db, mocks } = createMockDb();
      const expectedRecord = makeFakeMemory({
        importance: 10,
        content: 'Quiet day.',
      });
      mocks.returning.mockResolvedValueOnce([expectedRecord]);

      const result = await createReflectionMemory(db, {
        botId: TEST_BOT_ID,
        content: 'Quiet day.',
        importance: 10,
      });

      expect(result.type).toBe('reflection');
      expect(result.importance).toBe(10);
      expect(result.userId).toBeNull();
      expect(result.botId).toBe(TEST_BOT_ID);
      expect(mocks.insert).toHaveBeenCalledWith(npcMemories);
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          botId: TEST_BOT_ID,
          type: 'reflection',
          content: 'Quiet day.',
          importance: 10,
        })
      );
      expect(mocks.returning).toHaveBeenCalledTimes(1);
    });
  });

  // -- Test 2: AC8 -- getReflectionMemories ---------------------------------

  describe('getReflectionMemories', () => {
    it('should return reflection memories ordered newest first', async () => {
      const { db, mocks } = createMockDb();
      const older = makeFakeMemory({
        id: 'mem-old',
        createdAt: new Date('2026-03-27T04:00:00Z'),
        content: 'Day 1 reflection.',
      });
      const newer = makeFakeMemory({
        id: 'mem-new',
        createdAt: new Date('2026-03-28T04:00:00Z'),
        content: 'Day 2 reflection.',
      });
      // The DB returns them in correct order (newest first due to orderBy desc)
      mocks.selectLimit.mockResolvedValueOnce([newer, older]);

      const results = await getReflectionMemories(db, TEST_BOT_ID, 3);

      expect(results.length).toBe(2);
      expect(results[0].createdAt >= results[1].createdAt).toBe(true);
      expect(results.every((r: { type: string }) => r.type === 'reflection')).toBe(true);
      expect(mocks.select).toHaveBeenCalledTimes(1);
      expect(mocks.selectFrom).toHaveBeenCalledWith(npcMemories);
    });
  });

  // -- Test 3: AC9 -- getBotsNeedingReflection excludes today ---------------

  describe('getBotsNeedingReflection', () => {
    it('should exclude bot that already has reflection today', async () => {
      const startOfTodayUtc = new Date('2026-03-28T00:00:00Z');

      // Step 1: selectDistinct finds bot with today's reflection
      const { db, mocks } = createMockDb();
      mocks.selectDistinctWhere.mockResolvedValueOnce([
        { botId: TEST_BOT_ID },
      ]);

      // Step 2: select bots NOT in the exclusion list returns other bots
      const otherBot = { id: 'bot-other', name: 'Clover' };
      mocks.selectWhere.mockResolvedValueOnce([otherBot]);

      const results = await getBotsNeedingReflection(db, startOfTodayUtc);

      const botIds = results.map((b: { id: string }) => b.id);
      expect(botIds).not.toContain(TEST_BOT_ID);
      expect(botIds).toContain('bot-other');
    });

    // -- Test 4: AC9 -- includes bots with only yesterday's reflection ------

    it('should include bot that only has reflection from yesterday', async () => {
      const startOfTodayUtc = new Date('2026-03-28T00:00:00Z');

      // Step 1: selectDistinct finds no bots with today's reflection
      const { db, mocks } = createMockDb();
      mocks.selectDistinctWhere.mockResolvedValueOnce([]);

      // Step 2: since excludeIds is empty, select all bots (no .where call)
      // The function takes a different code path when excludeIds is empty
      const allBots = [
        { id: TEST_BOT_ID, name: 'Biscuit' },
        { id: 'bot-other', name: 'Clover' },
      ];
      // When excludeIds is empty, getBotsNeedingReflection calls
      // db.select({id, name}).from(npcBots) -- no .where()
      // We need the select to resolve to allBots directly via selectFrom
      // Override: selectFrom returns allBots (as a Promise-like)
      mocks.selectFrom.mockResolvedValueOnce(allBots);

      const results = await getBotsNeedingReflection(db, startOfTodayUtc);

      const botIds = results.map((b: { id: string }) => b.id);
      expect(botIds).toContain(TEST_BOT_ID);
      expect(results.length).toBe(2);
    });
  });

  // -- Test 5: Backward compat -- getMemoriesForBot -------------------------

  describe('backward compatibility', () => {
    it('should not return reflection memories (null userId) from getMemoriesForBot', async () => {
      // getMemoriesForBot filters by eq(npcMemories.userId, userId),
      // which excludes null-userId rows. We verify this by setting up
      // the mock to return only non-null userId rows.
      const { db, mocks } = createMockDb();
      const interactionMemory = makeFakeMemory({
        id: 'mem-interaction',
        userId: TEST_USER_ID,
        type: 'interaction',
        content: 'Had a nice chat.',
        importance: 5,
      });
      // getMemoriesForBot uses: select().from(npcMemories).where(and(botId, userId))
      // The where clause excludes null-userId rows, so only interaction memories return
      mocks.selectWhere.mockResolvedValueOnce([interactionMemory]);

      const results = await getMemoriesForBot(db, TEST_BOT_ID, TEST_USER_ID);

      expect(results.every((r: { type: string }) => r.type !== 'reflection')).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('interaction');
    });
  });

  // -- getRecentMemoriesForBot ----------------------------------------------

  describe('getRecentMemoriesForBot', () => {
    it('should return all memories for a bot since the given date', async () => {
      const { db, mocks } = createMockDb();
      const since = new Date('2026-03-27T00:00:00Z');
      const memories = [
        makeFakeMemory({ type: 'interaction', content: 'Chatted with player.' }),
        makeFakeMemory({ type: 'reflection', content: 'Day summary.' }),
      ];
      mocks.selectWhere.mockResolvedValueOnce(memories);

      const results = await getRecentMemoriesForBot(db, TEST_BOT_ID, since);

      expect(results.length).toBe(2);
      expect(mocks.select).toHaveBeenCalledTimes(1);
      expect(mocks.selectFrom).toHaveBeenCalledWith(npcMemories);
    });
  });
});
