/**
 * Compile-time validation tests for inventory schema definitions.
 *
 * These tests verify that the Drizzle table definitions produce correct
 * inferred types and that the schema exports are properly structured.
 */
import {
  inventories,
  ownerTypeEnum,
  type Inventory,
  type NewInventory,
} from './inventories';
import {
  inventorySlots,
  type InventorySlot,
  type NewInventorySlot,
} from './inventory-slots';

describe('inventories schema', () => {
  it('should export the inventories table', () => {
    expect(inventories).toBeDefined();
  });

  it('should export the ownerTypeEnum', () => {
    expect(ownerTypeEnum).toBeDefined();
  });

  it('should accept a valid NewInventory object with required fields only', () => {
    const record: NewInventory = {
      ownerType: 'player',
      ownerId: '00000000-0000-0000-0000-000000000001',
    };
    expect(record.ownerType).toBe('player');
    expect(record.ownerId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('should accept a valid NewInventory object with optional maxSlots', () => {
    const record: NewInventory = {
      ownerType: 'npc',
      ownerId: '00000000-0000-0000-0000-000000000002',
      maxSlots: 10,
    };
    expect(record.maxSlots).toBe(10);
  });

  it('should infer Inventory type with all expected fields', () => {
    // Compile-time assertion: if Inventory doesn't have these fields, this won't compile
    const record = {} as Inventory;
    const _id: string = record.id;
    const _ownerType: 'player' | 'npc' = record.ownerType;
    const _ownerId: string = record.ownerId;
    const _maxSlots: number = record.maxSlots;
    const _createdAt: Date = record.createdAt;
    const _updatedAt: Date = record.updatedAt;

    // Suppress unused variable warnings while keeping compile-time checks
    expect([_id, _ownerType, _ownerId, _maxSlots, _createdAt, _updatedAt]).toHaveLength(6);
  });
});

describe('inventorySlots schema', () => {
  it('should export the inventorySlots table', () => {
    expect(inventorySlots).toBeDefined();
  });

  it('should accept a valid NewInventorySlot object with required fields only', () => {
    const record: NewInventorySlot = {
      inventoryId: '00000000-0000-0000-0000-000000000001',
      slotIndex: 0,
    };
    expect(record.inventoryId).toBe('00000000-0000-0000-0000-000000000001');
    expect(record.slotIndex).toBe(0);
  });

  it('should accept a valid NewInventorySlot with optional fields', () => {
    const record: NewInventorySlot = {
      inventoryId: '00000000-0000-0000-0000-000000000001',
      slotIndex: 3,
      itemType: 'tool:hoe',
      quantity: 1,
      ownedByType: 'player',
      ownedById: '00000000-0000-0000-0000-000000000099',
    };
    expect(record.itemType).toBe('tool:hoe');
    expect(record.quantity).toBe(1);
    expect(record.ownedByType).toBe('player');
    expect(record.ownedById).toBe('00000000-0000-0000-0000-000000000099');
  });

  it('should infer InventorySlot type with all expected fields', () => {
    const record = {} as InventorySlot;
    const _id: string = record.id;
    const _inventoryId: string = record.inventoryId;
    const _slotIndex: number = record.slotIndex;
    const _itemType: string | null = record.itemType;
    const _quantity: number = record.quantity;
    const _ownedByType: 'player' | 'npc' | null = record.ownedByType;
    const _ownedById: string | null = record.ownedById;
    const _createdAt: Date = record.createdAt;
    const _updatedAt: Date = record.updatedAt;

    expect([
      _id, _inventoryId, _slotIndex, _itemType, _quantity,
      _ownedByType, _ownedById, _createdAt, _updatedAt,
    ]).toHaveLength(9);
  });
});
