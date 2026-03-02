import {
  createEditorMap,
  getEditorMap,
  listEditorMaps,
  updateEditorMap,
  deleteEditorMap,
} from './editor-map';
import type { CreateEditorMapData } from './editor-map';
import { editorMaps } from '../schema/editor-maps';

function createMockDb() {
  const insertReturning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({ returning: insertReturning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  const selectOffset = jest.fn();
  const selectLimit = jest.fn().mockReturnValue({ offset: selectOffset });
  const selectOrderBy = jest
    .fn()
    .mockReturnValue({ limit: selectLimit, offset: selectOffset });
  const selectWhere = jest.fn().mockReturnValue({
    orderBy: selectOrderBy,
    limit: selectLimit,
  });
  const selectFrom = jest.fn().mockReturnValue({
    where: selectWhere,
    orderBy: selectOrderBy,
  });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  const updateReturning = jest.fn();
  const updateWhere = jest
    .fn()
    .mockReturnValue({ returning: updateReturning });
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  const deleteWhere = jest.fn().mockResolvedValue(undefined);
  const deleteFn = jest.fn().mockReturnValue({ where: deleteWhere });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { insert, select, update, delete: deleteFn } as any;

  return {
    db,
    mocks: {
      insert,
      insertValues,
      insertReturning,
      select,
      selectFrom,
      selectWhere,
      selectOrderBy,
      selectLimit,
      selectOffset,
      update,
      updateSet,
      updateWhere,
      updateReturning,
      deleteFn,
      deleteWhere,
    },
  };
}

const testData: CreateEditorMapData = {
  name: 'Test Map',
  mapType: 'city',
  width: 32,
  height: 32,
  seed: 42,
  grid: [[{ terrain: 'grass' }]],
  layers: [{ name: 'base', frames: [[0]] }],
  walkable: [[true]],
};

const testRecord = {
  id: 'map-001',
  ...testData,
  metadata: null,
  createdBy: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('EditorMapService', () => {
  describe('createEditorMap', () => {
    it('should insert editor map data and return created record', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([testRecord]);

      const result = await createEditorMap(db, testData);

      expect(mocks.insert).toHaveBeenCalledWith(editorMaps);
      expect(mocks.insertValues).toHaveBeenCalledWith(testData);
      expect(mocks.insertReturning).toHaveBeenCalled();
      expect(result).toEqual(testRecord);
    });
  });

  describe('getEditorMap', () => {
    it('should return editor map when found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testRecord]);

      const result = await getEditorMap(db, 'map-001');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(editorMaps);
      expect(result).toEqual(testRecord);
    });

    it('should return null when editor map not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await getEditorMap(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listEditorMaps', () => {
    it('should return all editor maps ordered by updatedAt desc', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOrderBy.mockResolvedValue([testRecord]);

      const result = await listEditorMaps(db);

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(editorMaps);
      expect(result).toEqual([testRecord]);
    });

    it('should filter by mapType when provided', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOrderBy.mockResolvedValue([testRecord]);

      const result = await listEditorMaps(db, { mapType: 'city' });

      expect(mocks.selectFrom).toHaveBeenCalledWith(editorMaps);
      expect(mocks.selectWhere).toHaveBeenCalled();
      expect(mocks.selectOrderBy).toHaveBeenCalled();
      expect(result).toEqual([testRecord]);
    });

    it('should apply limit and offset when provided', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOffset.mockResolvedValue([testRecord]);

      await listEditorMaps(db, { limit: 10, offset: 5 });

      expect(mocks.selectLimit).toHaveBeenCalledWith(10);
      expect(mocks.selectOffset).toHaveBeenCalledWith(5);
    });
  });

  describe('updateEditorMap', () => {
    it('should update and return the updated editor map', async () => {
      const { db, mocks } = createMockDb();
      const updated = { ...testRecord, name: 'Updated Map' };
      mocks.updateReturning.mockResolvedValue([updated]);

      const result = await updateEditorMap(db, 'map-001', {
        name: 'Updated Map',
      });

      expect(mocks.update).toHaveBeenCalledWith(editorMaps);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Map', updatedAt: expect.any(Date) })
      );
      expect(result).toEqual(updated);
    });
  });

  describe('deleteEditorMap', () => {
    it('should delete editor map by id', async () => {
      const { db, mocks } = createMockDb();

      await deleteEditorMap(db, 'map-001');

      expect(mocks.deleteFn).toHaveBeenCalledWith(editorMaps);
      expect(mocks.deleteWhere).toHaveBeenCalled();
    });
  });
});
