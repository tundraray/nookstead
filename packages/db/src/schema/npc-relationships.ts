import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { npcBots } from './npc-bots';
import { users } from './users';

export const npcRelationships = pgTable(
  'npc_relationships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => npcBots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    socialType: varchar('social_type', { length: 32 })
      .notNull()
      .default('stranger'),
    isWorker: boolean('is_worker').notNull().default(false),
    score: integer('score').notNull().default(0),
    hiredAt: timestamp('hired_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_nr_bot_user').on(table.botId, table.userId),
    index('idx_nr_bot_user').on(table.botId, table.userId),
    index('idx_nr_bot_social').on(table.botId, table.socialType),
  ]
);

export type NpcRelationshipRow = typeof npcRelationships.$inferSelect;
export type NewNpcRelationship = typeof npcRelationships.$inferInsert;
