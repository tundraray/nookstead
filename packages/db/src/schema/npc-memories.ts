import {
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { dialogueSessions } from './dialogue-sessions';
import { npcBots } from './npc-bots';
import { users } from './users';

export const npcMemories = pgTable(
  'npc_memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => npcBots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 32 }).notNull().default('interaction'),
    content: text('content').notNull(),
    importance: smallint('importance').notNull(),
    dialogueSessionId: uuid('dialogue_session_id').references(
      () => dialogueSessions.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_nm_bot_user').on(table.botId, table.userId),
    index('idx_nm_bot_created').on(table.botId, table.createdAt),
    index('idx_nm_bot_importance').on(table.botId, table.importance),
  ]
);

export type NpcMemoryRow = typeof npcMemories.$inferSelect;
export type NewNpcMemory = typeof npcMemories.$inferInsert;
