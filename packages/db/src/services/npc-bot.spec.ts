import { createBot, loadBots, saveBotPositions } from './npc-bot';
import type { CreateBotData, BotPositionUpdate } from './npc-bot';
import { npcBots } from '../schema/npc-bots';

/**
 * Unit tests for npc-bot DB service functions.
 *
 * These tests use a mocked Drizzle client to verify the service functions'
 * contract without requiring a real database connection. The mock verifies
 * that correct arguments are passed to Drizzle query builder methods and
 * that return values are correctly mapped.
 */

/** Helper: create a mock Drizzle client with chained builder pattern */
function createMockDb() {
  // insert chain: db.insert(table).values(data).returning()
  const returning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({ returning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  // select chain: db.select().from(table).where(condition)
  const selectWhere = jest.fn();
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

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
      update,
      set,
      updateWhere,
    },
  };
}

describe('npc-bot service', () => {
  // -- createBot ---------------------------------------------------------------

  describe('createBot', () => {
    it('AC-5.1: persists bot data and returns NpcBot record with server-assigned id', async () => {
      const { db, mocks } = createMockDb();
      const expectedRecord = {
        id: 'uuid-generated-by-db',
        mapId: 'map-123',
        name: 'Biscuit',
        skin: 'scout_1',
        worldX: 80,
        worldY: 96,
        direction: 'down',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };

      mocks.returning.mockResolvedValueOnce([expectedRecord]);

      const data: CreateBotData = {
        mapId: 'map-123',
        name: 'Biscuit',
        skin: 'scout_1',
        worldX: 80,
        worldY: 96,
        direction: 'down',
      };

      const result = await createBot(db, data);

      expect(result).toEqual(expectedRecord);
      expect(mocks.insert).toHaveBeenCalledWith(npcBots);
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          mapId: 'map-123',
          name: 'Biscuit',
          skin: 'scout_1',
          worldX: 80,
          worldY: 96,
          direction: 'down',
        })
      );
      expect(mocks.returning).toHaveBeenCalledTimes(1);
    });

    it('throws when insert returns no rows', async () => {
      const { db, mocks } = createMockDb();
      mocks.returning.mockResolvedValueOnce([]);

      const data: CreateBotData = {
        mapId: 'map-456',
        name: 'Clover',
        skin: 'scout_2',
        worldX: 0,
        worldY: 0,
        direction: 'down',
      };

      await expect(createBot(db, data)).rejects.toThrow(
        'insert returned no rows'
      );
    });
  });

  // -- loadBots ----------------------------------------------------------------

  describe('loadBots', () => {
    it('AC-5.3: returns all bots for a map from the database', async () => {
      const { db, mocks } = createMockDb();
      const botRecords = [
        {
          id: 'bot-1',
          mapId: 'map-abc',
          name: 'Clover',
          skin: 'scout_2',
          worldX: 100,
          worldY: 200,
          direction: 'right',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'bot-2',
          mapId: 'map-abc',
          name: 'Fern',
          skin: 'scout_3',
          worldX: 150,
          worldY: 250,
          direction: 'left',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ];

      mocks.selectWhere.mockResolvedValueOnce(botRecords);

      const result = await loadBots(db, 'map-abc');

      expect(result).toEqual(botRecords);
      expect(result.length).toBe(2);
      expect(mocks.select).toHaveBeenCalledTimes(1);
      expect(mocks.selectFrom).toHaveBeenCalledWith(npcBots);
    });

    it('AC-5.3 edge case: returns empty array when map has no bots', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValueOnce([]);

      const result = await loadBots(db, 'map-no-bots');

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });
  });

  // -- saveBotPositions --------------------------------------------------------

  describe('saveBotPositions', () => {
    it('AC-5.2: updates worldX, worldY, direction, and updatedAt for each bot', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateWhere.mockResolvedValue(undefined);

      const positions: BotPositionUpdate[] = [
        { id: 'bot-1', worldX: 160, worldY: 224, direction: 'up' },
        { id: 'bot-2', worldX: 48, worldY: 80, direction: 'right' },
      ];

      await saveBotPositions(db, positions);

      expect(mocks.update).toHaveBeenCalledTimes(2);
      expect(mocks.update).toHaveBeenCalledWith(npcBots);
      expect(mocks.set).toHaveBeenCalledWith(
        expect.objectContaining({
          worldX: 160,
          worldY: 224,
          direction: 'up',
        })
      );
      expect(mocks.set).toHaveBeenCalledWith(
        expect.objectContaining({
          worldX: 48,
          worldY: 80,
          direction: 'right',
        })
      );
    });

    it('AC-5.2 edge: returns without DB calls when positions array is empty', async () => {
      const { db, mocks } = createMockDb();

      await saveBotPositions(db, []);

      expect(mocks.update).not.toHaveBeenCalled();
    });
  });
});
