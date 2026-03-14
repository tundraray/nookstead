import {
  createFenceType,
  getFenceType,
  getFenceTypeByKey,
  listFenceTypes,
  updateFenceType,
  deleteFenceType,
} from './fence-type';
import { fenceTypes } from '../schema/fence-types';

/**
 * Unit tests for FenceTypeService.
 *
 * These tests use a mocked Drizzle client to verify the service functions'
 * contract without requiring a real database connection. The mock verifies
 * that correct arguments are passed to Drizzle query builder methods and
 * that return values are correctly mapped.
 */

/** Helper: create a valid 16-entry frame_mapping with UUID values */
function makeFrameMapping(): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (let i = 0; i < 16; i++) {
    mapping[String(i)] = `00000000-0000-4000-a000-00000000000${i.toString(16)}`;
  }
  return mapping;
}

/** Helper: create a valid 4-entry gate_frame_mapping with UUID values */
function makeGateFrameMapping(): Record<string, string> {
  return {
    vertical_closed: '10000000-0000-4000-a000-000000000001',
    vertical_open: '10000000-0000-4000-a000-000000000002',
    horizontal_closed: '10000000-0000-4000-a000-000000000003',
    horizontal_open: '10000000-0000-4000-a000-000000000004',
  };
}

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

const testFenceTypeData = {
  name: 'Wooden Fence',
  key: 'wooden_fence',
  category: 'rustic',
  frameMapping: makeFrameMapping(),
  gateFrameMapping: makeGateFrameMapping(),
  sortOrder: 1,
};

const testFenceType = {
  id: 'ft-001',
  ...testFenceTypeData,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('FenceTypeService', () => {
  describe('createFenceType', () => {
    it('should insert valid fence type with 16-entry frame_mapping', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([testFenceType]);

      const result = await createFenceType(db, testFenceTypeData);

      expect(mocks.insert).toHaveBeenCalledWith(fenceTypes);
      expect(mocks.insertValues).toHaveBeenCalledWith(testFenceTypeData);
      expect(mocks.insertReturning).toHaveBeenCalled();
      expect(result).toEqual(testFenceType);
    });

    it('should reject frame_mapping with fewer than 16 entries', async () => {
      const { db } = createMockDb();
      const mapping: Record<string, string> = {};
      for (let i = 0; i < 15; i++) {
        mapping[String(i)] =
          `00000000-0000-4000-a000-00000000000${i.toString(16)}`;
      }

      // 15 entries means key "15" is missing, so the missing-key check fires first
      await expect(
        createFenceType(db, { ...testFenceTypeData, frameMapping: mapping })
      ).rejects.toThrow('frame_mapping missing required key: "15"');
    });

    it('should reject frame_mapping missing a required key', async () => {
      const { db } = createMockDb();
      const mapping = makeFrameMapping();
      delete mapping['5'];
      // Add an extra key to keep count at 16 but with wrong key
      mapping['16'] = '00000000-0000-4000-a000-000000000010';

      await expect(
        createFenceType(db, { ...testFenceTypeData, frameMapping: mapping })
      ).rejects.toThrow('frame_mapping missing required key: "5"');
    });

    it('should reject frame_mapping with non-UUID values', async () => {
      const { db } = createMockDb();
      const mapping = makeFrameMapping();
      mapping['3'] = 'not-a-uuid';

      await expect(
        createFenceType(db, { ...testFenceTypeData, frameMapping: mapping })
      ).rejects.toThrow('frame_mapping["3"] is not a valid UUID');
    });

    it('should reject gate_frame_mapping with fewer than 4 entries', async () => {
      const { db } = createMockDb();
      const gateMapping = {
        vertical_closed: '10000000-0000-4000-a000-000000000001',
        vertical_open: '10000000-0000-4000-a000-000000000002',
        horizontal_closed: '10000000-0000-4000-a000-000000000003',
      };

      // 3 entries means "horizontal_open" is missing, so the missing-key check fires first
      await expect(
        createFenceType(db, {
          ...testFenceTypeData,
          gateFrameMapping: gateMapping,
        })
      ).rejects.toThrow(
        'gate_frame_mapping missing required key: "horizontal_open"'
      );
    });

    it('should reject gate_frame_mapping missing required key', async () => {
      const { db } = createMockDb();
      const gateMapping = {
        vertical_closed: '10000000-0000-4000-a000-000000000001',
        vertical_open: '10000000-0000-4000-a000-000000000002',
        horizontal_closed: '10000000-0000-4000-a000-000000000003',
        wrong_key: '10000000-0000-4000-a000-000000000004',
      };

      await expect(
        createFenceType(db, {
          ...testFenceTypeData,
          gateFrameMapping: gateMapping,
        })
      ).rejects.toThrow(
        'gate_frame_mapping missing required key: "horizontal_open"'
      );
    });

    it('should reject frame_mapping with extra entries beyond 16', async () => {
      const { db } = createMockDb();
      const mapping = makeFrameMapping();
      // All 16 required keys present, but add an extra
      mapping['extra'] = '00000000-0000-4000-a000-000000000099';

      await expect(
        createFenceType(db, { ...testFenceTypeData, frameMapping: mapping })
      ).rejects.toThrow('frame_mapping must have exactly 16 entries');
    });

    it('should reject gate_frame_mapping with extra entries beyond 4', async () => {
      const { db } = createMockDb();
      const gateMapping = makeGateFrameMapping();
      // All 4 required keys present, but add an extra
      gateMapping['extra'] = '10000000-0000-4000-a000-000000000099';

      await expect(
        createFenceType(db, {
          ...testFenceTypeData,
          gateFrameMapping: gateMapping,
        })
      ).rejects.toThrow('gate_frame_mapping must have exactly 4 entries');
    });

    it('should accept create without gate_frame_mapping', async () => {
      const { db, mocks } = createMockDb();
      const dataWithoutGate = {
        ...testFenceTypeData,
        gateFrameMapping: undefined,
      };
      const fenceWithoutGate = {
        ...testFenceType,
        gateFrameMapping: null,
      };
      mocks.insertReturning.mockResolvedValue([fenceWithoutGate]);

      const result = await createFenceType(db, dataWithoutGate);

      expect(result).toEqual(fenceWithoutGate);
    });
  });

  describe('getFenceType', () => {
    it('should return fence type for valid UUID', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testFenceType]);

      const result = await getFenceType(db, 'ft-001');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(fenceTypes);
      expect(result).toEqual(testFenceType);
    });

    it('should return null for non-existent UUID', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await getFenceType(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getFenceTypeByKey', () => {
    it('should return fence type for valid key', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testFenceType]);

      const result = await getFenceTypeByKey(db, 'wooden_fence');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(fenceTypes);
      expect(result).toEqual(testFenceType);
    });

    it('should return null for non-existent key', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await getFenceTypeByKey(db, 'nonexistent_key');

      expect(result).toBeNull();
    });
  });

  describe('listFenceTypes', () => {
    it('should return all fence types ordered by sort_order', async () => {
      const { db, mocks } = createMockDb();
      const list = [
        { ...testFenceType, sortOrder: 1 },
        { ...testFenceType, id: 'ft-002', sortOrder: 2 },
      ];
      mocks.selectOrderBy.mockResolvedValue(list);

      const result = await listFenceTypes(db);

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(fenceTypes);
      expect(result).toEqual(list);
    });

    it('should filter by category when provided', async () => {
      const { db, mocks } = createMockDb();
      const filtered = [testFenceType];
      mocks.selectOrderBy.mockResolvedValue(filtered);

      const result = await listFenceTypes(db, { category: 'rustic' });

      expect(mocks.selectWhere).toHaveBeenCalled();
      expect(result).toEqual(filtered);
    });

    it('should return empty array when no fence types exist', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectOrderBy.mockResolvedValue([]);

      const result = await listFenceTypes(db);

      expect(result).toEqual([]);
    });
  });

  describe('updateFenceType', () => {
    it('should apply partial update (name change only)', async () => {
      const { db, mocks } = createMockDb();
      const updated = { ...testFenceType, name: 'Stone Fence' };
      mocks.updateReturning.mockResolvedValue([updated]);

      const result = await updateFenceType(db, 'ft-001', {
        name: 'Stone Fence',
      });

      expect(mocks.update).toHaveBeenCalledWith(fenceTypes);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Stone Fence' })
      );
      expect(mocks.updateReturning).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('should validate frame_mapping if provided in update', async () => {
      const { db } = createMockDb();
      const invalidMapping: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        invalidMapping[String(i)] =
          `00000000-0000-4000-a000-00000000000${i.toString(16)}`;
      }

      // 10 entries means key "10" is missing, so the missing-key check fires first
      await expect(
        updateFenceType(db, 'ft-001', { frameMapping: invalidMapping })
      ).rejects.toThrow('frame_mapping missing required key: "10"');
    });

    it('should validate gate_frame_mapping if provided in update', async () => {
      const { db } = createMockDb();
      const invalidGateMapping = {
        vertical_closed: '10000000-0000-4000-a000-000000000001',
      };

      // 1 entry means "vertical_open" is missing, so the missing-key check fires first
      await expect(
        updateFenceType(db, 'ft-001', {
          gateFrameMapping: invalidGateMapping,
        })
      ).rejects.toThrow(
        'gate_frame_mapping missing required key: "vertical_open"'
      );
    });

    it('should return updated record', async () => {
      const { db, mocks } = createMockDb();
      const updated = { ...testFenceType, sortOrder: 5 };
      mocks.updateReturning.mockResolvedValue([updated]);

      const result = await updateFenceType(db, 'ft-001', { sortOrder: 5 });

      expect(result).toEqual(updated);
    });

    it('should return null when fence type to update not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValue([]);

      const result = await updateFenceType(db, 'nonexistent', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteFenceType', () => {
    it('should remove fence type by UUID', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteReturning.mockResolvedValue([testFenceType]);

      await deleteFenceType(db, 'ft-001');

      expect(mocks.deleteFn).toHaveBeenCalledWith(fenceTypes);
      expect(mocks.deleteReturning).toHaveBeenCalled();
    });

    it('should not error when deleting non-existent ID', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteReturning.mockResolvedValue([]);

      await expect(
        deleteFenceType(db, 'nonexistent')
      ).resolves.not.toThrow();
    });
  });
});
