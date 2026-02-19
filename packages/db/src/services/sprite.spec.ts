import {
  createSprite,
  getSprite,
  listSprites,
  deleteSprite,
  countFramesBySprite,
  findGameObjectsReferencingSprite,
} from './sprite';
import type { CreateSpriteData } from './sprite';
import { sprites } from '../schema/sprites';
import { atlasFrames } from '../schema/atlas-frames';
import { gameObjects } from '../schema/game-objects';

/**
 * Unit tests for SpriteService.
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
    limit: selectLimit,
    orderBy: selectOrderBy,
  });
  const selectFrom = jest.fn().mockReturnValue({
    where: selectWhere,
    orderBy: selectOrderBy,
  });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // Delete chain: delete(table).where().returning()
  const deleteReturning = jest.fn();
  const deleteWhere = jest
    .fn()
    .mockReturnValue({ returning: deleteReturning });
  const deleteFn = jest.fn().mockReturnValue({ where: deleteWhere });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { insert, select, delete: deleteFn } as any;

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
      deleteFn,
      deleteWhere,
      deleteReturning,
    },
  };
}

const testSpriteData: CreateSpriteData = {
  name: 'test-sprite',
  s3Key: 'sprites/test-sprite.png',
  s3Url: 'https://s3.example.com/sprites/test-sprite.png',
  width: 256,
  height: 128,
  fileSize: 12345,
  mimeType: 'image/png',
};

const testSprite = {
  id: 'sprite-001',
  ...testSpriteData,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('SpriteService', () => {
  describe('createSprite', () => {
    it('should insert sprite data and return created record', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([testSprite]);

      const result = await createSprite(db, testSpriteData);

      expect(mocks.insert).toHaveBeenCalledWith(sprites);
      expect(mocks.insertValues).toHaveBeenCalledWith(testSpriteData);
      expect(mocks.insertReturning).toHaveBeenCalled();
      expect(result).toEqual(testSprite);
    });
  });

  describe('getSprite', () => {
    it('should return sprite when found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testSprite]);

      const result = await getSprite(db, 'sprite-001');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(sprites);
      expect(result).toEqual(testSprite);
    });

    it('should return null when sprite not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await getSprite(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listSprites', () => {
    it('should return all sprites ordered by createdAt desc', async () => {
      const { db, mocks } = createMockDb();
      const spritesList = [testSprite];
      mocks.selectOrderBy.mockResolvedValue(spritesList);

      const result = await listSprites(db);

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(sprites);
      expect(result).toEqual(spritesList);
    });

    it('should apply limit and offset when provided', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOffset.mockResolvedValue([testSprite]);

      await listSprites(db, { limit: 10, offset: 5 });

      expect(mocks.selectLimit).toHaveBeenCalledWith(10);
      expect(mocks.selectOffset).toHaveBeenCalledWith(5);
    });
  });

  describe('deleteSprite', () => {
    it('should delete and return deleted sprite', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteReturning.mockResolvedValue([testSprite]);

      const result = await deleteSprite(db, 'sprite-001');

      expect(mocks.deleteFn).toHaveBeenCalledWith(sprites);
      expect(mocks.deleteReturning).toHaveBeenCalled();
      expect(result).toEqual(testSprite);
    });

    it('should return null when sprite to delete not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteReturning.mockResolvedValue([]);

      const result = await deleteSprite(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('countFramesBySprite', () => {
    it('should return count of atlas frames referencing the sprite', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([{ count: 5 }]);

      const result = await countFramesBySprite(db, 'sprite-001');

      expect(mocks.selectFrom).toHaveBeenCalledWith(atlasFrames);
      expect(result).toBe(5);
    });

    it('should return 0 when no atlas frames reference the sprite', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([{ count: 0 }]);

      const result = await countFramesBySprite(db, 'sprite-999');

      expect(result).toBe(0);
    });
  });

  describe('findGameObjectsReferencingSprite', () => {
    it('should return game objects that reference the sprite', async () => {
      const { db, mocks } = createMockDb();
      const objects = [
        { id: 'obj-1', name: 'Tree' },
        { id: 'obj-2', name: 'Bush' },
      ];
      mocks.selectWhere.mockResolvedValue(objects);

      const result = await findGameObjectsReferencingSprite(db, 'sprite-001');

      expect(mocks.selectFrom).toHaveBeenCalledWith(gameObjects);
      expect(result).toEqual(objects);
    });
  });
});
