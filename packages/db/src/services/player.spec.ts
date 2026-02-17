import { savePosition, loadPosition } from './player';
import type { SavePositionData } from './player';
import { playerPositions } from '../schema/player-positions';

/**
 * Unit tests for PlayerPositionService.
 *
 * These tests use a mocked Drizzle client to verify the service functions'
 * contract without requiring a real database connection. The mock verifies
 * that correct arguments are passed to Drizzle query builder methods and
 * that return values are correctly mapped.
 */

/** Helper: create a mock Drizzle client with chained builder pattern */
function createMockDb() {
  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const insertValues = jest.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  const selectLimit = jest.fn();
  const selectWhere = jest.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  const db = { insert, select } as any;

  return {
    db,
    mocks: {
      insert,
      insertValues,
      onConflictDoUpdate,
      select,
      selectFrom,
      selectWhere,
      selectLimit,
    },
  };
}

describe('PlayerPositionService', () => {
  describe('savePosition', () => {
    it('should create new record for new user', async () => {
      const { db, mocks } = createMockDb();
      const data: SavePositionData = {
        userId: 'user-001',
        worldX: 100.5,
        worldY: 200.3,
        chunkId: 'city:capital',
        direction: 'right',
      };

      await savePosition(db, data);

      expect(mocks.insert).toHaveBeenCalledWith(playerPositions);
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          worldX: 100.5,
          worldY: 200.3,
          chunkId: 'city:capital',
          direction: 'right',
        })
      );
      expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: playerPositions.userId,
          set: expect.objectContaining({
            worldX: 100.5,
            worldY: 200.3,
            chunkId: 'city:capital',
            direction: 'right',
          }),
        })
      );
    });

    it('should update existing record (upsert)', async () => {
      const { db, mocks } = createMockDb();

      // First save
      await savePosition(db, {
        userId: 'user-002',
        worldX: 50,
        worldY: 50,
        chunkId: 'forest:north',
        direction: 'up',
      });

      // Second save (upsert)
      await savePosition(db, {
        userId: 'user-002',
        worldX: 75,
        worldY: 80,
        chunkId: 'forest:south',
        direction: 'down',
      });

      // Verify second call used correct values for upsert
      expect(mocks.insert).toHaveBeenCalledTimes(2);
      expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(2);

      const secondUpsertCall = mocks.onConflictDoUpdate.mock.calls[1][0];
      expect(secondUpsertCall.target).toBe(playerPositions.userId);
      expect(secondUpsertCall.set).toEqual(
        expect.objectContaining({
          worldX: 75,
          worldY: 80,
          chunkId: 'forest:south',
          direction: 'down',
        })
      );
    });
  });

  describe('loadPosition', () => {
    it('should return saved position', async () => {
      const { db, mocks } = createMockDb();
      const expectedPosition = {
        worldX: 123.45,
        worldY: 678.9,
        chunkId: 'beach:west',
        direction: 'left',
      };

      mocks.selectLimit.mockResolvedValue([expectedPosition]);

      const loaded = await loadPosition(db, 'user-003');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(playerPositions);
      expect(loaded).toEqual({
        worldX: 123.45,
        worldY: 678.9,
        chunkId: 'beach:west',
        direction: 'left',
      });
    });

    it('should return null for unknown user', async () => {
      const { db, mocks } = createMockDb();

      mocks.selectLimit.mockResolvedValue([]);

      const loaded = await loadPosition(db, 'unknown-user');

      expect(loaded).toBeNull();
    });
  });
});
