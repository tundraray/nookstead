import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const ownerTypeEnum = pgEnum('owner_type', ['player', 'npc']);

/**
 * Inventory container. Each player or NPC has exactly one inventory.
 * The (owner_type, owner_id) pair uniquely identifies the owning entity.
 */
export const inventories = pgTable(
  'inventories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerType: ownerTypeEnum('owner_type').notNull(),
    ownerId: uuid('owner_id').notNull(),
    maxSlots: integer('max_slots').notNull().default(20),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    ownerUnique: uniqueIndex('inventories_owner_unique').on(
      table.ownerType,
      table.ownerId
    ),
  })
);

/** TypeScript type inferred from the inventories table schema (for select results). */
export type Inventory = typeof inventories.$inferSelect;

/** TypeScript type inferred from the inventories table schema (for insert operations). */
export type NewInventory = typeof inventories.$inferInsert;
