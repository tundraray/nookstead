import { saveMap, loadMap } from './map';
import type { SaveMapData } from './map';
import { maps } from '../schema/maps';

/**
 * Unit tests for MapService.
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

const testGrid = [
  [
    { terrain: 'water', elevation: 0, meta: {} },
    { terrain: 'grass', elevation: 1, meta: {} },
  ],
];
const testLayers = [{ name: 'base', terrainKey: 'terrain', frames: [[0, 1]] }];
const testWalkable = [[false, true]];

describe('MapService', () => {
  describe('saveMap', () => {
    it('should create new record for new user', async () => {
      const { db, mocks } = createMockDb();
      const data: SaveMapData = {
        userId: 'user-001',
        seed: 42,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      };

      await saveMap(db, data);

      expect(mocks.insert).toHaveBeenCalledWith(maps);
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          seed: 42,
          grid: testGrid,
          layers: testLayers,
          walkable: testWalkable,
        })
      );
      expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: maps.userId,
          set: expect.objectContaining({
            seed: 42,
            grid: testGrid,
            layers: testLayers,
            walkable: testWalkable,
          }),
        })
      );
    });

    it('should update existing record (upsert)', async () => {
      const { db, mocks } = createMockDb();

      // First save
      await saveMap(db, {
        userId: 'user-002',
        seed: 100,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      });

      // Second save (upsert)
      await saveMap(db, {
        userId: 'user-002',
        seed: 200,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      });

      // Verify both calls executed insert + onConflictDoUpdate
      expect(mocks.insert).toHaveBeenCalledTimes(2);
      expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(2);

      const secondUpsertCall = mocks.onConflictDoUpdate.mock.calls[1][0];
      expect(secondUpsertCall.target).toBe(maps.userId);
      expect(secondUpsertCall.set).toEqual(
        expect.objectContaining({
          seed: 200,
          grid: testGrid,
          layers: testLayers,
          walkable: testWalkable,
        })
      );
    });
  });

  describe('loadMap', () => {
    it('should return saved map data', async () => {
      const { db, mocks } = createMockDb();
      const expectedMap = {
        seed: 42,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      };

      mocks.selectLimit.mockResolvedValue([expectedMap]);

      const loaded = await loadMap(db, 'user-003');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(loaded).toEqual({
        seed: 42,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      });
    });

    it('should return null for unknown user', async () => {
      const { db, mocks } = createMockDb();

      mocks.selectLimit.mockResolvedValue([]);

      const loaded = await loadMap(db, 'unknown-user');

      expect(loaded).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('should preserve all map data through save and load cycle', async () => {
      const { db, mocks } = createMockDb();
      const complexGrid = [
        [{ terrain: 'sand', elevation: 0.5, meta: { moisture: 3 } }],
      ];
      const complexLayers = [
        { name: 'autotile', terrainKey: 'sand', frames: [[12]] },
      ];
      const complexWalkable = [[true]];

      const data: SaveMapData = {
        userId: 'user-004',
        seed: 999,
        grid: complexGrid,
        layers: complexLayers,
        walkable: complexWalkable,
      };

      await saveMap(db, data);

      // Verify insert was called with the exact data
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-004',
          seed: 999,
          grid: complexGrid,
          layers: complexLayers,
          walkable: complexWalkable,
        })
      );

      // Simulate load returning the same data
      mocks.selectLimit.mockResolvedValue([
        {
          seed: 999,
          grid: complexGrid,
          layers: complexLayers,
          walkable: complexWalkable,
        },
      ]);

      const result = await loadMap(db, 'user-004');

      expect(result).not.toBeNull();
      expect(result?.seed).toBe(999);
      expect(result?.grid).toEqual(complexGrid);
      expect(result?.layers).toEqual(complexLayers);
      expect(result?.walkable).toEqual(complexWalkable);
    });
  });
});
