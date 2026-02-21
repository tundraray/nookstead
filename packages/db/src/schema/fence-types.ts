import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const fenceTypes = pgTable('fence_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  category: varchar('category', { length: 100 }),
  frameMapping: jsonb('frame_mapping').notNull(),
  gateFrameMapping: jsonb('gate_frame_mapping'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type FenceType = typeof fenceTypes.$inferSelect;
export type NewFenceType = typeof fenceTypes.$inferInsert;
