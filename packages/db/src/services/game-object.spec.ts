import {
  createGameObject,
  getGameObject,
  listGameObjects,
  updateGameObject,
  deleteGameObject,
  validateFrameReferences,
  getDistinctValues,
} from './game-object';
import type { CreateGameObjectData } from './game-object';
import { gameObjects } from '../schema/game-objects';
import { atlasFrames } from '../schema/atlas-frames';

/**
 * Unit tests for GameObjectService.
 *
 * These tests use a mocked Drizzle client to verify the service functions'
 * contract without requiring a real database connection. The mock verifies
 * that correct arguments are passed to Drizzle query builder methods and
 * that return values are correctly mapped.
 */

/** Helper: create a mock Drizzle client with chained builder pattern */
function createMockDb() {
  // Insert chain: insert(table).values(data).returning()
  const insertReturning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({ returning: insertReturning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  // Select chain: select().from(table).where().orderBy().limit().offset()
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

  // Update chain: update(table).set(data).where().returning()
  const updateReturning = jest.fn();
  const updateWhere = jest
    .fn()
    .mockReturnValue({ returning: updateReturning });
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  // Delete chain: delete(table).where().returning()
  const deleteReturning = jest.fn();
  const deleteWhere = jest
    .fn()
    .mockReturnValue({ returning: deleteReturning });
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
      deleteReturning,
    },
  };
}

const testLayers = [
  {
    frameId: 'frame-001',
    spriteId: 'sprite-001',
    xOffset: 0,
    yOffset: 0,
    layerOrder: 0,
  },
  {
    frameId: 'frame-002',
    spriteId: 'sprite-001',
    xOffset: 16,
    yOffset: 0,
    layerOrder: 1,
  },
];

const testObjectData: CreateGameObjectData = {
  name: 'Oak Tree',
  description: 'A large oak tree',
  layers: testLayers,
  tags: ['nature', 'tree'],
};

const testObject = {
  id: 'obj-001',
  ...testObjectData,
  metadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('GameObjectService', () => {
  describe('createGameObject', () => {
    it('should insert game object data and return created record', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([testObject]);

      const result = await createGameObject(db, testObjectData);

      expect(mocks.insert).toHaveBeenCalledWith(gameObjects);
      expect(mocks.insertValues).toHaveBeenCalledWith(testObjectData);
      expect(mocks.insertReturning).toHaveBeenCalled();
      expect(result).toEqual(testObject);
    });
  });

  describe('getGameObject', () => {
    it('should return game object when found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testObject]);

      const result = await getGameObject(db, 'obj-001');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(gameObjects);
      expect(result).toEqual(testObject);
    });

    it('should return null when game object not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await getGameObject(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listGameObjects', () => {
    it('should return all game objects ordered by createdAt desc', async () => {
      const { db, mocks } = createMockDb();
      const list = [testObject];
      mocks.selectOrderBy.mockResolvedValue(list);

      const result = await listGameObjects(db);

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(gameObjects);
      expect(result).toEqual(list);
    });

    it('should apply limit and offset when provided', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOffset.mockResolvedValue([testObject]);

      await listGameObjects(db, { limit: 10, offset: 5 });

      expect(mocks.selectLimit).toHaveBeenCalledWith(10);
      expect(mocks.selectOffset).toHaveBeenCalledWith(5);
    });
  });

  describe('updateGameObject', () => {
    it('should update and return the updated game object', async () => {
      const { db, mocks } = createMockDb();
      const updated = { ...testObject, name: 'Pine Tree' };
      mocks.updateReturning.mockResolvedValue([updated]);

      const result = await updateGameObject(db, 'obj-001', {
        name: 'Pine Tree',
      });

      expect(mocks.update).toHaveBeenCalledWith(gameObjects);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pine Tree' })
      );
      expect(mocks.updateReturning).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('should return null when game object to update not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValue([]);

      const result = await updateGameObject(db, 'nonexistent', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteGameObject', () => {
    it('should delete and return the deleted game object', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteReturning.mockResolvedValue([testObject]);

      const result = await deleteGameObject(db, 'obj-001');

      expect(mocks.deleteFn).toHaveBeenCalledWith(gameObjects);
      expect(mocks.deleteReturning).toHaveBeenCalled();
      expect(result).toEqual(testObject);
    });

    it('should return null when game object to delete not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteReturning.mockResolvedValue([]);

      const result = await deleteGameObject(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validateFrameReferences', () => {
    it('should return empty array when all frame references are valid', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([
        { id: 'frame-001' },
        { id: 'frame-002' },
      ]);

      const result = await validateFrameReferences(db, testLayers);

      expect(mocks.selectFrom).toHaveBeenCalledWith(atlasFrames);
      expect(result).toEqual([]);
    });

    it('should return invalid frame IDs when references are missing', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const layersWithInvalid = [
        {
          frameId: 'missing-frame',
          spriteId: 'sprite-001',
          xOffset: 0,
          yOffset: 0,
          layerOrder: 0,
        },
      ];

      const result = await validateFrameReferences(db, layersWithInvalid);

      expect(result).toEqual(['missing-frame']);
    });

    it('should return empty array for empty layers input', async () => {
      const { db } = createMockDb();

      const result = await validateFrameReferences(db, []);

      expect(result).toEqual([]);
    });
  });

  describe('getDistinctValues', () => {
    it('should return distinct category values', async () => {
      const selectDistinctFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([
            { value: 'Building' },
            { value: 'Furniture' },
            { value: 'Nature' },
          ]),
        }),
      });
      const selectDistinct = jest.fn().mockReturnValue({
        from: selectDistinctFrom,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = { selectDistinct } as any;

      const result = await getDistinctValues(db, 'category');

      expect(selectDistinct).toHaveBeenCalled();
      expect(selectDistinctFrom).toHaveBeenCalledWith(gameObjects);
      expect(result).toEqual(['Building', 'Furniture', 'Nature']);
    });

    it('should filter out null values', async () => {
      const selectDistinctFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([
            { value: 'Static' },
            { value: null },
          ]),
        }),
      });
      const selectDistinct = jest.fn().mockReturnValue({
        from: selectDistinctFrom,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = { selectDistinct } as any;

      const result = await getDistinctValues(db, 'objectType');

      expect(result).toEqual(['Static']);
    });
  });

  describe('createGameObject with new fields', () => {
    it('should include category, objectType, collisionZones in create', async () => {
      const { db, mocks } = createMockDb();
      const dataWithNewFields = {
        ...testObjectData,
        category: 'Building',
        objectType: 'Static',
        collisionZones: [
          {
            id: 'zone-1',
            label: 'Body',
            type: 'collision' as const,
            shape: 'rectangle' as const,
            x: 0,
            y: 0,
            width: 32,
            height: 32,
          },
        ],
      };
      mocks.insertReturning.mockResolvedValue([{ id: 'obj-002', ...dataWithNewFields }]);

      const result = await createGameObject(db, dataWithNewFields);

      expect(mocks.insertValues).toHaveBeenCalledWith(dataWithNewFields);
      expect(result.category).toBe('Building');
      expect(result.objectType).toBe('Static');
      expect(result.collisionZones).toHaveLength(1);
    });
  });

  describe('updateGameObject with new fields', () => {
    it('should update category and objectType', async () => {
      const { db, mocks } = createMockDb();
      const updated = { ...testObject, category: 'Nature', objectType: 'Tree' };
      mocks.updateReturning.mockResolvedValue([updated]);

      const result = await updateGameObject(db, 'obj-001', {
        category: 'Nature',
        objectType: 'Tree',
      });

      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Nature', objectType: 'Tree' })
      );
      expect(result?.category).toBe('Nature');
    });
  });
});
