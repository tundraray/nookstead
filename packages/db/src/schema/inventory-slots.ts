import {
  integer,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { inventories, ownerTypeEnum } from './inventories';

/**
 * Individual slot within an inventory.
 * Empty slots have itemType = null and quantity = 0.
 * Ownership fields track who the item belongs to (may differ from inventory holder).
 */
export const inventorySlots = pgTable(
  'inventory_slots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inventoryId: uuid('inventory_id')
      .notNull()
      .references(() => inventories.id, { onDelete: 'cascade' }),
    slotIndex: smallint('slot_index').notNull(),
    itemType: varchar('item_type', { length: 64 }),
    quantity: integer('quantity').notNull().default(0),
    ownedByType: ownerTypeEnum('owned_by_type'),
    ownedById: uuid('owned_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slotUnique: uniqueIndex('inventory_slots_slot_unique').on(
      table.inventoryId,
      table.slotIndex
    ),
  })
);

/** TypeScript type inferred from the inventorySlots table schema (for select results). */
export type InventorySlot = typeof inventorySlots.$inferSelect;

/** TypeScript type inferred from the inventorySlots table schema (for insert operations). */
export type NewInventorySlot = typeof inventorySlots.$inferInsert;
