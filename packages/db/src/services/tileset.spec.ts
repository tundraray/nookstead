import { listTilesetsWithMaterials } from './tileset';
import { tilesets } from '../schema/tilesets';

/**
 * Unit tests for TilesetService - listTilesetsWithMaterials.
 *
 * Uses a mocked Drizzle client to verify the service function's contract
 * without requiring a real database connection.
 */

/** Helper: create a mock Drizzle client with chained builder for select + join */
function createMockDb() {
  const selectLeftJoin2 = jest.fn();
  const selectLeftJoin1 = jest
    .fn()
    .mockReturnValue({ leftJoin: selectLeftJoin2 });
  const selectFrom = jest
    .fn()
    .mockReturnValue({ leftJoin: selectLeftJoin1 });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { select } as any;

  return {
    db,
    mocks: {
      select,
      selectFrom,
      selectLeftJoin1,
      selectLeftJoin2,
    },
  };
}

const baseTileset = {
  key: 'terrain-grass-water',
  s3Url: 'https://s3.example.com/terrain-grass-water.png',
  fromMaterial: {
    key: 'grass',
    renderPriority: 40,
    color: '#22C55E',
  },
  toMaterial: {
    key: 'water',
    renderPriority: 5,
    color: '#3B82F6',
  },
};

const solidTileset = {
  key: 'terrain-grass-solid',
  s3Url: 'https://s3.example.com/terrain-grass-solid.png',
  fromMaterial: {
    key: 'grass',
    renderPriority: 40,
    color: '#22C55E',
  },
  toMaterial: null,
};

describe('TilesetService', () => {
  describe('listTilesetsWithMaterials', () => {
    it('should return tilesets with fromMaterial populated', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectLeftJoin2.mockResolvedValue([baseTileset, solidTileset]);

      const result = await listTilesetsWithMaterials(db);

      expect(mocks.select).toHaveBeenCalled();
      expect(mocks.selectFrom).toHaveBeenCalledWith(tilesets);
      const withFrom = result.filter(
        (t) => t.fromMaterial !== null
      );
      expect(withFrom.length).toBeGreaterThan(0);
      expect(withFrom[0].fromMaterial).toHaveProperty('key');
    });

    it('should return tilesets with toMaterial populated when relationship exists', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectLeftJoin2.mockResolvedValue([baseTileset]);

      const result = await listTilesetsWithMaterials(db);

      const withBoth = result.filter(
        (t) => t.fromMaterial !== null && t.toMaterial !== null
      );
      expect(withBoth.length).toBeGreaterThan(0);
      expect(withBoth[0].toMaterial).toHaveProperty('key');
    });

    it('should include tilesets where toMaterial is null (interior solid tilesets)', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectLeftJoin2.mockResolvedValue([baseTileset, solidTileset]);

      const result = await listTilesetsWithMaterials(db);

      expect(result.length).toBeGreaterThan(0);
      const solidEntries = result.filter((t) => t.toMaterial === null);
      expect(solidEntries.length).toBe(1);
      expect(solidEntries[0].key).toBe('terrain-grass-solid');
    });

    it('should include renderPriority in material objects', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectLeftJoin2.mockResolvedValue([baseTileset]);

      const result = await listTilesetsWithMaterials(db);

      const fromMat = result[0].fromMaterial;
      expect(fromMat).toHaveProperty('renderPriority');
      expect(fromMat).not.toBeNull();
      expect(typeof fromMat?.renderPriority).toBe('number');
      const toMat = result[0].toMaterial;
      expect(toMat).toHaveProperty('renderPriority');
      expect(toMat).not.toBeNull();
      expect(typeof toMat?.renderPriority).toBe('number');
    });

    it('should return empty array when no tilesets exist', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectLeftJoin2.mockResolvedValue([]);

      const result = await listTilesetsWithMaterials(db);

      expect(result).toHaveLength(0);
    });
  });
});
