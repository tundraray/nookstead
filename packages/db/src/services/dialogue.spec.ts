import {
  createDialogueSession,
  endDialogueSession,
  addDialogueMessage,
  getRecentDialogueHistory,
  getDialogueSessionMessages,
} from './dialogue';
import { dialogueSessions } from '../schema/dialogue-sessions';
import { dialogueMessages } from '../schema/dialogue-messages';

/**
 * Unit tests for dialogue DB service functions.
 *
 * Uses the mocked Drizzle client pattern established in npc-bot.spec.ts.
 * The mock verifies that correct arguments are passed to Drizzle query
 * builder methods and that return values are correctly mapped.
 */

/** Helper: create a mock Drizzle client supporting all chains used by dialogue.ts */
function createMockDb() {
  // select chain (extended for innerJoin + orderBy + limit):
  //   db.select().from(table).innerJoin(table, cond).where(cond).orderBy(expr).limit(n)
  //   db.select().from(table).where(cond).orderBy(expr)
  const limit = jest.fn();
  const orderBy = jest.fn().mockReturnValue({ limit });
  const selectWhere = jest.fn().mockReturnValue({ orderBy });
  const innerJoin = jest.fn().mockReturnValue({ where: selectWhere });
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere, innerJoin });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // insert chain: db.insert(table).values(data).returning()
  const returning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({ returning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  // update chain: db.update(table).set(data).where(condition)
  const updateWhere = jest.fn();
  const set = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { insert, select, update } as any;

  return {
    db,
    mocks: {
      insert,
      insertValues,
      returning,
      select,
      selectFrom,
      selectWhere,
      innerJoin,
      orderBy,
      limit,
      update,
      set,
      updateWhere,
    },
  };
}

describe('DialogueRepository', () => {
  // -- createDialogueSession ---------------------------------------------------

  describe('createDialogueSession', () => {
    it('inserts a session record and returns it', async () => {
      const { db, mocks } = createMockDb();
      const fakeSession = {
        id: 'session-uuid',
        botId: 'bot-id',
        playerId: 'player-session-id',
        userId: 'user-id',
        startedAt: new Date('2026-01-15T10:00:00Z'),
        endedAt: null,
      };
      mocks.returning.mockResolvedValueOnce([fakeSession]);

      const result = await createDialogueSession(db, {
        botId: 'bot-id',
        playerId: 'player-session-id',
        userId: 'user-id',
      });

      expect(result).toEqual(fakeSession);
      expect(mocks.insert).toHaveBeenCalledWith(dialogueSessions);
      expect(mocks.insertValues).toHaveBeenCalledWith({
        botId: 'bot-id',
        playerId: 'player-session-id',
        userId: 'user-id',
      });
      expect(mocks.returning).toHaveBeenCalledTimes(1);
    });

    it('throws when insert returns no rows', async () => {
      const { db, mocks } = createMockDb();
      mocks.returning.mockResolvedValueOnce([]);

      await expect(
        createDialogueSession(db, {
          botId: 'bot-id',
          playerId: 'player-session-id',
        })
      ).rejects.toThrow('insert returned no rows');
    });
  });

  // -- endDialogueSession ------------------------------------------------------

  describe('endDialogueSession', () => {
    it('updates endedAt for the given sessionId', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateWhere.mockResolvedValueOnce([]);

      await endDialogueSession(db, 'session-uuid');

      expect(mocks.update).toHaveBeenCalledTimes(1);
      expect(mocks.update).toHaveBeenCalledWith(dialogueSessions);
      expect(mocks.set).toHaveBeenCalledWith(
        expect.objectContaining({ endedAt: expect.any(Date) })
      );
    });
  });

  // -- addDialogueMessage ------------------------------------------------------

  describe('addDialogueMessage', () => {
    it('inserts a message record and returns it', async () => {
      const { db, mocks } = createMockDb();
      const fakeMsg = {
        id: 'msg-uuid',
        sessionId: 'session-uuid',
        role: 'user',
        content: 'Hello NPC',
        createdAt: new Date('2026-01-15T10:05:00Z'),
      };
      mocks.returning.mockResolvedValueOnce([fakeMsg]);

      const result = await addDialogueMessage(db, {
        sessionId: 'session-uuid',
        role: 'user',
        content: 'Hello NPC',
      });

      expect(result).toEqual(fakeMsg);
      expect(mocks.insert).toHaveBeenCalledWith(dialogueMessages);
      expect(mocks.insertValues).toHaveBeenCalledWith({
        sessionId: 'session-uuid',
        role: 'user',
        content: 'Hello NPC',
      });
      expect(mocks.returning).toHaveBeenCalledTimes(1);
    });

    it('throws when insert returns no rows', async () => {
      const { db, mocks } = createMockDb();
      mocks.returning.mockResolvedValueOnce([]);

      await expect(
        addDialogueMessage(db, {
          sessionId: 'session-id',
          role: 'user',
          content: 'test',
        })
      ).rejects.toThrow('insert returned no rows');
    });
  });

  // -- getRecentDialogueHistory ------------------------------------------------

  describe('getRecentDialogueHistory', () => {
    it('returns messages for bot-user pair in chronological order', async () => {
      const { db, mocks } = createMockDb();
      // DB returns desc order (most recent first) -- function reverses to chronological
      const dbRows = [
        {
          role: 'assistant',
          content: 'How can I help?',
          createdAt: new Date('2026-01-15T10:01:00Z'),
        },
        {
          role: 'user',
          content: 'Hello',
          createdAt: new Date('2026-01-15T10:00:00Z'),
        },
      ];
      mocks.limit.mockResolvedValueOnce(dbRows);

      const result = await getRecentDialogueHistory(
        db,
        'bot-id',
        'user-id',
        20
      );

      // Function reverses DB results so earliest comes first
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hello');
      expect(result[1].content).toBe('How can I help?');
      expect(mocks.select).toHaveBeenCalledTimes(1);
      expect(mocks.selectFrom).toHaveBeenCalledWith(dialogueMessages);
      expect(mocks.innerJoin).toHaveBeenCalledTimes(1);
    });

    it('respects the limit parameter', async () => {
      const { db, mocks } = createMockDb();
      mocks.limit.mockResolvedValueOnce([]);

      await getRecentDialogueHistory(db, 'bot-id', 'user-id', 5);

      expect(mocks.limit).toHaveBeenCalledWith(5);
    });
  });

  // -- getDialogueSessionMessages ----------------------------------------------

  describe('getDialogueSessionMessages', () => {
    it('returns messages for a specific session ordered by createdAt', async () => {
      const { db, mocks } = createMockDb();
      const fakeMessages = [
        {
          id: 'm1',
          sessionId: 's1',
          role: 'user',
          content: 'Hi',
          createdAt: new Date('2026-01-15T10:00:00Z'),
        },
        {
          id: 'm2',
          sessionId: 's1',
          role: 'assistant',
          content: 'Hello!',
          createdAt: new Date('2026-01-15T10:00:30Z'),
        },
      ];
      // getDialogueSessionMessages uses: select().from().where().orderBy()
      // orderBy is the terminal call here, so override default mockReturnValue
      mocks.orderBy.mockResolvedValueOnce(fakeMessages);

      const result = await getDialogueSessionMessages(db, 's1');

      expect(result).toEqual(fakeMessages);
      expect(mocks.select).toHaveBeenCalledTimes(1);
      expect(mocks.selectFrom).toHaveBeenCalledWith(dialogueMessages);
    });
  });
});
