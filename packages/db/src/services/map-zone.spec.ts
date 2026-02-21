import {
  createMapZone,
  getZonesForMap,
  updateMapZone,
  deleteMapZone,
} from './map-zone';
import type { CreateMapZoneData } from './map-zone';
import { editorMaps } from '../schema/editor-maps';
import { mapZones } from '../schema/map-zones';

function createMockDb() {
  const insertReturning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({ returning: insertReturning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  const selectOrderBy = jest.fn();
  const selectWhere = jest.fn().mockReturnValue({
    orderBy: selectOrderBy,
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
      update,
      updateSet,
      updateWhere,
      updateReturning,
      deleteFn,
      deleteWhere,
    },
  };
}

const testZoneData: CreateMapZoneData = {
  mapId: 'map-001',
  name: 'Town Square',
  zoneType: 'spawn',
  shape: 'rectangle',
  bounds: { x: 0, y: 0, width: 10, height: 10 },
};

const testZoneRecord = {
  id: 'zone-001',
  mapId: 'map-001',
  name: 'Town Square',
  zoneType: 'spawn',
  shape: 'rectangle',
  bounds: { x: 0, y: 0, width: 10, height: 10 },
  vertices: null,
  properties: null,
  zIndex: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const testEditorMap = {
  id: 'map-001',
  name: 'Test Map',
  mapType: 'town_district',
  width: 32,
  height: 32,
};

describe('MapZoneService', () => {
  describe('createMapZone', () => {
    it('should verify map exists then insert zone and return created record', async () => {
      const { db, mocks } = createMockDb();
      // First select: map existence check
      mocks.selectWhere.mockResolvedValueOnce([testEditorMap]);
      // Insert
      mocks.insertReturning.mockResolvedValue([testZoneRecord]);

      const result = await createMapZone(db, testZoneData);

      // Verify map existence check
      expect(mocks.selectFrom).toHaveBeenCalledWith(editorMaps);
      // Verify zone insert
      expect(mocks.insert).toHaveBeenCalledWith(mapZones);
      expect(result).toEqual(testZoneRecord);
    });

    it('should throw error when editor map not found', async () => {
      const { db, mocks } = createMockDb();
      mocks.selectWhere.mockResolvedValue([]);

      await expect(createMapZone(db, testZoneData)).rejects.toThrow(
        'Editor map not found: map-001'
      );
    });
  });

  describe('getZonesForMap', () => {
    it('should return zones ordered by zIndex ascending', async () => {
      const { db, mocks } = createMockDb();
      const zones = [
        { ...testZoneRecord, zIndex: 0 },
        { ...testZoneRecord, id: 'zone-002', zIndex: 1 },
      ];
      mocks.selectWhere.mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(zones),
      });

      const result = await getZonesForMap(db, 'map-001');

      expect(mocks.selectFrom).toHaveBeenCalledWith(mapZones);
      expect(result).toEqual(zones);
    });
  });

  describe('updateMapZone', () => {
    it('should update and return the updated zone', async () => {
      const { db, mocks } = createMockDb();
      const updated = { ...testZoneRecord, name: 'Market Square' };
      mocks.updateReturning.mockResolvedValue([updated]);

      const result = await updateMapZone(db, 'zone-001', {
        name: 'Market Square',
      });

      expect(mocks.update).toHaveBeenCalledWith(mapZones);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Market Square', updatedAt: expect.any(Date) })
      );
      expect(result).toEqual(updated);
    });
  });

  describe('deleteMapZone', () => {
    it('should delete zone by id', async () => {
      const { db, mocks } = createMockDb();

      await deleteMapZone(db, 'zone-001');

      expect(mocks.deleteFn).toHaveBeenCalledWith(mapZones);
      expect(mocks.deleteWhere).toHaveBeenCalled();
    });
  });
});
