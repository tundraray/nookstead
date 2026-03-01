import {
  importPlayerMap,
  exportToPlayerMap,
  editPlayerMapDirect,
  savePlayerMapDirect,
} from './map-import-export';
import { maps } from '../schema/maps';
import { editorMaps } from '../schema/editor-maps';

function createMockDb() {
  // Insert chain: insert(table).values(data).returning() / .onConflictDoUpdate()
  const insertOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const insertReturning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({
    returning: insertReturning,
    onConflictDoUpdate: insertOnConflictDoUpdate,
  });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  // Select chain: select().from(table).where()
  const selectWhere = jest.fn();
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // Update chain: update(table).set(data).where()
  const updateWhere = jest.fn().mockResolvedValue(undefined);
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
      insertOnConflictDoUpdate,
      select,
      selectFrom,
      selectWhere,
      update,
      updateSet,
      updateWhere,
    },
  };
}

const playerMapRecord = {
  userId: 'user-abc',
  seed: 42,
  width: 4,
  height: 3,
  grid: [
    [{ terrain: 'grass' }, { terrain: 'dirt' }, { terrain: 'grass' }, { terrain: 'water' }],
    [{ terrain: 'dirt' }, { terrain: 'grass' }, { terrain: 'grass' }, { terrain: 'dirt' }],
    [{ terrain: 'grass' }, { terrain: 'grass' }, { terrain: 'dirt' }, { terrain: 'grass' }],
  ],
  layers: [{ name: 'base', frames: [[0, 1, 0, 2], [1, 0, 0, 1], [0, 0, 1, 0]] }],
  walkable: [[true, true, true, false], [true, true, true, true], [true, true, true, true]],
  updatedAt: new Date('2024-01-01'),
};

const editorMapRecord = {
  id: 'editor-001',
  name: 'Imported: user-abc',
  mapType: 'player_homestead',
  width: 4,
  height: 3,
  seed: 42,
  grid: playerMapRecord.grid,
  layers: playerMapRecord.layers,
  walkable: playerMapRecord.walkable,
  metadata: {
    importedFrom: 'user-abc',
    importedAt: expect.any(String),
    originalSeed: 42,
  },
  createdBy: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('MapImportExportService', () => {
  describe('importPlayerMap', () => {
    it('should import player map and create editor map with correct data', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([playerMapRecord]);
      mocks.insertReturning.mockResolvedValue([editorMapRecord]);

      const result = await importPlayerMap(db, 'user-abc');

      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(mocks.insert).toHaveBeenCalledWith(editorMaps);
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Imported: user-abc',
          mapType: 'player_homestead',
          width: 4,
          height: 3,
          seed: 42,
        })
      );
      expect(result).toEqual(editorMapRecord);
    });

    it('should throw error when player map not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      await expect(importPlayerMap(db, 'unknown')).rejects.toThrow(
        'No map found for user: unknown'
      );
    });

    it('should use stored 0x0 dimensions for empty grid', async () => {
      const { db, mocks } = createMockDb();
      const emptyGridMap = { ...playerMapRecord, grid: [], width: 0, height: 0 };
      mocks.selectWhere.mockResolvedValue([emptyGridMap]);
      mocks.insertReturning.mockResolvedValue([
        { ...editorMapRecord, width: 0, height: 0 },
      ]);

      await importPlayerMap(db, 'user-abc');

      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ width: 0, height: 0 })
      );
    });
  });

  describe('exportToPlayerMap', () => {
    it('should read editor map and upsert to player maps table', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([editorMapRecord]);

      await exportToPlayerMap(db, 'editor-001', 'user-abc');

      expect(mocks.selectFrom).toHaveBeenCalledWith(editorMaps);
      expect(mocks.insert).toHaveBeenCalledWith(maps);
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-abc',
          seed: 42,
          grid: editorMapRecord.grid,
          layers: editorMapRecord.layers,
          walkable: editorMapRecord.walkable,
        })
      );
      expect(mocks.insertOnConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: maps.userId,
        })
      );
    });

    it('should throw error when editor map not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      await expect(
        exportToPlayerMap(db, 'bad-id', 'user-abc')
      ).rejects.toThrow('Editor map not found: bad-id');
    });
  });

  describe('editPlayerMapDirect', () => {
    it('should return player map data with derived dimensions', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([playerMapRecord]);

      const result = await editPlayerMapDirect(db, 'user-abc');

      expect(mocks.selectFrom).toHaveBeenCalledWith(maps);
      expect(result).toEqual({
        userId: 'user-abc',
        grid: playerMapRecord.grid,
        layers: playerMapRecord.layers,
        walkable: playerMapRecord.walkable,
        seed: 42,
        width: 4,
        height: 3,
      });
    });

    it('should throw error when player map not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      await expect(editPlayerMapDirect(db, 'unknown')).rejects.toThrow(
        'No map found for user: unknown'
      );
    });
  });

  describe('savePlayerMapDirect', () => {
    it('should update player map with provided fields', async () => {
      const { db, mocks } = createMockDb();

      await savePlayerMapDirect(db, {
        userId: 'user-abc',
        grid: [[{ terrain: 'sand' }]],
        layers: [{ name: 'base', frames: [[3]] }],
        walkable: [[true]],
        seed: 99,
      });

      expect(mocks.update).toHaveBeenCalledWith(maps);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: [[{ terrain: 'sand' }]],
          layers: [{ name: 'base', frames: [[3]] }],
          walkable: [[true]],
          seed: 99,
          updatedAt: expect.any(Date),
        })
      );
      expect(mocks.updateWhere).toHaveBeenCalled();
    });
  });
});
