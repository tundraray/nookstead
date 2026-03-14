import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { dialogueSessions } from './dialogue-sessions';

export const dialogueMessages = pgTable(
  'dialogue_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => dialogueSessions.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_dm_session_id').on(table.sessionId),
    index('idx_dm_created_at').on(table.createdAt),
  ]
);

export type DialogueMessage = typeof dialogueMessages.$inferSelect;
export type NewDialogueMessage = typeof dialogueMessages.$inferInsert;
