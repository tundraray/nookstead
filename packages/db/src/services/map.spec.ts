import { and, eq } from 'drizzle-orm';
import {
  createMap,
  saveMap,
  loadMap,
  findMapByUser,
  listMapsByUser,
  listMapsByUserAndType,
} from './map';
import type { CreateMapData, SaveMapData, LoadMapResult } from './map';
import { maps } from '../schema/maps';

/** Helper: create a mock Drizzle client with chained builder pattern */
function createMockDb() {
  // Insert chain: insert(table).values(data).returning(cols)
  const insertReturning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({ returning: insertReturning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  // Select chain: select(cols).from(table).where().limit()
  const selectLimit = jest.fn();
  const selectWhere = jest.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // Update chain: update(table).set(data).where().returning()
  const updateReturning = jest.fn();
  const updateWhere = jest
    .fn()
    .mockReturnValue({ returning: updateReturning });
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { insert, select, update } as any;

  return {
    db,
    mocks: {
      insert,
      insertValues,
      insertReturning,
      select,
      selectFrom,
      selectWhere,
      selectLimit,
      update,
      updateSet,
      updateWhere,
      updateReturning,
    },
  };
}

const testGrid = [
  [
    { terrain: 'water', elevation: 0, meta: {} },
    { terrain: 'grass', elevation: 1, meta: {} },
  ],
];
const testLayers = [
  { name: 'base', terrainKey: 'terrain', frames: [[0, 1]] },
];
const testWalkable = [[false, true]];

describe('MapService', () => {
  describe('createMap', () => {
    it('should insert a new map and return the created record with UUID id', async () => {
      const { db, mocks } = createMockDb();
      const createdRecord = {
        id: 'generated-uuid-001',
        name: 'My Homestead',
        mapType: 'homestead',
        userId: 'user-001',
        seed: 42,
        width: 2,
        height: 1,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
        metadata: null,
      };
      mocks.insertReturning.mockResolvedValue([createdRecord]);

      const data: CreateMapData = {
        name: 'My Homestead',
        mapType: 'homestead',
        userId: 'user-001',
        seed: 42,
        width: 2,
        height: 1,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      };

      const result = await createMap(db, data);

      expect(mocks.insert).toHaveBeenCalledWith(maps);
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Homestead',
          mapType: 'homestead',
          userId: 'user-001',
          seed: 42,
          width: 2,
          height: 1,
        })
      );
      expect(mocks.insertReturning).toHaveBeenCalled();
      expect(result.id).toBe('generated-uuid-001');
      expect(result.mapType).toBe('homestead');
      expect(result.userId).toBe('user-001');
    });

    it('should default name to Untitled when not provided', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([
        {
          id: 'generated-uuid-002',
          name: 'Untitled',
          mapType: 'homestead',
          userId: null,
          seed: null,
          width: 2,
          height: 1,
          grid: testGrid,
          layers: testLayers,
          walkable: testWalkable,
          metadata: null,
        },
      ]);

      const result = await createMap(db, {
        mapType: 'homestead',
        width: 2,
        height: 1,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      });

      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Untitled' })
      );
      expect(result.name).toBe('Untitled');
    });

    it('should default userId and seed to null when not provided', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([
        {
          id: 'generated-uuid-003',
          name: 'Untitled',
          mapType: 'city',
          userId: null,
          seed: null,
          width: 64,
          height: 64,
          grid: {},
          layers: {},
          walkable: {},
          metadata: null,
        },
      ]);

      const result = await createMap(db, {
        mapType: 'city',
        width: 64,
        height: 64,
        grid: {},
        layers: {},
        walkable: {},
      });

      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, seed: null })
      );
      expect(result.userId).toBeNull();
      expect(result.seed).toBeNull();
    });
  });

  describe('saveMap', () => {
    it('should update an existing map by mapId', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValue([{ id: 'map-uuid-001' }]);

      const data: SaveMapData = {
        mapId: 'map-uuid-001',
        width: 64,
        height: 64,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      };

      await saveMap(db, data);

      expect(mocks.update).toHaveBeenCalledWith(maps);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 64,
          height: 64,
          grid: testGrid,
          layers: testLayers,
          walkable: testWalkable,
          updatedAt: expect.any(Date),
        })
      );
      expect(mocks.updateWhere).toHaveBeenCalledWith(
        eq(maps.id, 'map-uuid-001')
      );
    });

    it('should throw error when map not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValue([]);

      const data: SaveMapData = {
        mapId: 'nonexistent-id',
        width: 64,
        height: 64,
        grid: {},
        layers: {},
        walkable: {},
      };

      await expect(saveMap(db, data)).rejects.toThrow(
        'Map not found: nonexistent-id'
      );
    });

    it('should pass optional seed field to update set', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValue([{ id: 'map-uuid-001' }]);

      const data: SaveMapData = {
        mapId: 'map-uuid-001',
        seed: 99,
        width: 32,
        height: 32,
        grid: {},
        layers: {},
        walkable: {},
      };

      await saveMap(db, data);

      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ seed: 99 })
      );
    });
  });

  describe('loadMap', () => {
    it('should return map data when mapId exists', async () => {
      const { db, mocks } = createMockDb();
      const expectedMap: LoadMapResult = {
        id: 'map-uuid-001',
        name: 'Test Map',
        mapType: 'homestead',
        userId: 'user-001',
        seed: 42,
        width: 64,
        height: 64,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
        metadata: null,
      };
      mocks.selectLimit.mockResolvedValue([expectedMap]);

      const result = await loadMap(db, 'map-uuid-001');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(mocks.selectWhere).toHaveBeenCalledWith(
        eq(maps.id, 'map-uuid-001')
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('map-uuid-001');
      expect(result!.name).toBe('Test Map');
      expect(result!.mapType).toBe('homestead');
    });

    it('should return null when mapId does not exist', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectLimit.mockResolvedValue([]);

      const result = await loadMap(db, 'non-existent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('findMapByUser', () => {
    it('should find a map by userId and mapType', async () => {
      const { db, mocks } = createMockDb();
      const expectedMap: LoadMapResult = {
        id: 'map-uuid-001',
        name: 'My Homestead',
        mapType: 'homestead',
        userId: 'user-001',
        seed: 42,
        width: 64,
        height: 64,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
        metadata: null,
      };
      mocks.selectLimit.mockResolvedValue([expectedMap]);

      const result = await findMapByUser(db, 'user-001', 'homestead');

      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(mocks.selectWhere).toHaveBeenCalledWith(
        and(eq(maps.userId, 'user-001'), eq(maps.mapType, 'homestead'))
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('map-uuid-001');
      expect(result!.mapType).toBe('homestead');
    });

    it('should return null when no match found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectLimit.mockResolvedValue([]);

      const result = await findMapByUser(db, 'user-001', 'city');

      expect(result).toBeNull();
    });
  });

  describe('listMapsByUser', () => {
    it('should return all maps for a user', async () => {
      const { db, mocks } = createMockDb();
      const expectedMaps = [
        {
          id: 'map-uuid-001',
          name: 'Homestead',
          mapType: 'homestead',
          userId: 'user-001',
          seed: 42,
          width: 64,
          height: 64,
          grid: testGrid,
          layers: testLayers,
          walkable: testWalkable,
          metadata: null,
        },
        {
          id: 'map-uuid-002',
          name: 'City Plot',
          mapType: 'city',
          userId: 'user-001',
          seed: 7,
          width: 32,
          height: 32,
          grid: {},
          layers: {},
          walkable: {},
          metadata: null,
        },
      ];
      // listMapsByUser has no .limit() — where() returns the result directly
      mocks.selectWhere.mockResolvedValue(expectedMaps);

      const result = await listMapsByUser(db, 'user-001');

      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(mocks.selectWhere).toHaveBeenCalledWith(
        eq(maps.userId, 'user-001')
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('map-uuid-001');
      expect(result[0].mapType).toBe('homestead');
      expect(result[1].id).toBe('map-uuid-002');
      expect(result[1].mapType).toBe('city');
    });

    it('should return empty array when user has no maps', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await listMapsByUser(db, 'user-no-maps');

      expect(result).toHaveLength(0);
    });
  });

  describe('listMapsByUserAndType', () => {
    it('should return maps filtered by userId and mapType', async () => {
      const { db, mocks } = createMockDb();
      const expectedMaps = [
        {
          id: 'map-uuid-001',
          name: 'Homestead 1',
          mapType: 'homestead',
          userId: 'user-001',
          seed: 42,
          width: 64,
          height: 64,
          grid: testGrid,
          layers: testLayers,
          walkable: testWalkable,
          metadata: null,
        },
      ];
      mocks.selectWhere.mockResolvedValue(expectedMaps);

      const result = await listMapsByUserAndType(
        db,
        'user-001',
        'homestead'
      );

      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(mocks.selectWhere).toHaveBeenCalledWith(
        and(eq(maps.userId, 'user-001'), eq(maps.mapType, 'homestead'))
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('map-uuid-001');
      expect(result[0].mapType).toBe('homestead');
    });

    it('should return empty array when no maps match type filter', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await listMapsByUserAndType(
        db,
        'user-001',
        'open_world'
      );

      expect(result).toHaveLength(0);
    });
  });
});
