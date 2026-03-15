import type {
  OwnerType,
  InventorySlotData,
  InventoryData,
  InventoryMovePayload,
  InventoryAddPayload,
  InventoryDropPayload,
  InventoryUpdatePayload,
} from './inventory';

/**
 * Compile-time structural validation tests for inventory types.
 *
 * These tests verify that the exported interfaces accept valid assignments
 * and that required/optional fields are correctly defined. Since these are
 * pure type definitions (no runtime logic), the tests primarily ensure
 * that the module exports compile and that structural shapes match the
 * Design Doc Component 2 specification.
 */
describe('Inventory types', () => {
  describe('OwnerType', () => {
    it('should accept "player" as a valid OwnerType', () => {
      const ownerType: OwnerType = 'player';
      expect(ownerType).toBe('player');
    });

    it('should accept "npc" as a valid OwnerType', () => {
      const ownerType: OwnerType = 'npc';
      expect(ownerType).toBe('npc');
    });
  });

  describe('InventorySlotData', () => {
    it('should accept a valid occupied slot', () => {
      const slot: InventorySlotData = {
        slotIndex: 0,
        itemType: 'hoe',
        quantity: 1,
        ownedByType: 'player',
        ownedById: 'uuid-1234',
      };

      expect(slot.slotIndex).toBe(0);
      expect(slot.itemType).toBe('hoe');
      expect(slot.quantity).toBe(1);
      expect(slot.ownedByType).toBe('player');
      expect(slot.ownedById).toBe('uuid-1234');
    });

    it('should accept an empty slot with null values', () => {
      const slot: InventorySlotData = {
        slotIndex: 5,
        itemType: null,
        quantity: 0,
        ownedByType: null,
        ownedById: null,
      };

      expect(slot.slotIndex).toBe(5);
      expect(slot.itemType).toBeNull();
      expect(slot.quantity).toBe(0);
      expect(slot.ownedByType).toBeNull();
      expect(slot.ownedById).toBeNull();
    });

    it('should accept an npc-owned slot', () => {
      const slot: InventorySlotData = {
        slotIndex: 3,
        itemType: 'watering_can',
        quantity: 1,
        ownedByType: 'npc',
        ownedById: 'npc-uuid-5678',
      };

      expect(slot.ownedByType).toBe('npc');
      expect(slot.ownedById).toBe('npc-uuid-5678');
    });
  });

  describe('InventoryData', () => {
    it('should accept a valid inventory with slots', () => {
      const inventory: InventoryData = {
        inventoryId: 'inv-uuid-001',
        maxSlots: 20,
        slots: [
          {
            slotIndex: 0,
            itemType: 'hoe',
            quantity: 1,
            ownedByType: 'player',
            ownedById: 'player-uuid',
          },
        ],
      };

      expect(inventory.inventoryId).toBe('inv-uuid-001');
      expect(inventory.maxSlots).toBe(20);
      expect(inventory.slots).toHaveLength(1);
    });

    it('should accept an inventory with empty slots array', () => {
      const inventory: InventoryData = {
        inventoryId: 'inv-uuid-002',
        maxSlots: 10,
        slots: [],
      };

      expect(inventory.slots).toHaveLength(0);
    });
  });

  describe('InventoryMovePayload', () => {
    it('should accept a move with required fields only', () => {
      const payload: InventoryMovePayload = {
        fromSlot: 0,
        toSlot: 10,
      };

      expect(payload.fromSlot).toBe(0);
      expect(payload.toSlot).toBe(10);
      expect(payload.quantity).toBeUndefined();
    });

    it('should accept a move with optional quantity', () => {
      const payload: InventoryMovePayload = {
        fromSlot: 0,
        toSlot: 10,
        quantity: 5,
      };

      expect(payload.quantity).toBe(5);
    });
  });

  describe('InventoryAddPayload', () => {
    it('should accept an add with required itemType only', () => {
      const payload: InventoryAddPayload = {
        itemType: 'seed_radish',
      };

      expect(payload.itemType).toBe('seed_radish');
      expect(payload.quantity).toBeUndefined();
      expect(payload.slotIndex).toBeUndefined();
    });

    it('should accept an add with all optional fields', () => {
      const payload: InventoryAddPayload = {
        itemType: 'wood',
        quantity: 10,
        slotIndex: 3,
      };

      expect(payload.quantity).toBe(10);
      expect(payload.slotIndex).toBe(3);
    });
  });

  describe('InventoryDropPayload', () => {
    it('should accept a drop with required slotIndex only', () => {
      const payload: InventoryDropPayload = {
        slotIndex: 2,
      };

      expect(payload.slotIndex).toBe(2);
      expect(payload.quantity).toBeUndefined();
    });

    it('should accept a drop with optional quantity', () => {
      const payload: InventoryDropPayload = {
        slotIndex: 2,
        quantity: 3,
      };

      expect(payload.quantity).toBe(3);
    });
  });

  describe('InventoryUpdatePayload', () => {
    it('should accept a successful update with no changed slots', () => {
      const payload: InventoryUpdatePayload = {
        success: true,
      };

      expect(payload.success).toBe(true);
      expect(payload.error).toBeUndefined();
      expect(payload.updatedSlots).toBeUndefined();
    });

    it('should accept a successful update with changed slots', () => {
      const payload: InventoryUpdatePayload = {
        success: true,
        updatedSlots: [
          {
            slotIndex: 0,
            itemType: null,
            quantity: 0,
            ownedByType: null,
            ownedById: null,
          },
          {
            slotIndex: 10,
            itemType: 'hoe',
            quantity: 1,
            ownedByType: 'player',
            ownedById: 'player-uuid',
          },
        ],
      };

      expect(payload.success).toBe(true);
      expect(payload.updatedSlots).toHaveLength(2);
    });

    it('should accept a failed update with error message', () => {
      const payload: InventoryUpdatePayload = {
        success: false,
        error: 'Inventory full',
      };

      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Inventory full');
      expect(payload.updatedSlots).toBeUndefined();
    });
  });
});
