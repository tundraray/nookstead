import {
  createMaterial,
  getMaterial,
  getMaterialByKey,
  listMaterials,
  listMaterialsByKeys,
  updateMaterial,
  deleteMaterial,
  countTilesetsByMaterial,
} from './material';
import type { CreateMaterialData } from './material';
import { materials } from '../schema/materials';

/**
 * Unit tests for MaterialService.
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

const testMaterialData: CreateMaterialData = {
  name: 'Grass',
  key: 'grass',
  color: '#22C55E',
  walkable: true,
  speedModifier: 1.0,
  swimRequired: false,
  damaging: false,
};

const testMaterial = {
  id: 'mat-001',
  ...testMaterialData,
  renderPriority: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('materials schema', () => {
  it('has a renderPriority column defined', () => {
    const col = materials.renderPriority;
    expect(col).toBeDefined();
    expect(col.notNull).toBe(true);
  });
});

describe('MaterialService', () => {
  describe('createMaterial', () => {
    it('should insert material data and return created record', async () => {
      const { db, mocks } = createMockDb();
      mocks.insertReturning.mockResolvedValue([testMaterial]);

      const result = await createMaterial(db, testMaterialData);

      expect(mocks.insert).toHaveBeenCalledWith(materials);
      expect(mocks.insertValues).toHaveBeenCalledWith(testMaterialData);
      expect(mocks.insertReturning).toHaveBeenCalled();
      expect(result).toEqual(testMaterial);
    });
  });

  describe('getMaterial', () => {
    it('should return material when found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testMaterial]);

      const result = await getMaterial(db, 'mat-001');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(materials);
      expect(result).toEqual(testMaterial);
    });

    it('should return null when material not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await getMaterial(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getMaterialByKey', () => {
    it('should return material when found by key', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testMaterial]);

      const result = await getMaterialByKey(db, 'grass');

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(materials);
      expect(result).toEqual(testMaterial);
    });

    it('should return null when key not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await getMaterialByKey(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listMaterials', () => {
    it('should return all materials ordered by name', async () => {
      const { db, mocks } = createMockDb();
      const materialsList = [testMaterial];
      mocks.selectOrderBy.mockResolvedValue(materialsList);

      const result = await listMaterials(db);

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(materials);
      expect(result).toEqual(materialsList);
    });
  });

  describe('updateMaterial', () => {
    it('should update and return updated material', async () => {
      const { db, mocks } = createMockDb();
      const updated = { ...testMaterial, name: 'Updated Grass' };
      mocks.updateReturning.mockResolvedValue([updated]);

      const result = await updateMaterial(db, 'mat-001', { name: 'Updated Grass' });

      expect(mocks.update).toHaveBeenCalledWith(materials);
      expect(result).toEqual(updated);
    });

    it('should return null when material to update not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateReturning.mockResolvedValue([]);

      const result = await updateMaterial(db, 'nonexistent', { name: 'Nope' });

      expect(result).toBeNull();
    });
  });

  describe('deleteMaterial', () => {
    it('should delete and return deleted material', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteReturning.mockResolvedValue([testMaterial]);

      const result = await deleteMaterial(db, 'mat-001');

      expect(mocks.deleteFn).toHaveBeenCalledWith(materials);
      expect(mocks.deleteReturning).toHaveBeenCalled();
      expect(result).toEqual(testMaterial);
    });

    it('should return null when material to delete not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteReturning.mockResolvedValue([]);

      const result = await deleteMaterial(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('countTilesetsByMaterial', () => {
    it('should return count of tilesets referencing the material', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([{ count: 3 }]);

      const result = await countTilesetsByMaterial(db, 'mat-001');

      expect(result).toBe(3);
    });

    it('should return 0 when no tilesets reference the material', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([{ count: 0 }]);

      const result = await countTilesetsByMaterial(db, 'mat-999');

      expect(result).toBe(0);
    });
  });

  describe('listMaterialsByKeys', () => {
    const waterMaterial = {
      id: 'mat-002',
      name: 'Water',
      key: 'water',
      color: '#3B82F6',
      walkable: false,
      speedModifier: 0.5,
      renderPriority: 5,
      swimRequired: true,
      damaging: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('should return matching materials for valid keys', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testMaterial, waterMaterial]);

      const result = await listMaterialsByKeys(db, ['grass', 'water']);

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(materials);
      expect(result).toHaveLength(2);
      const keys = result.map((m) => m.key);
      expect(keys).toContain('grass');
      expect(keys).toContain('water');
    });

    it('should return empty array for unknown keys', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      const result = await listMaterialsByKeys(db, ['nonexistent_key']);

      expect(result).toHaveLength(0);
    });

    it('should include renderPriority in returned materials', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([testMaterial]);

      const result = await listMaterialsByKeys(db, ['grass']);

      expect(result[0]).toHaveProperty('renderPriority');
      expect(typeof result[0].renderPriority).toBe('number');
    });

    it('should handle empty keys array by returning empty array without querying', async () => {
      const { db, mocks } = createMockDb();

      const result = await listMaterialsByKeys(db, []);

      expect(result).toHaveLength(0);
      expect(mocks.select).not.toHaveBeenCalled();
    });
  });
});
