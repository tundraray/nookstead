import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  publishTemplate,
  getPublishedTemplates,
} from './map-template';
import type { CreateTemplateData } from './map-template';
import { mapTemplates } from '../schema/map-templates';

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

const testData: CreateTemplateData = {
  name: 'Farm Template',
  description: 'A basic farm layout',
  mapType: 'player_homestead',
  baseWidth: 64,
  baseHeight: 64,
  grid: [[{ terrain: 'grass' }]],
  layers: [{ name: 'base', frames: [[0]] }],
};

const testRecord = {
  id: 'tpl-001',
  ...testData,
  parameters: null,
  constraints: null,
  zones: null,
  version: 1,
  isPublished: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('MapTemplateService', () => {
  describe('createTemplate', () => {
    it('should insert template data and return created record', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([testRecord]);

      const result = await createTemplate(db, testData);

      expect(mocks.insert).toHaveBeenCalledWith(mapTemplates);
      expect(mocks.insertValues).toHaveBeenCalledWith(testData);
      expect(result).toEqual(testRecord);
    });
  });

  describe('getTemplate', () => {
    it('should return template when found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testRecord]);

      const result = await getTemplate(db, 'tpl-001');

      expect(mocks.selectFrom).toHaveBeenCalledWith(mapTemplates);
      expect(result).toEqual(testRecord);
    });

    it('should return null when template not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await getTemplate(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('should return all templates ordered by updatedAt desc', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOrderBy.mockResolvedValue([testRecord]);

      const result = await listTemplates(db);

      expect(mocks.selectFrom).toHaveBeenCalledWith(mapTemplates);
      expect(result).toEqual([testRecord]);
    });

    it('should filter by isPublished when provided', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOrderBy.mockResolvedValue([]);

      const result = await listTemplates(db, { isPublished: true });

      expect(mocks.selectFrom).toHaveBeenCalledWith(mapTemplates);
      expect(mocks.selectWhere).toHaveBeenCalled();
      expect(mocks.selectOrderBy).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('updateTemplate', () => {
    it('should update and return the updated template', async () => {
      const { db, mocks } = createMockDb();
      const updated = { ...testRecord, name: 'Updated Template' };
      mocks.updateReturning.mockResolvedValue([updated]);

      const result = await updateTemplate(db, 'tpl-001', {
        name: 'Updated Template',
      });

      expect(mocks.update).toHaveBeenCalledWith(mapTemplates);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Template', updatedAt: expect.any(Date) })
      );
      expect(result).toEqual(updated);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template by id', async () => {
      const { db, mocks } = createMockDb();

      await deleteTemplate(db, 'tpl-001');

      expect(mocks.deleteFn).toHaveBeenCalledWith(mapTemplates);
      expect(mocks.deleteWhere).toHaveBeenCalled();
    });
  });

  describe('publishTemplate', () => {
    it('should set isPublished true and increment version', async () => {
      const { db, mocks } = createMockDb();
      // getTemplate call (first select)
      mocks.selectWhere.mockResolvedValueOnce([testRecord]);
      // update call
      const publishedRecord = {
        ...testRecord,
        isPublished: true,
        version: 2,
      };
      mocks.updateReturning.mockResolvedValue([publishedRecord]);

      const result = await publishTemplate(db, 'tpl-001');

      expect(mocks.update).toHaveBeenCalledWith(mapTemplates);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: true,
          version: 2,
          updatedAt: expect.any(Date),
        })
      );
      expect(result?.version).toBe(2);
      expect(result?.isPublished).toBe(true);
    });

    it('should return null when template does not exist', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await publishTemplate(db, 'nonexistent');

      expect(result).toBeNull();
      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  describe('getPublishedTemplates', () => {
    it('should filter by mapType and isPublished true', async () => {
      const { db, mocks } = createMockDb();
      const published = { ...testRecord, isPublished: true };
      mocks.selectWhere.mockReturnValue({
        orderBy: jest.fn().mockResolvedValue([published]),
      });

      const result = await getPublishedTemplates(db, 'player_homestead');

      expect(mocks.selectFrom).toHaveBeenCalledWith(mapTemplates);
      expect(result).toEqual([published]);
    });
  });
});
