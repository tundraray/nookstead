import { HOTBAR_SLOT_COUNT, getItemDefinition } from '@nookstead/shared';
import type { DrizzleClient } from '@nookstead/db';
import type {
  createInventory as CreateInventoryFn,
  loadInventory as LoadInventoryFn,
  saveSlots as SaveSlotsFn,
} from '@nookstead/db';
import type { InventorySlotData, OwnerType } from '@nookstead/shared';
import type { Inventory, InventorySlot } from '@nookstead/db';

// ── Internal types ────────────────────────────────────────────────────────────

interface RuntimeSlot {
  id: string;
  slotIndex: number;
  itemType: string | null;
  quantity: number;
  ownedByType: OwnerType | null;
  ownedById: string | null;
  dirty: boolean;
}

interface RuntimeInventory {
  inventoryId: string;
  ownerType: OwnerType;
  ownerId: string;
  maxSlots: number;
  slots: RuntimeSlot[];
}

// ── Public result type ────────────────────────────────────────────────────────

export interface InventoryOperationResult {
  success: boolean;
  error?: string;
  changedSlots: InventorySlotData[];
  hotbarChanged: boolean;
}

// ── DB function interfaces for dependency injection ───────────────────────────

interface InitDbFunctions {
  loadInventory: typeof LoadInventoryFn;
  createInventory: typeof CreateInventoryFn;
}

interface SaveDbFunctions {
  saveSlots: typeof SaveSlotsFn;
}

// ── Test-only load interface ──────────────────────────────────────────────────

interface TestInventoryData {
  inventoryId: string;
  ownerType: OwnerType;
  ownerId: string;
  maxSlots: number;
  slots: Array<{
    id: string;
    slotIndex: number;
    itemType: string | null;
    quantity: number;
    ownedByType: OwnerType | null;
    ownedById: string | null;
  }>;
}

// ── InventoryManager ──────────────────────────────────────────────────────────

/**
 * Server-side inventory business logic engine.
 *
 * Manages in-memory state via a `Map<inventoryId, RuntimeInventory>` and
 * produces `InventoryOperationResult` objects for ChunkRoom to apply to
 * the Colyseus schema.
 *
 * Deliberately decoupled from Colyseus (same pattern as BotManager).
 * Never touches ChunkPlayer or ArraySchema -- returns change arrays
 * and hotbarChanged flags for the caller to apply.
 */
export class InventoryManager {
  private inventories = new Map<string, RuntimeInventory>();

  /**
   * Initialize an inventory for a player or NPC.
   * Loads from DB if it exists, creates a new one otherwise.
   * Returns the inventoryId.
   */
  async initInventory(
    db: DrizzleClient,
    ownerType: OwnerType,
    ownerId: string,
    dbFns: InitDbFunctions,
    maxSlots?: number
  ): Promise<string> {
    // Check if already loaded in memory
    const existing = this.findByOwner(ownerType, ownerId);
    if (existing) return existing.inventoryId;

    // Try loading from DB
    const loaded = await dbFns.loadInventory(db, ownerType, ownerId);
    if (loaded) {
      const runtime = this.toRuntime(loaded.inventory, loaded.slots);
      this.inventories.set(runtime.inventoryId, runtime);
      console.log(
        `[Inventory] Loaded: inventoryId=${runtime.inventoryId}, occupiedSlots=${loaded.slots.filter((s) => s.itemType !== null).length}/${loaded.slots.length}`
      );
      return runtime.inventoryId;
    }

    // Create new inventory
    const effectiveMaxSlots = maxSlots ?? 20;
    const inventory = await dbFns.createInventory(db, {
      ownerType,
      ownerId,
      maxSlots: effectiveMaxSlots,
    });
    const reloaded = await dbFns.loadInventory(db, ownerType, ownerId);
    const runtime = this.toRuntime(reloaded!.inventory, reloaded!.slots);
    this.inventories.set(runtime.inventoryId, runtime);
    console.log(
      `[Inventory] Created: ownerType=${ownerType}, ownerId=${ownerId}, maxSlots=${inventory.maxSlots}`
    );
    return runtime.inventoryId;
  }

  /**
   * Return hotbar slots (indices 0 through HOTBAR_SLOT_COUNT - 1).
   */
  getHotbarSlots(inventoryId: string): InventorySlotData[] {
    const inv = this.getInventory(inventoryId);
    return inv.slots
      .filter((s) => s.slotIndex < HOTBAR_SLOT_COUNT)
      .map(this.toSlotData);
  }

  /**
   * Return backpack slots (indices HOTBAR_SLOT_COUNT and above).
   */
  getBackpackSlots(inventoryId: string): InventorySlotData[] {
    const inv = this.getInventory(inventoryId);
    return inv.slots
      .filter((s) => s.slotIndex >= HOTBAR_SLOT_COUNT)
      .map(this.toSlotData);
  }

  /**
   * Move items from one slot to another.
   * Supports: move to empty, swap, merge stackable, split stack.
   */
  moveSlot(
    inventoryId: string,
    fromSlot: number,
    toSlot: number,
    quantity?: number
  ): InventoryOperationResult {
    const inv = this.getInventory(inventoryId);

    if (!this.isValidSlot(inv, fromSlot) || !this.isValidSlot(inv, toSlot)) {
      return this.failure('Slot index out of range');
    }

    const src = inv.slots[fromSlot];
    const dst = inv.slots[toSlot];

    // Source empty: no-op
    if (!src.itemType) {
      return { success: true, changedSlots: [], hotbarChanged: false };
    }

    // Destination empty: move (or split)
    if (!dst.itemType) {
      const moveQty = quantity ?? src.quantity;
      dst.itemType = src.itemType;
      dst.quantity = moveQty;
      dst.ownedByType = src.ownedByType;
      dst.ownedById = src.ownedById;
      src.quantity -= moveQty;
      if (src.quantity <= 0) this.clearSlot(src);
      src.dirty = true;
      dst.dirty = true;
    } else if (
      src.itemType === dst.itemType &&
      this.isStackable(src.itemType)
    ) {
      // Same stackable type: merge
      const def = getItemDefinition(src.itemType)!;
      const moveQty = quantity ?? src.quantity;
      const canFit = def.maxStack - dst.quantity;
      const moved = Math.min(moveQty, canFit);
      dst.quantity += moved;
      src.quantity -= moved;
      if (src.quantity <= 0) this.clearSlot(src);
      src.dirty = true;
      dst.dirty = true;
    } else {
      // Different types or non-stackable: swap
      if (quantity !== undefined) {
        return this.failure(
          'Cannot split when destination is occupied with a different item type'
        );
      }
      const tempType = dst.itemType;
      const tempQty = dst.quantity;
      const tempOwnedByType = dst.ownedByType;
      const tempOwnedById = dst.ownedById;
      dst.itemType = src.itemType;
      dst.quantity = src.quantity;
      dst.ownedByType = src.ownedByType;
      dst.ownedById = src.ownedById;
      src.itemType = tempType;
      src.quantity = tempQty;
      src.ownedByType = tempOwnedByType;
      src.ownedById = tempOwnedById;
      src.dirty = true;
      dst.dirty = true;
    }

    const changed = [src, dst].filter((s) => s.dirty).map(this.toSlotData);
    const hotbarChanged =
      fromSlot < HOTBAR_SLOT_COUNT || toSlot < HOTBAR_SLOT_COUNT;
    console.log(
      `[Inventory] Move: inventoryId=${inventoryId}, from=${fromSlot} to=${toSlot}, success=true`
    );
    return { success: true, changedSlots: changed, hotbarChanged };
  }

  /**
   * Add items to an inventory.
   * Stacks into existing partial stacks before using empty slots.
   * Overflows to next empty slot when stack is full.
   */
  addItem(
    inventoryId: string,
    itemType: string,
    quantity: number,
    ownership?: { type: OwnerType; id: string },
    targetSlot?: number
  ): InventoryOperationResult {
    const def = getItemDefinition(itemType);
    if (!def) return this.failure(`Unknown item type: ${itemType}`);
    const inv = this.getInventory(inventoryId);
    const changed: InventorySlotData[] = [];
    let remaining = quantity;

    // If a target slot is specified, try it first
    if (targetSlot !== undefined) {
      if (!this.isValidSlot(inv, targetSlot)) {
        return this.failure('Slot index out of range');
      }
      const slot = inv.slots[targetSlot];
      if (slot.itemType && slot.itemType !== itemType) {
        return this.failure('Target slot occupied by a different item');
      }
      const space = def.maxStack - (slot.quantity ?? 0);
      const add = Math.min(remaining, space);
      slot.itemType = itemType;
      slot.quantity = (slot.quantity ?? 0) + add;
      slot.ownedByType = ownership?.type ?? inv.ownerType;
      slot.ownedById = ownership?.id ?? inv.ownerId;
      slot.dirty = true;
      remaining -= add;
      changed.push(this.toSlotData(slot));
    }

    // Fill remaining quantity
    while (remaining > 0) {
      // Try to stack into existing partial stack
      if (def.stackable) {
        const existing = inv.slots.find(
          (s) => s.itemType === itemType && s.quantity < def.maxStack
        );
        if (existing) {
          const space = def.maxStack - existing.quantity;
          const add = Math.min(remaining, space);
          existing.quantity += add;
          existing.dirty = true;
          remaining -= add;
          changed.push(this.toSlotData(existing));
          continue;
        }
      }
      // Find empty slot
      const empty = inv.slots.find((s) => !s.itemType);
      if (!empty) {
        return {
          success: false,
          error: 'Inventory full',
          changedSlots: changed,
          hotbarChanged: changed.some((s) => s.slotIndex < HOTBAR_SLOT_COUNT),
        };
      }
      const add = Math.min(remaining, def.maxStack);
      empty.itemType = itemType;
      empty.quantity = add;
      empty.ownedByType = ownership?.type ?? inv.ownerType;
      empty.ownedById = ownership?.id ?? inv.ownerId;
      empty.dirty = true;
      remaining -= add;
      changed.push(this.toSlotData(empty));
    }

    const hotbarChanged = changed.some((s) => s.slotIndex < HOTBAR_SLOT_COUNT);
    console.log(
      `[Inventory] Add: inventoryId=${inventoryId}, itemType=${itemType}, qty=${quantity}, slot=${changed[0]?.slotIndex ?? 'none'}`
    );
    return { success: true, changedSlots: changed, hotbarChanged };
  }

  /**
   * Drop (remove) items from a slot.
   * If quantity is omitted, drops the entire stack.
   * If quantity exceeds available, drops all.
   */
  dropItem(
    inventoryId: string,
    slotIndex: number,
    quantity?: number
  ): InventoryOperationResult {
    const inv = this.getInventory(inventoryId);
    if (!this.isValidSlot(inv, slotIndex)) {
      return this.failure('Slot index out of range');
    }
    const slot = inv.slots[slotIndex];
    if (!slot.itemType) {
      return { success: true, changedSlots: [], hotbarChanged: false };
    }
    const dropQty = Math.min(quantity ?? slot.quantity, slot.quantity);
    slot.quantity -= dropQty;
    if (slot.quantity <= 0) this.clearSlot(slot);
    slot.dirty = true;
    console.log(
      `[Inventory] Drop: inventoryId=${inventoryId}, slot=${slotIndex}, qty=${dropQty}`
    );
    return {
      success: true,
      changedSlots: [this.toSlotData(slot)],
      hotbarChanged: slotIndex < HOTBAR_SLOT_COUNT,
    };
  }

  /**
   * Persist dirty slots to the database.
   * Only slots marked dirty are saved.
   */
  async saveInventory(
    db: DrizzleClient,
    inventoryId: string,
    dbFns: SaveDbFunctions
  ): Promise<void> {
    const inv = this.inventories.get(inventoryId);
    if (!inv) return;
    const dirty = inv.slots.filter((s) => s.dirty);
    if (dirty.length === 0) return;
    await dbFns.saveSlots(
      db,
      dirty.map((s) => ({
        id: s.id,
        itemType: s.itemType,
        quantity: s.quantity,
        ownedByType: s.ownedByType,
        ownedById: s.ownedById,
      }))
    );
    dirty.forEach((s) => {
      s.dirty = false;
    });
    console.log(
      `[Inventory] Save: inventoryId=${inventoryId}, dirtySlots=${dirty.length}`
    );
  }

  /**
   * Remove an inventory from memory.
   */
  unloadInventory(inventoryId: string): void {
    this.inventories.delete(inventoryId);
  }

  /**
   * Look up a loaded inventory by owner.
   * Returns undefined if no inventory is loaded for that owner.
   */
  getInventoryIdByOwner(
    ownerType: OwnerType,
    ownerId: string
  ): string | undefined {
    const inv = this.findByOwner(ownerType, ownerId);
    return inv?.inventoryId;
  }

  /**
   * Test-only method to load pre-populated inventory data without DB calls.
   */
  _testLoad(data: TestInventoryData): void {
    const runtime: RuntimeInventory = {
      inventoryId: data.inventoryId,
      ownerType: data.ownerType,
      ownerId: data.ownerId,
      maxSlots: data.maxSlots,
      slots: data.slots
        .map((s) => ({
          id: s.id,
          slotIndex: s.slotIndex,
          itemType: s.itemType,
          quantity: s.quantity,
          ownedByType: s.ownedByType,
          ownedById: s.ownedById,
          dirty: false,
        }))
        .sort((a, b) => a.slotIndex - b.slotIndex),
    };
    this.inventories.set(runtime.inventoryId, runtime);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private getInventory(inventoryId: string): RuntimeInventory {
    const inv = this.inventories.get(inventoryId);
    if (!inv) throw new Error(`Inventory not loaded: ${inventoryId}`);
    return inv;
  }

  private findByOwner(
    ownerType: OwnerType,
    ownerId: string
  ): RuntimeInventory | undefined {
    for (const inv of this.inventories.values()) {
      if (inv.ownerType === ownerType && inv.ownerId === ownerId) return inv;
    }
    return undefined;
  }

  private isValidSlot(inv: RuntimeInventory, slotIndex: number): boolean {
    return slotIndex >= 0 && slotIndex < inv.maxSlots;
  }

  private isStackable(itemType: string): boolean {
    return getItemDefinition(itemType)?.stackable ?? false;
  }

  private clearSlot(slot: RuntimeSlot): void {
    slot.itemType = null;
    slot.quantity = 0;
    slot.ownedByType = null;
    slot.ownedById = null;
  }

  private toSlotData = (slot: RuntimeSlot): InventorySlotData => ({
    slotIndex: slot.slotIndex,
    itemType: slot.itemType,
    quantity: slot.quantity,
    ownedByType: slot.ownedByType,
    ownedById: slot.ownedById,
  });

  private toRuntime(
    inventory: Inventory,
    slots: InventorySlot[]
  ): RuntimeInventory {
    return {
      inventoryId: inventory.id,
      ownerType: inventory.ownerType as OwnerType,
      ownerId: inventory.ownerId,
      maxSlots: inventory.maxSlots,
      slots: slots
        .map((s) => ({
          id: s.id,
          slotIndex: s.slotIndex,
          itemType: s.itemType ?? null,
          quantity: s.quantity ?? 0,
          ownedByType: (s.ownedByType as OwnerType) ?? null,
          ownedById: s.ownedById ?? null,
          dirty: false,
        }))
        .sort((a, b) => a.slotIndex - b.slotIndex),
    };
  }

  private failure(error: string): InventoryOperationResult {
    console.log(`[Inventory] Error: operation=generic, error=${error}`);
    return { success: false, error, changedSlots: [], hotbarChanged: false };
  }
}
