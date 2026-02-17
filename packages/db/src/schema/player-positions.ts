import { pgTable, real, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Player position persistence table.
 * Stores last known world position for reconnect.
 * One position record per user (userId is primary key).
 */
export const playerPositions = pgTable('player_positions', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .primaryKey(),
  worldX: real('world_x').notNull().default(32),
  worldY: real('world_y').notNull().default(32),
  chunkId: varchar('chunk_id', { length: 100 }).notNull().default('city:capital'),
  direction: varchar('direction', { length: 10 }).notNull().default('down'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type PlayerPosition = typeof playerPositions.$inferSelect;
export type NewPlayerPosition = typeof playerPositions.$inferInsert;
