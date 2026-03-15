import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { npcBots } from './npc-bots';
import { users } from './users';

export const npcPlayerStatuses = pgTable(
  'npc_player_statuses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => npcBots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).notNull(),
    reason: text('reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('npc_player_statuses_bot_user_status_idx').on(
      table.botId,
      table.userId,
      table.status
    ),
  ]
);

export type NpcPlayerStatus = typeof npcPlayerStatuses.$inferSelect;
export type NewNpcPlayerStatus = typeof npcPlayerStatuses.$inferInsert;
