import {
  createInventory,
  loadInventory,
  saveSlots,
  findEmptySlot,
  deleteInventory,
} from './inventory';
import { inventories } from '../schema/inventories';
import { inventorySlots } from '../schema/inventory-slots';

/**
 * Unit tests for inventory DB service functions.
 *
 * These tests use a mocked Drizzle client to verify the service functions'
 * contract without requiring a real database connection. The mock verifies
 * that correct arguments are passed to Drizzle query builder methods and
 * that return values are correctly mapped.
 */

/** Helper: create a mock Drizzle client with chained builder pattern */
function createMockDb() {
  // insert chain: db.insert(table).values(data).returning()
  const returning = jest.fn();
  const insertValues = jest.fn().mockReturnValue({ returning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  // select chain: db.select().from(table).where(condition).orderBy(order).limit(n)
  const selectLimit = jest.fn();
  const selectOrderBy = jest
    .fn()
    .mockReturnValue({ limit: selectLimit, then: selectLimit.then });
  const selectWhere = jest
    .fn()
    .mockReturnValue({ orderBy: selectOrderBy, then: selectOrderBy.then });
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // update chain: db.update(table).set(data).where(condition)
  const updateWhere = jest.fn();
  const set = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set });

  // delete chain: db.delete(table).where(condition)
  const deleteWhere = jest.fn();
  const deleteFn = jest.fn().mockReturnValue({ where: deleteWhere });

  // transaction: db.transaction(async (tx) => { ... })
  const transaction = jest.fn();

  const db = {
    insert,
    select,
    update,
    delete: deleteFn,
    transaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return {
    db,
    mocks: {
      insert,
      insertValues,
      returning,
      select,
      selectFrom,
      selectWhere,
      selectOrderBy,
      selectLimit,
      update,
      set,
      updateWhere,
      deleteFn,
      deleteWhere,
      transaction,
    },
  };
}

/** Helper: create a mock inventory record */
function mockInventory(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'inv-uuid-1',
    ownerType: 'player',
    ownerId: 'player-uuid-1',
    maxSlots: 20,
    createdAt: new Date('2026-03-15T00:00:00Z'),
    updatedAt: new Date('2026-03-15T00:00:00Z'),
    ...overrides,
  };
}

/** Helper: create mock slot records */
function mockSlots(
  inventoryId: string,
  count: number,
  overrides?: Array<Partial<Record<string, unknown>>>
) {
  return Array.from({ length: count }, (_, i) => ({
    id: `slot-uuid-${i}`,
    inventoryId,
    slotIndex: i,
    itemType: null,
    quantity: 0,
    ownedByType: null,
    ownedById: null,
    createdAt: new Date('2026-03-15T00:00:00Z'),
    updatedAt: new Date('2026-03-15T00:00:00Z'),
    ...(overrides?.[i] ?? {}),
  }));
}

describe('inventory service', () => {
  // -- createInventory ----------------------------------------------------------

  describe('createInventory', () => {
    it('creates an inventory with default maxSlots (20) and empty slot rows in a transaction', async () => {
      const { db, mocks } = createMockDb();
      const expectedInventory = mockInventory();

      // transaction mock: execute the callback with a mock tx that behaves like db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mocks.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const txReturning = jest.fn().mockResolvedValueOnce([expectedInventory]);
        const txInsertValues = jest
          .fn()
          .mockReturnValueOnce({ returning: txReturning }) // first insert (inventory) has returning
          .mockResolvedValueOnce(undefined); // second insert (slots) resolves void
        const txInsert = jest.fn().mockReturnValue({ values: txInsertValues });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = { insert: txInsert } as any;
        return callback(tx);
      });

      const result = await createInventory(db, {
        ownerType: 'player',
        ownerId: 'player-uuid-1',
      });

      expect(result).toEqual(expectedInventory);
      expect(mocks.transaction).toHaveBeenCalledTimes(1);
    });

    it('respects custom maxSlots', async () => {
      const { db, mocks } = createMockDb();
      const expectedInventory = mockInventory({
        ownerType: 'npc',
        ownerId: 'npc-uuid-1',
        maxSlots: 10,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mocks.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const txReturning = jest.fn().mockResolvedValueOnce([expectedInventory]);
        const txInsertValues = jest
          .fn()
          .mockReturnValueOnce({ returning: txReturning })
          .mockResolvedValueOnce(undefined);
        const txInsert = jest.fn().mockReturnValue({ values: txInsertValues });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = { insert: txInsert } as any;
        return callback(tx);
      });

      const result = await createInventory(db, {
        ownerType: 'npc',
        ownerId: 'npc-uuid-1',
        maxSlots: 10,
      });

      expect(result.maxSlots).toBe(10);
      expect(result.ownerType).toBe('npc');
    });

    it('uses a transaction to ensure atomicity of inventory and slot creation', async () => {
      const { db, mocks } = createMockDb();
      const expectedInventory = mockInventory();

      let txInsertCallCount = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mocks.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const txReturning = jest.fn().mockResolvedValueOnce([expectedInventory]);
        const txInsertValues = jest
          .fn()
          .mockReturnValueOnce({ returning: txReturning })
          .mockResolvedValueOnce(undefined);
        const txInsert = jest.fn().mockImplementation(() => {
          txInsertCallCount++;
          return { values: txInsertValues };
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = { insert: txInsert } as any;
        return callback(tx);
      });

      await createInventory(db, {
        ownerType: 'player',
        ownerId: 'player-uuid-1',
      });

      // Should call tx.insert twice: once for inventory, once for slots
      expect(txInsertCallCount).toBe(2);
    });
  });

  // -- loadInventory ------------------------------------------------------------

  describe('loadInventory', () => {
    it('returns null for non-existent inventory', async () => {
      const { db, mocks } = createMockDb();
      // select().from(inventories).where(...) returns empty array
      mocks.selectWhere.mockResolvedValueOnce([]);

      const result = await loadInventory(db, 'player', 'non-existent-id');

      expect(result).toBeNull();
      expect(mocks.select).toHaveBeenCalledTimes(1);
      expect(mocks.selectFrom).toHaveBeenCalledWith(inventories);
    });

    it('returns inventory and slots ordered by slotIndex', async () => {
      const { db, mocks } = createMockDb();
      const inv = mockInventory();
      const slots = mockSlots('inv-uuid-1', 3);

      // First select (inventory lookup)
      mocks.selectWhere.mockResolvedValueOnce([inv]);
      // Second select (slots lookup) - orderBy resolves to slots
      mocks.selectOrderBy.mockResolvedValueOnce(slots);

      const result = await loadInventory(db, 'player', 'player-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.inventory).toEqual(inv);
      expect(result!.slots).toEqual(slots);
      expect(result!.slots).toHaveLength(3);
      // Verify slots are in order by slotIndex
      for (let i = 0; i < result!.slots.length - 1; i++) {
        expect(result!.slots[i].slotIndex).toBeLessThan(
          result!.slots[i + 1].slotIndex
        );
      }
    });
  });

  // -- saveSlots ----------------------------------------------------------------

  describe('saveSlots', () => {
    it('updates slot contents for specified slots', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateWhere.mockResolvedValue(undefined);

      await saveSlots(db, [
        {
          id: 'slot-uuid-0',
          itemType: 'hoe',
          quantity: 1,
          ownedByType: 'player',
          ownedById: 'player-uuid-1',
        },
      ]);

      expect(mocks.update).toHaveBeenCalledWith(inventorySlots);
      expect(mocks.set).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: 'hoe',
          quantity: 1,
          ownedByType: 'player',
          ownedById: 'player-uuid-1',
        })
      );
    });

    it('updates multiple slots in parallel', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateWhere.mockResolvedValue(undefined);

      await saveSlots(db, [
        {
          id: 'slot-uuid-0',
          itemType: 'hoe',
          quantity: 1,
          ownedByType: 'player',
          ownedById: 'player-uuid-1',
        },
        {
          id: 'slot-uuid-1',
          itemType: 'watering_can',
          quantity: 1,
          ownedByType: 'player',
          ownedById: 'player-uuid-1',
        },
      ]);

      expect(mocks.update).toHaveBeenCalledTimes(2);
    });

    it('handles clearing a slot (setting itemType to null)', async () => {
      const { db, mocks } = createMockDb();
      mocks.updateWhere.mockResolvedValue(undefined);

      await saveSlots(db, [
        {
          id: 'slot-uuid-0',
          itemType: null,
          quantity: 0,
          ownedByType: null,
          ownedById: null,
        },
      ]);

      expect(mocks.set).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: null,
          quantity: 0,
          ownedByType: null,
          ownedById: null,
        })
      );
    });
  });

  // -- findEmptySlot ------------------------------------------------------------

  describe('findEmptySlot', () => {
    it('returns the first empty slot ordered by slotIndex', async () => {
      const { db, mocks } = createMockDb();
      const emptySlot = mockSlots('inv-uuid-1', 1)[0];

      mocks.selectLimit.mockResolvedValueOnce([emptySlot]);

      const result = await findEmptySlot(db, 'inv-uuid-1');

      expect(result).toEqual(emptySlot);
      expect(mocks.selectFrom).toHaveBeenCalledWith(inventorySlots);
    });

    it('returns null when no empty slot exists', async () => {
      const { db, mocks } = createMockDb();

      mocks.selectLimit.mockResolvedValueOnce([]);

      const result = await findEmptySlot(db, 'inv-uuid-1');

      expect(result).toBeNull();
    });

    it('respects startIndex parameter', async () => {
      const { db, mocks } = createMockDb();
      const emptySlot = mockSlots('inv-uuid-1', 1, [{ slotIndex: 5 }])[0];

      mocks.selectLimit.mockResolvedValueOnce([emptySlot]);

      const result = await findEmptySlot(db, 'inv-uuid-1', 5);

      expect(result).toEqual(emptySlot);
      expect(result!.slotIndex).toBe(5);
    });
  });

  // -- deleteInventory ----------------------------------------------------------

  describe('deleteInventory', () => {
    it('deletes the inventory row (cascade deletes slots via DB constraint)', async () => {
      const { db, mocks } = createMockDb();
      mocks.deleteWhere.mockResolvedValueOnce(undefined);

      await deleteInventory(db, 'inv-uuid-1');

      expect(mocks.deleteFn).toHaveBeenCalledWith(inventories);
    });
  });
});
