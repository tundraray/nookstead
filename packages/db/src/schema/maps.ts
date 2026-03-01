import { integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Map persistence table.
 * Stores procedurally generated map data per user.
 * One map record per user (userId is primary key).
 */
export const maps = pgTable('maps', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .primaryKey(),
  seed: integer('seed').notNull(),
  width: integer('width').notNull().default(64),
  height: integer('height').notNull().default(64),
  grid: jsonb('grid').notNull(),
  layers: jsonb('layers').notNull(),
  walkable: jsonb('walkable').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MapRecord = typeof maps.$inferSelect;
export type NewMapRecord = typeof maps.$inferInsert;
