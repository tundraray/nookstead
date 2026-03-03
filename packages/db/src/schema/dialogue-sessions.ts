import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { npcBots } from './npc-bots';
import { users } from './users';

export const dialogueSessions = pgTable(
  'dialogue_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => npcBots.id, { onDelete: 'cascade' }),
    playerId: varchar('player_id', { length: 255 }).notNull(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_ds_bot_user').on(table.botId, table.userId),
    index('idx_ds_ended_at').on(table.endedAt),
  ]
);

export type DialogueSession = typeof dialogueSessions.$inferSelect;
export type NewDialogueSession = typeof dialogueSessions.$inferInsert;
