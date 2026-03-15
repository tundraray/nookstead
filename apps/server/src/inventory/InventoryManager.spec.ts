import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HOTBAR_SLOT_COUNT } from '@nookstead/shared';
import { InventoryManager } from './InventoryManager.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

interface TestSlot {
  id: string;
  slotIndex: number;
  itemType: string | null;
  quantity: number;
  ownedByType: 'player' | 'npc' | null;
  ownedById: string | null;
}

/**
 * Create a test inventory with N empty slots and load it into the manager
 * via the internal _testLoad method (avoids DB calls for unit tests).
 */
function loadTestInventory(
  manager: InventoryManager,
  opts?: {
    inventoryId?: string;
    ownerType?: 'player' | 'npc';
    ownerId?: string;
    maxSlots?: number;
    slots?: TestSlot[];
  }
): string {
  const inventoryId = opts?.inventoryId ?? 'inv-test-1';
  const ownerType = opts?.ownerType ?? 'player';
  const ownerId = opts?.ownerId ?? 'player-uuid-1';
  const maxSlots = opts?.maxSlots ?? 20;
  const slots: TestSlot[] =
    opts?.slots ??
    Array.from({ length: maxSlots }, (_, i) => ({
      id: `slot-${i}`,
      slotIndex: i,
      itemType: null,
      quantity: 0,
      ownedByType: null,
      ownedById: null,
    }));

  manager._testLoad({
    inventoryId,
    ownerType,
    ownerId,
    maxSlots,
    slots,
  });

  return inventoryId;
}

/**
 * Create a slot with item data.
 */
function makeSlot(
  slotIndex: number,
  itemType: string | null,
  quantity: number,
  ownedByType: 'player' | 'npc' | null = null,
  ownedById: string | null = null
): TestSlot {
  return {
    id: `slot-${slotIndex}`,
    slotIndex,
    itemType,
    quantity,
    ownedByType,
    ownedById,
  };
}

/**
 * Helper to sum all quantities in an inventory for conservation checks.
 */
function sumQuantities(manager: InventoryManager, inventoryId: string): number {
  const hotbar = manager.getHotbarSlots(inventoryId);
  const backpack = manager.getBackpackSlots(inventoryId);
  return [...hotbar, ...backpack].reduce((sum, s) => sum + s.quantity, 0);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('InventoryManager', () => {
  let manager: InventoryManager;

  beforeEach(() => {
    manager = new InventoryManager();
  });

  // ── initInventory ────────────────────────────────────────────────────────

  describe('initInventory', () => {
    it('should load an existing inventory from DB', async () => {
      const mockDb = {} as any;
      const mockLoadInventory = jest.fn<any>().mockResolvedValue({
        inventory: {
          id: 'inv-from-db',
          ownerType: 'player',
          ownerId: 'player-1',
          maxSlots: 20,
        },
        slots: Array.from({ length: 20 }, (_, i) => ({
          id: `db-slot-${i}`,
          slotIndex: i,
          itemType: null,
          quantity: 0,
          ownedByType: null,
          ownedById: null,
        })),
      });

      const result = await manager.initInventory(
        mockDb,
        'player',
        'player-1',
        { loadInventory: mockLoadInventory, createInventory: jest.fn() as any }
      );

      expect(result).toBe('inv-from-db');
      expect(mockLoadInventory).toHaveBeenCalledWith(
        mockDb,
        'player',
        'player-1'
      );
    });

    it('should create a new inventory when none exists', async () => {
      const mockDb = {} as any;
      const mockLoadInventory = jest
        .fn<any>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          inventory: {
            id: 'new-inv',
            ownerType: 'player',
            ownerId: 'player-1',
            maxSlots: 20,
          },
          slots: Array.from({ length: 20 }, (_, i) => ({
            id: `new-slot-${i}`,
            slotIndex: i,
            itemType: null,
            quantity: 0,
            ownedByType: null,
            ownedById: null,
          })),
        });
      const mockCreateInventory = jest.fn<any>().mockResolvedValue({
        id: 'new-inv',
        ownerType: 'player',
        ownerId: 'player-1',
        maxSlots: 20,
      });

      const result = await manager.initInventory(
        mockDb,
        'player',
        'player-1',
        {
          loadInventory: mockLoadInventory,
          createInventory: mockCreateInventory,
        }
      );

      expect(result).toBe('new-inv');
      expect(mockCreateInventory).toHaveBeenCalledWith(mockDb, {
        ownerType: 'player',
        ownerId: 'player-1',
        maxSlots: 20,
      });
    });

    it('should return existing inventoryId if already loaded in memory', async () => {
      loadTestInventory(manager, {
        inventoryId: 'cached-inv',
        ownerType: 'player',
        ownerId: 'player-1',
      });

      const mockDb = {} as any;
      const result = await manager.initInventory(
        mockDb,
        'player',
        'player-1',
        { loadInventory: jest.fn() as any, createInventory: jest.fn() as any }
      );

      expect(result).toBe('cached-inv');
    });
  });

  // ── addItem ──────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should add an item to the first empty slot', () => {
      const invId = loadTestInventory(manager);

      const result = manager.addItem(invId, 'hoe', 1);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(1);
      expect(result.changedSlots[0].slotIndex).toBe(0);
      expect(result.changedSlots[0].itemType).toBe('hoe');
      expect(result.changedSlots[0].quantity).toBe(1);
    });

    it('should stack into an existing partial stack', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 10, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.addItem(invId, 'wood', 5);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(1);
      expect(result.changedSlots[0].slotIndex).toBe(0);
      expect(result.changedSlots[0].quantity).toBe(15);
    });

    it('should overflow to next empty slot when stack is full', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 99, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.addItem(invId, 'wood', 5);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(1);
      expect(result.changedSlots[0].slotIndex).toBe(1);
      expect(result.changedSlots[0].itemType).toBe('wood');
      expect(result.changedSlots[0].quantity).toBe(5);
    });

    it('should partially fill a partial stack then overflow remainder to empty slot', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 95, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.addItem(invId, 'wood', 10);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(2);
      // First slot filled to maxStack
      const slot0 = result.changedSlots.find((s) => s.slotIndex === 0);
      expect(slot0?.quantity).toBe(99);
      // Remainder in next empty slot
      const slot1 = result.changedSlots.find((s) => s.slotIndex === 1);
      expect(slot1?.quantity).toBe(6);
      expect(slot1?.itemType).toBe('wood');
    });

    it('should return failure when inventory is full', () => {
      const invId = loadTestInventory(manager, {
        maxSlots: 2,
        slots: [
          makeSlot(0, 'hoe', 1, 'player', 'player-uuid-1'),
          makeSlot(1, 'sickle', 1, 'player', 'player-uuid-1'),
        ],
      });

      const result = manager.addItem(invId, 'wood', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory full');
    });

    it('should reject unknown item types', () => {
      const invId = loadTestInventory(manager);

      const result = manager.addItem(invId, 'nonexistent_item', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown item type');
    });

    it('should set explicit ownership when provided', () => {
      const invId = loadTestInventory(manager);

      const result = manager.addItem(invId, 'hoe', 1, {
        type: 'npc',
        id: 'npc-uuid',
      });

      expect(result.success).toBe(true);
      expect(result.changedSlots[0].ownedByType).toBe('npc');
      expect(result.changedSlots[0].ownedById).toBe('npc-uuid');
    });

    it('should default ownership to inventory owner when not specified', () => {
      const invId = loadTestInventory(manager, {
        ownerType: 'player',
        ownerId: 'player-uuid-1',
      });

      const result = manager.addItem(invId, 'hoe', 1);

      expect(result.success).toBe(true);
      expect(result.changedSlots[0].ownedByType).toBe('player');
      expect(result.changedSlots[0].ownedById).toBe('player-uuid-1');
    });

    it('should not stack non-stackable items', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'hoe', 1, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.addItem(invId, 'hoe', 1);

      expect(result.success).toBe(true);
      // Should go to slot 1, not stack into slot 0
      expect(result.changedSlots[0].slotIndex).toBe(1);
      expect(result.changedSlots[0].quantity).toBe(1);
    });

    it('should set hotbarChanged true when adding to hotbar slots', () => {
      const invId = loadTestInventory(manager);

      const result = manager.addItem(invId, 'hoe', 1);

      expect(result.hotbarChanged).toBe(true);
    });

    it('should set hotbarChanged false when adding only to backpack slots', () => {
      // Fill all hotbar slots
      const slots = [
        ...Array.from({ length: HOTBAR_SLOT_COUNT }, (_, i) =>
          makeSlot(i, 'hoe', 1, 'player', 'player-uuid-1')
        ),
        ...Array.from({ length: 10 }, (_, i) =>
          makeSlot(i + HOTBAR_SLOT_COUNT, null, 0)
        ),
      ];
      const invId = loadTestInventory(manager, { slots });

      const result = manager.addItem(invId, 'wood', 5);

      expect(result.success).toBe(true);
      expect(result.hotbarChanged).toBe(false);
      expect(result.changedSlots[0].slotIndex).toBe(HOTBAR_SLOT_COUNT);
    });
  });

  // ── moveSlot ─────────────────────────────────────────────────────────────

  describe('moveSlot', () => {
    it('should move to empty destination', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'hoe', 1, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 5);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(2);
      const src = result.changedSlots.find((s) => s.slotIndex === 0);
      const dst = result.changedSlots.find((s) => s.slotIndex === 5);
      expect(src?.itemType).toBeNull();
      expect(src?.quantity).toBe(0);
      expect(dst?.itemType).toBe('hoe');
      expect(dst?.quantity).toBe(1);
    });

    it('should swap different types', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'hoe', 1, 'player', 'player-uuid-1'),
          makeSlot(1, 'wood', 5, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 1);

      expect(result.success).toBe(true);
      const slot0 = result.changedSlots.find((s) => s.slotIndex === 0);
      const slot1 = result.changedSlots.find((s) => s.slotIndex === 1);
      expect(slot0?.itemType).toBe('wood');
      expect(slot0?.quantity).toBe(5);
      expect(slot1?.itemType).toBe('hoe');
      expect(slot1?.quantity).toBe(1);
    });

    it('should merge same stackable type', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 10, 'player', 'player-uuid-1'),
          makeSlot(1, 'wood', 20, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 1);

      expect(result.success).toBe(true);
      const slot0 = result.changedSlots.find((s) => s.slotIndex === 0);
      const slot1 = result.changedSlots.find((s) => s.slotIndex === 1);
      expect(slot0?.itemType).toBeNull();
      expect(slot0?.quantity).toBe(0);
      expect(slot1?.quantity).toBe(30);
    });

    it('should merge with overflow when exceeding maxStack', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 90, 'player', 'player-uuid-1'),
          makeSlot(1, 'wood', 20, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 1);

      expect(result.success).toBe(true);
      const slot0 = result.changedSlots.find((s) => s.slotIndex === 0);
      const slot1 = result.changedSlots.find((s) => s.slotIndex === 1);
      expect(slot1?.quantity).toBe(99);
      expect(slot0?.quantity).toBe(11);
      expect(slot0?.itemType).toBe('wood');
    });

    it('should be no-op when both slots are empty', () => {
      const invId = loadTestInventory(manager);

      const result = manager.moveSlot(invId, 0, 5);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(0);
    });

    it('should be no-op when source is empty', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, null, 0),
          makeSlot(1, 'wood', 5, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 1);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(0);
    });

    it('should return failure for invalid slot index (negative)', () => {
      const invId = loadTestInventory(manager);

      const result = manager.moveSlot(invId, -1, 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of range');
    });

    it('should return failure for slot index beyond maxSlots', () => {
      const invId = loadTestInventory(manager);

      const result = manager.moveSlot(invId, 0, 99);

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of range');
    });

    it('should split stack when quantity is specified', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 20, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 5, 8);

      expect(result.success).toBe(true);
      const slot0 = result.changedSlots.find((s) => s.slotIndex === 0);
      const slot5 = result.changedSlots.find((s) => s.slotIndex === 5);
      expect(slot0?.itemType).toBe('wood');
      expect(slot0?.quantity).toBe(12);
      expect(slot5?.itemType).toBe('wood');
      expect(slot5?.quantity).toBe(8);
    });

    it('should conserve total item count on move to empty', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 50, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const totalBefore = sumQuantities(manager, invId);
      manager.moveSlot(invId, 0, 5);
      const totalAfter = sumQuantities(manager, invId);

      expect(totalAfter).toBe(totalBefore);
    });

    it('should conserve total item count on swap', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'hoe', 1, 'player', 'player-uuid-1'),
          makeSlot(1, 'wood', 50, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const totalBefore = sumQuantities(manager, invId);
      manager.moveSlot(invId, 0, 1);
      const totalAfter = sumQuantities(manager, invId);

      expect(totalAfter).toBe(totalBefore);
    });

    it('should conserve total item count on merge', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 10, 'player', 'player-uuid-1'),
          makeSlot(1, 'wood', 20, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const totalBefore = sumQuantities(manager, invId);
      manager.moveSlot(invId, 0, 1);
      const totalAfter = sumQuantities(manager, invId);

      expect(totalAfter).toBe(totalBefore);
    });

    it('should conserve total item count on merge with overflow', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 90, 'player', 'player-uuid-1'),
          makeSlot(1, 'wood', 20, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const totalBefore = sumQuantities(manager, invId);
      manager.moveSlot(invId, 0, 1);
      const totalAfter = sumQuantities(manager, invId);

      expect(totalAfter).toBe(totalBefore);
    });

    it('should preserve ownership on move', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'hoe', 1, 'npc', 'npc-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 5);

      expect(result.success).toBe(true);
      const dst = result.changedSlots.find((s) => s.slotIndex === 5);
      expect(dst?.ownedByType).toBe('npc');
      expect(dst?.ownedById).toBe('npc-uuid-1');
    });

    it('should preserve ownership on swap', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'hoe', 1, 'npc', 'npc-uuid-1'),
          makeSlot(1, 'wood', 5, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 1);

      const slot0 = result.changedSlots.find((s) => s.slotIndex === 0);
      const slot1 = result.changedSlots.find((s) => s.slotIndex === 1);
      // slot 0 now has wood with player ownership
      expect(slot0?.ownedByType).toBe('player');
      expect(slot0?.ownedById).toBe('player-uuid-1');
      // slot 1 now has hoe with npc ownership
      expect(slot1?.ownedByType).toBe('npc');
      expect(slot1?.ownedById).toBe('npc-uuid-1');
    });

    it('should set hotbarChanged true when moving from hotbar', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'hoe', 1, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 15);

      expect(result.hotbarChanged).toBe(true);
    });

    it('should set hotbarChanged true when moving to hotbar', () => {
      const slots = [
        ...Array.from({ length: HOTBAR_SLOT_COUNT }, (_, i) =>
          makeSlot(i, null, 0)
        ),
        makeSlot(HOTBAR_SLOT_COUNT, 'hoe', 1, 'player', 'player-uuid-1'),
        ...Array.from({ length: 9 }, (_, i) =>
          makeSlot(i + HOTBAR_SLOT_COUNT + 1, null, 0)
        ),
      ];
      const invId = loadTestInventory(manager, { slots });

      const result = manager.moveSlot(invId, HOTBAR_SLOT_COUNT, 0);

      expect(result.hotbarChanged).toBe(true);
    });

    it('should set hotbarChanged false when moving between backpack slots', () => {
      const slots = [
        ...Array.from({ length: HOTBAR_SLOT_COUNT }, (_, i) =>
          makeSlot(i, null, 0)
        ),
        makeSlot(HOTBAR_SLOT_COUNT, 'hoe', 1, 'player', 'player-uuid-1'),
        ...Array.from({ length: 9 }, (_, i) =>
          makeSlot(i + HOTBAR_SLOT_COUNT + 1, null, 0)
        ),
      ];
      const invId = loadTestInventory(manager, { slots });

      const result = manager.moveSlot(invId, HOTBAR_SLOT_COUNT, 15);

      expect(result.hotbarChanged).toBe(false);
    });

    it('should reject splitting when destination has a different item type', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 20, 'player', 'player-uuid-1'),
          makeSlot(1, 'hoe', 1, 'player', 'player-uuid-1'),
          ...Array.from({ length: 18 }, (_, i) =>
            makeSlot(i + 2, null, 0)
          ),
        ],
      });

      const result = manager.moveSlot(invId, 0, 1, 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('different item type');
    });
  });

  // ── dropItem ─────────────────────────────────────────────────────────────

  describe('dropItem', () => {
    it('should drop all items from a slot', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 5, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.dropItem(invId, 0);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(1);
      expect(result.changedSlots[0].itemType).toBeNull();
      expect(result.changedSlots[0].quantity).toBe(0);
    });

    it('should drop partial quantity', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 5, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.dropItem(invId, 0, 3);

      expect(result.success).toBe(true);
      expect(result.changedSlots[0].itemType).toBe('wood');
      expect(result.changedSlots[0].quantity).toBe(2);
    });

    it('should be no-op when dropping from empty slot', () => {
      const invId = loadTestInventory(manager);

      const result = manager.dropItem(invId, 0);

      expect(result.success).toBe(true);
      expect(result.changedSlots).toHaveLength(0);
    });

    it('should drop all when quantity exceeds available', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 5, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.dropItem(invId, 0, 99);

      expect(result.success).toBe(true);
      expect(result.changedSlots[0].itemType).toBeNull();
      expect(result.changedSlots[0].quantity).toBe(0);
    });

    it('should return failure for invalid slot index', () => {
      const invId = loadTestInventory(manager);

      const result = manager.dropItem(invId, -1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of range');
    });

    it('should set hotbarChanged true when dropping from hotbar', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'wood', 5, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const result = manager.dropItem(invId, 0);

      expect(result.hotbarChanged).toBe(true);
    });

    it('should set hotbarChanged false when dropping from backpack', () => {
      const slots = [
        ...Array.from({ length: HOTBAR_SLOT_COUNT }, (_, i) =>
          makeSlot(i, null, 0)
        ),
        makeSlot(HOTBAR_SLOT_COUNT, 'wood', 5, 'player', 'player-uuid-1'),
        ...Array.from({ length: 9 }, (_, i) =>
          makeSlot(i + HOTBAR_SLOT_COUNT + 1, null, 0)
        ),
      ];
      const invId = loadTestInventory(manager, { slots });

      const result = manager.dropItem(invId, HOTBAR_SLOT_COUNT);

      expect(result.hotbarChanged).toBe(false);
    });
  });

  // ── getHotbarSlots / getBackpackSlots ────────────────────────────────────

  describe('getHotbarSlots', () => {
    it('should return slots 0 through HOTBAR_SLOT_COUNT - 1', () => {
      const invId = loadTestInventory(manager);

      const hotbar = manager.getHotbarSlots(invId);

      expect(hotbar).toHaveLength(HOTBAR_SLOT_COUNT);
      hotbar.forEach((slot, i) => {
        expect(slot.slotIndex).toBe(i);
      });
    });

    it('should return populated slots with correct data', () => {
      const invId = loadTestInventory(manager, {
        slots: [
          makeSlot(0, 'hoe', 1, 'player', 'player-uuid-1'),
          ...Array.from({ length: 19 }, (_, i) =>
            makeSlot(i + 1, null, 0)
          ),
        ],
      });

      const hotbar = manager.getHotbarSlots(invId);

      expect(hotbar[0].itemType).toBe('hoe');
      expect(hotbar[0].quantity).toBe(1);
      expect(hotbar[1].itemType).toBeNull();
    });
  });

  describe('getBackpackSlots', () => {
    it('should return slots starting from HOTBAR_SLOT_COUNT', () => {
      const invId = loadTestInventory(manager);

      const backpack = manager.getBackpackSlots(invId);

      expect(backpack).toHaveLength(10); // 20 - 10
      backpack.forEach((slot, i) => {
        expect(slot.slotIndex).toBe(i + HOTBAR_SLOT_COUNT);
      });
    });
  });

  // ── saveInventory ────────────────────────────────────────────────────────

  describe('saveInventory', () => {
    it('should only save dirty slots', async () => {
      const invId = loadTestInventory(manager);

      // Add an item to mark slot 0 as dirty
      manager.addItem(invId, 'hoe', 1);

      const mockDb = {} as any;
      const mockSaveSlots = jest.fn<any>().mockResolvedValue(undefined);

      await manager.saveInventory(mockDb, invId, {
        saveSlots: mockSaveSlots,
      });

      expect(mockSaveSlots).toHaveBeenCalledTimes(1);
      const savedSlots = mockSaveSlots.mock.calls[0][1] as Array<{
        id: string;
        itemType: string | null;
        quantity: number;
        ownedByType: string | null;
        ownedById: string | null;
      }>;
      expect(savedSlots).toHaveLength(1);
      expect(savedSlots[0].itemType).toBe('hoe');
    });

    it('should skip save when no dirty slots exist', async () => {
      const invId = loadTestInventory(manager);

      const mockDb = {} as any;
      const mockSaveSlots = jest.fn<any>().mockResolvedValue(undefined);

      await manager.saveInventory(mockDb, invId, {
        saveSlots: mockSaveSlots,
      });

      expect(mockSaveSlots).not.toHaveBeenCalled();
    });

    it('should clear dirty flags after save', async () => {
      const invId = loadTestInventory(manager);
      manager.addItem(invId, 'hoe', 1);

      const mockDb = {} as any;
      const mockSaveSlots = jest.fn<any>().mockResolvedValue(undefined);

      await manager.saveInventory(mockDb, invId, {
        saveSlots: mockSaveSlots,
      });

      // Second save should have no dirty slots
      await manager.saveInventory(mockDb, invId, {
        saveSlots: mockSaveSlots,
      });

      expect(mockSaveSlots).toHaveBeenCalledTimes(1);
    });

    it('should no-op if inventoryId does not exist', async () => {
      const mockDb = {} as any;
      const mockSaveSlots = jest.fn<any>().mockResolvedValue(undefined);

      // Should not throw
      await manager.saveInventory(mockDb, 'nonexistent', {
        saveSlots: mockSaveSlots,
      });

      expect(mockSaveSlots).not.toHaveBeenCalled();
    });
  });

  // ── unloadInventory ──────────────────────────────────────────────────────

  describe('unloadInventory', () => {
    it('should remove inventory from memory', () => {
      const invId = loadTestInventory(manager);

      manager.unloadInventory(invId);

      expect(() => manager.getHotbarSlots(invId)).toThrow(
        'Inventory not loaded'
      );
    });

    it('should no-op for nonexistent inventory', () => {
      // Should not throw
      manager.unloadInventory('nonexistent');
    });
  });

  // ── getInventoryIdByOwner ────────────────────────────────────────────────

  describe('getInventoryIdByOwner', () => {
    it('should return inventoryId for loaded inventory', () => {
      const invId = loadTestInventory(manager, {
        ownerType: 'player',
        ownerId: 'player-uuid-1',
      });

      const result = manager.getInventoryIdByOwner('player', 'player-uuid-1');

      expect(result).toBe(invId);
    });

    it('should return undefined for unknown owner', () => {
      const result = manager.getInventoryIdByOwner('player', 'unknown');

      expect(result).toBeUndefined();
    });
  });

  // ── Error cases ──────────────────────────────────────────────────────────

  describe('error cases', () => {
    it('should throw when accessing unloaded inventory via getHotbarSlots', () => {
      expect(() => manager.getHotbarSlots('nonexistent')).toThrow(
        'Inventory not loaded'
      );
    });

    it('should throw when accessing unloaded inventory via addItem', () => {
      expect(() => manager.addItem('nonexistent', 'hoe', 1)).toThrow(
        'Inventory not loaded'
      );
    });

    it('should throw when accessing unloaded inventory via moveSlot', () => {
      expect(() => manager.moveSlot('nonexistent', 0, 1)).toThrow(
        'Inventory not loaded'
      );
    });

    it('should throw when accessing unloaded inventory via dropItem', () => {
      expect(() => manager.dropItem('nonexistent', 0)).toThrow(
        'Inventory not loaded'
      );
    });
  });
});
