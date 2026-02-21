import {
  boolean,
  integer,
  pgTable,
  real,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const materials = pgTable('materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  color: varchar('color', { length: 7 }).notNull(),
  walkable: boolean('walkable').notNull().default(true),
  speedModifier: real('speed_modifier').notNull().default(1.0),
  renderPriority: integer('render_priority').notNull().default(0),
  swimRequired: boolean('swim_required').notNull().default(false),
  damaging: boolean('damaging').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
