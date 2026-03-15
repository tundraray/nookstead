import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { inventories, type Inventory } from '../schema/inventories';
import { inventorySlots, type InventorySlot } from '../schema/inventory-slots';

/**
 * Create a new inventory with empty slot rows in a single transaction.
 * The inventory row and all slot rows are inserted atomically.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param data - Inventory creation data (ownerType, ownerId, optional maxSlots)
 * @returns The created Inventory record
 */
export async function createInventory(
  db: DrizzleClient,
  data: { ownerType: 'player' | 'npc'; ownerId: string; maxSlots?: number }
): Promise<Inventory> {
  const maxSlots = data.maxSlots ?? 20;

  return db.transaction(async (tx) => {
    const [inventory] = await tx
      .insert(inventories)
      .values({
        ownerType: data.ownerType,
        ownerId: data.ownerId,
        maxSlots,
      })
      .returning();

    const slotRows = Array.from({ length: maxSlots }, (_, i) => ({
      inventoryId: inventory.id,
      slotIndex: i,
    }));

    await tx.insert(inventorySlots).values(slotRows);

    return inventory;
  });
}

/**
 * Load an inventory and its slots by owner.
 * Returns null if the inventory does not exist.
 * Slots are ordered by slotIndex ascending.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param ownerType - Owner discriminator ('player' or 'npc')
 * @param ownerId - Owner UUID
 * @returns Inventory with ordered slots, or null if not found
 */
export async function loadInventory(
  db: DrizzleClient,
  ownerType: 'player' | 'npc',
  ownerId: string
): Promise<{ inventory: Inventory; slots: InventorySlot[] } | null> {
  const [inventory] = await db
    .select()
    .from(inventories)
    .where(
      and(eq(inventories.ownerType, ownerType), eq(inventories.ownerId, ownerId))
    );

  if (!inventory) return null;

  const slots = await db
    .select()
    .from(inventorySlots)
    .where(eq(inventorySlots.inventoryId, inventory.id))
    .orderBy(asc(inventorySlots.slotIndex));

  return { inventory, slots };
}

/**
 * Batch update slot contents. Only the specified fields are updated.
 * Uses Promise.all for parallel updates (acceptable for MVP).
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param updates - Array of slot updates with id, itemType, quantity, ownership
 */
export async function saveSlots(
  db: DrizzleClient,
  updates: Array<{
    id: string;
    itemType: string | null;
    quantity: number;
    ownedByType: string | null;
    ownedById: string | null;
  }>
): Promise<void> {
  await Promise.all(
    updates.map((u) =>
      db
        .update(inventorySlots)
        .set({
          itemType: u.itemType,
          quantity: u.quantity,
          ownedByType: u.ownedByType as 'player' | 'npc' | null,
          ownedById: u.ownedById,
          updatedAt: new Date(),
        })
        .where(eq(inventorySlots.id, u.id))
    )
  );
}

/**
 * Find the first empty slot (itemType IS NULL) in an inventory.
 * Returns null if no empty slot exists.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param inventoryId - Inventory UUID
 * @param startIndex - Minimum slotIndex to search from (default 0)
 * @returns The first empty InventorySlot, or null
 */
export async function findEmptySlot(
  db: DrizzleClient,
  inventoryId: string,
  startIndex = 0
): Promise<InventorySlot | null> {
  const [slot] = await db
    .select()
    .from(inventorySlots)
    .where(
      and(
        eq(inventorySlots.inventoryId, inventoryId),
        isNull(inventorySlots.itemType),
        gte(inventorySlots.slotIndex, startIndex)
      )
    )
    .orderBy(asc(inventorySlots.slotIndex))
    .limit(1);

  return slot ?? null;
}

/**
 * Delete an inventory by its ID.
 * Slots are cascade-deleted by the database foreign key constraint.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param inventoryId - Inventory UUID
 */
export async function deleteInventory(
  db: DrizzleClient,
  inventoryId: string
): Promise<void> {
  await db.delete(inventories).where(eq(inventories.id, inventoryId));
}
