import { eq } from 'drizzle-orm';
import {
  listPlayerMaps,
  importPlayerMap,
  exportToPlayerMap,
  editPlayerMapDirect,
  savePlayerMapDirect,
} from './map-import-export';
import type { SavePlayerMapDirectData } from './map-import-export';
import { maps } from '../schema/maps';
import { editorMaps } from '../schema/editor-maps';
import { users } from '../schema/users';

/** Helper: create a mock Drizzle client with chained builder pattern */
function createMockDb() {
  // Insert chain: insert(table).values(data).returning()
  const insertReturning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({
    returning: insertReturning,
  });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  // Select chain: select(cols).from(table).where().limit()
  // Also supports: select(cols).from(table).leftJoin()
  const selectLimit = jest.fn();
  const leftJoin = jest.fn();
  const selectWhere = jest.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = jest
    .fn()
    .mockReturnValue({ where: selectWhere, leftJoin });
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
      leftJoin,
      update,
      updateSet,
      updateWhere,
      updateReturning,
    },
  };
}

const testGrid = [
  [
    { terrain: 'grass', elevation: 0, meta: {} },
    { terrain: 'dirt', elevation: 1, meta: {} },
  ],
];
const testLayers = [{ name: 'base', terrainKey: 'terrain', frames: [[0, 1]] }];
const testWalkable = [[true, true]];

const playerMapRecord = {
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
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const editorMapRecord = {
  id: 'editor-map-001',
  name: 'Imported: My Homestead',
  mapType: 'homestead',
  width: 64,
  height: 64,
  seed: 42,
  grid: testGrid,
  layers: testLayers,
  walkable: testWalkable,
  metadata: null,
  createdBy: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('MapImportExportService', () => {
  describe('listPlayerMaps', () => {
    it('should return maps with id and mapType fields', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      const expectedMaps = [
        {
          id: 'map-uuid-001',
          name: 'My Homestead',
          mapType: 'homestead',
          userId: 'user-001',
          seed: 42,
          updatedAt: new Date('2024-01-15'),
          userName: 'Alice',
          userEmail: 'alice@example.com',
        },
        {
          id: 'map-uuid-002',
          name: 'City Plot',
          mapType: 'city',
          userId: 'user-002',
          seed: null,
          updatedAt: new Date('2024-02-01'),
          userName: 'Bob',
          userEmail: 'bob@example.com',
        },
      ];
      mocks.leftJoin.mockResolvedValueOnce(expectedMaps);

      // Act
      const result = await listPlayerMaps(db);

      // Assert
      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(mocks.leftJoin).toHaveBeenCalledWith(
        users,
        eq(maps.userId, users.id)
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('map-uuid-001');
      expect(result[0].mapType).toBe('homestead');
      expect(result[1].id).toBe('map-uuid-002');
      expect(result[1].mapType).toBe('city');
    });
  });

  describe('importPlayerMap', () => {
    it('should import player map by mapId and create editor map', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.selectLimit.mockResolvedValueOnce([playerMapRecord]);
      mocks.insertReturning.mockResolvedValueOnce([editorMapRecord]);

      // Act
      const result = await importPlayerMap(db, 'map-uuid-001');

      // Assert
      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(mocks.selectWhere).toHaveBeenCalledWith(
        eq(maps.id, 'map-uuid-001')
      );
      expect(mocks.insert).toHaveBeenCalledWith(editorMaps);
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Homestead',
          mapType: 'homestead',
          seed: 42,
          width: 64,
          height: 64,
        })
      );
      expect(result).toEqual(editorMapRecord);
    });

    it('should create editor map with homestead type (not player_homestead)', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      const playerHomesteadMap = {
        ...playerMapRecord,
        mapType: 'player_homestead',
      };
      mocks.selectLimit.mockResolvedValueOnce([playerHomesteadMap]);
      mocks.insertReturning.mockResolvedValueOnce([editorMapRecord]);

      // Act
      await importPlayerMap(db, 'map-uuid-001');

      // Assert: mapType should always be 'homestead', not 'player_homestead'
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ mapType: 'homestead' })
      );
    });

    it('should use map name when available', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.selectLimit.mockResolvedValueOnce([playerMapRecord]);
      mocks.insertReturning.mockResolvedValueOnce([editorMapRecord]);

      // Act
      await importPlayerMap(db, 'map-uuid-001');

      // Assert
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Homestead' })
      );
    });

    it('should use fallback name when map name is null', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      const nullNameMap = { ...playerMapRecord, name: null };
      mocks.selectLimit.mockResolvedValueOnce([nullNameMap]);
      mocks.insertReturning.mockResolvedValueOnce([editorMapRecord]);

      // Act
      await importPlayerMap(db, 'map-uuid-001');

      // Assert
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Imported Map' })
      );
    });

    it('should throw when map not found', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.selectLimit.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        importPlayerMap(db, 'nonexistent-id')
      ).rejects.toThrow('Map not found: nonexistent-id');
    });
  });

  describe('exportToPlayerMap', () => {
    it('should update target map data by mapId (pure UPDATE, not upsert)', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      const editorMap = {
        ...editorMapRecord,
        seed: 42,
        width: 64,
        height: 64,
      };
      const targetMap = { id: 'map-uuid-001' };
      mocks.selectLimit
        .mockResolvedValueOnce([editorMap]) // first: find editor map
        .mockResolvedValueOnce([targetMap]); // second: find target map

      // Act
      await exportToPlayerMap(db, 'editor-map-001', 'map-uuid-001');

      // Assert: update was called (not insert+onConflictDoUpdate)
      expect(mocks.update).toHaveBeenCalledWith(maps);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          seed: 42,
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

    it('should verify editor map exists before updating', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.selectLimit
        .mockResolvedValueOnce([editorMapRecord])
        .mockResolvedValueOnce([{ id: 'map-uuid-001' }]);

      // Act
      await exportToPlayerMap(db, 'editor-map-001', 'map-uuid-001');

      // Assert: first select queries editorMaps table
      expect(mocks.selectFrom).toHaveBeenCalledWith(editorMaps);
      expect(mocks.selectWhere).toHaveBeenCalledWith(
        eq(editorMaps.id, 'editor-map-001')
      );
    });

    it('should throw when editor map not found', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.selectLimit.mockResolvedValueOnce([]); // editor map not found

      // Act & Assert
      await expect(
        exportToPlayerMap(db, 'nonexistent-editor', 'map-uuid-001')
      ).rejects.toThrow('Editor map not found: nonexistent-editor');
    });

    it('should throw when target map not found', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.selectLimit
        .mockResolvedValueOnce([editorMapRecord]) // editor map found
        .mockResolvedValueOnce([]); // target map not found

      // Act & Assert
      await expect(
        exportToPlayerMap(db, 'editor-map-001', 'nonexistent-map')
      ).rejects.toThrow('Target map not found: nonexistent-map');
    });
  });

  describe('editPlayerMapDirect', () => {
    it('should return map record by mapId', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.selectLimit.mockResolvedValueOnce([playerMapRecord]);

      // Act
      const result = await editPlayerMapDirect(db, 'map-uuid-001');

      // Assert
      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(mocks.selectWhere).toHaveBeenCalledWith(
        eq(maps.id, 'map-uuid-001')
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('map-uuid-001');
      expect(result!.mapType).toBe('homestead');
      expect(result!.grid).toEqual(testGrid);
    });

    it('should return null when map not found', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.selectLimit.mockResolvedValueOnce([]);

      // Act
      const result = await editPlayerMapDirect(db, 'nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('savePlayerMapDirect', () => {
    it('should update map WHERE maps.id equals mapId', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValueOnce([{ id: 'map-uuid-001' }]);

      const data: SavePlayerMapDirectData = {
        mapId: 'map-uuid-001',
        seed: 99,
        width: 64,
        height: 64,
        grid: testGrid,
        layers: testLayers,
        walkable: testWalkable,
      };

      // Act
      await savePlayerMapDirect(db, data);

      // Assert
      expect(mocks.update).toHaveBeenCalledWith(maps);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          seed: 99,
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

    it('should pass optional seed as undefined when not provided', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValueOnce([{ id: 'map-uuid-001' }]);

      const data: SavePlayerMapDirectData = {
        mapId: 'map-uuid-001',
        width: 32,
        height: 32,
        grid: {},
        layers: {},
        walkable: {},
      };

      // Act
      await savePlayerMapDirect(db, data);

      // Assert
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          seed: undefined,
          width: 32,
          height: 32,
        })
      );
    });

    it('should throw when map not found', async () => {
      // Arrange
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValueOnce([]);

      const data: SavePlayerMapDirectData = {
        mapId: 'nonexistent',
        width: 64,
        height: 64,
        grid: {},
        layers: {},
        walkable: {},
      };

      // Act & Assert
      await expect(savePlayerMapDirect(db, data)).rejects.toThrow(
        'Map not found: nonexistent'
      );
    });
  });
});
