import {
  index,
  pgTable,
  timestamp,
  uuid,
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
