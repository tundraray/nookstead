import {
  batchSaveFrames,
  getFramesBySprite,
  deleteFramesBySprite,
} from './atlas-frame';
import type { FrameInput } from './atlas-frame';
import { atlasFrames } from '../schema/atlas-frames';

/**
 * Unit tests for AtlasFrameService.
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

  // Select chain: select().from(table).where().orderBy()
  const selectOrderBy = jest.fn();
  const selectWhere = jest.fn().mockReturnValue({
    orderBy: selectOrderBy,
  });
  const selectFrom = jest.fn().mockReturnValue({
    where: selectWhere,
    orderBy: selectOrderBy,
  });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // Delete chain: delete(table).where()
  const deleteWhere = jest.fn().mockResolvedValue(undefined);
  const deleteFn = jest.fn().mockReturnValue({ where: deleteWhere });

  // Transaction: db.transaction(async (tx) => {...})
  const transaction = jest
    .fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation(async (callback: any) => {
      const tx = { insert, select, delete: deleteFn };
      return callback(tx);
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { insert, select, delete: deleteFn, transaction } as any;

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
      deleteFn,
      deleteWhere,
      transaction,
    },
  };
}

const testFrameInput: FrameInput = {
  filename: 'idle_01.png',
  frameX: 0,
  frameY: 0,
  frameW: 32,
  frameH: 32,
};

const testFrameRow = {
  id: 'frame-001',
  spriteId: 'sprite-001',
  filename: 'idle_01.png',
  frameX: 0,
  frameY: 0,
  frameW: 32,
  frameH: 32,
  rotated: false,
  trimmed: false,
  spriteSourceSizeX: 0,
  spriteSourceSizeY: 0,
  spriteSourceSizeW: 32,
  spriteSourceSizeH: 32,
  sourceSizeW: 32,
  sourceSizeH: 32,
  pivotX: 0.5,
  pivotY: 0.5,
  customData: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('AtlasFrameService', () => {
  describe('batchSaveFrames', () => {
    it('should delete existing frames and insert new ones within a transaction', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([testFrameRow]);

      const result = await batchSaveFrames(db, 'sprite-001', [testFrameInput]);

      expect(mocks.transaction).toHaveBeenCalled();
      expect(mocks.deleteFn).toHaveBeenCalledWith(atlasFrames);
      expect(mocks.deleteWhere).toHaveBeenCalled();
      expect(mocks.insert).toHaveBeenCalledWith(atlasFrames);
      expect(mocks.insertReturning).toHaveBeenCalled();
      expect(result).toEqual([testFrameRow]);
    });

    it('should return empty array and skip insert when frames array is empty', async () => {
      const { db, mocks } = createMockDb();

      const result = await batchSaveFrames(db, 'sprite-001', []);

      expect(mocks.transaction).toHaveBeenCalled();
      expect(mocks.deleteFn).toHaveBeenCalledWith(atlasFrames);
      expect(mocks.deleteWhere).toHaveBeenCalled();
      expect(mocks.insert).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should apply default values for optional fields', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([testFrameRow]);

      await batchSaveFrames(db, 'sprite-001', [testFrameInput]);

      const insertedValues = mocks.insertValues.mock.calls[0][0];
      expect(insertedValues[0]).toEqual(
        expect.objectContaining({
          spriteId: 'sprite-001',
          filename: 'idle_01.png',
          frameX: 0,
          frameY: 0,
          frameW: 32,
          frameH: 32,
          rotated: false,
          trimmed: false,
          spriteSourceSizeX: 0,
          spriteSourceSizeY: 0,
          spriteSourceSizeW: 32,
          spriteSourceSizeH: 32,
          sourceSizeW: 32,
          sourceSizeH: 32,
          pivotX: 0.5,
          pivotY: 0.5,
          customData: null,
        })
      );
    });

    it('should use provided optional values instead of defaults', async () => {
      const { db, mocks } = createMockDb();
      const customFrame: FrameInput = {
        filename: 'walk_01.png',
        frameX: 10,
        frameY: 20,
        frameW: 48,
        frameH: 64,
        rotated: true,
        trimmed: true,
        spriteSourceSizeX: 2,
        spriteSourceSizeY: 3,
        spriteSourceSizeW: 44,
        spriteSourceSizeH: 58,
        sourceSizeW: 48,
        sourceSizeH: 64,
        pivotX: 0.0,
        pivotY: 1.0,
        customData: { passable: false },
      };
      mocks.insertReturning.mockResolvedValue([
        { ...testFrameRow, ...customFrame },
      ]);

      await batchSaveFrames(db, 'sprite-001', [customFrame]);

      const insertedValues = mocks.insertValues.mock.calls[0][0];
      expect(insertedValues[0]).toEqual(
        expect.objectContaining({
          rotated: true,
          trimmed: true,
          spriteSourceSizeX: 2,
          spriteSourceSizeY: 3,
          spriteSourceSizeW: 44,
          spriteSourceSizeH: 58,
          sourceSizeW: 48,
          sourceSizeH: 64,
          pivotX: 0.0,
          pivotY: 1.0,
          customData: { passable: false },
        })
      );
    });

    it('should handle multiple frames in a single batch', async () => {
      const { db, mocks } = createMockDb();
      const frames: FrameInput[] = [
        { filename: 'frame_01.png', frameX: 0, frameY: 0, frameW: 16, frameH: 16 },
        { filename: 'frame_02.png', frameX: 16, frameY: 0, frameW: 16, frameH: 16 },
        { filename: 'frame_03.png', frameX: 32, frameY: 0, frameW: 16, frameH: 16 },
      ];
      const returnedFrames = frames.map((f, i) => ({
        ...testFrameRow,
        id: `frame-00${i + 1}`,
        ...f,
      }));
      mocks.insertReturning.mockResolvedValue(returnedFrames);

      const result = await batchSaveFrames(db, 'sprite-001', frames);

      const insertedValues = mocks.insertValues.mock.calls[0][0];
      expect(insertedValues).toHaveLength(3);
      expect(result).toHaveLength(3);
    });
  });

  describe('getFramesBySprite', () => {
    it('should return all frames for a sprite ordered by filename', async () => {
      const { db, mocks } = createMockDb();
      const frames = [
        { ...testFrameRow, filename: 'a_frame.png' },
        { ...testFrameRow, id: 'frame-002', filename: 'b_frame.png' },
      ];
      mocks.selectOrderBy.mockResolvedValue(frames);

      const result = await getFramesBySprite(db, 'sprite-001');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(atlasFrames);
      expect(mocks.selectWhere).toHaveBeenCalled();
      expect(mocks.selectOrderBy).toHaveBeenCalled();
      expect(result).toEqual(frames);
    });

    it('should return empty array when sprite has no frames', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOrderBy.mockResolvedValue([]);

      const result = await getFramesBySprite(db, 'sprite-999');

      expect(result).toEqual([]);
    });
  });

  describe('deleteFramesBySprite', () => {
    it('should delete all frames for a sprite', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteWhere.mockResolvedValue(undefined);

      await deleteFramesBySprite(db, 'sprite-001');

      expect(mocks.deleteFn).toHaveBeenCalledWith(atlasFrames);
      expect(mocks.deleteWhere).toHaveBeenCalled();
    });
  });
});
