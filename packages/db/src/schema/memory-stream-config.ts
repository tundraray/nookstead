import {
  pgTable,
  real,
  smallint,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { npcBots } from './npc-bots';

export const memoryStreamConfig = pgTable('memory_stream_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  topK: smallint('top_k').notNull().default(10),
  halfLifeHours: real('half_life_hours').notNull().default(48),
  recencyWeight: real('recency_weight').notNull().default(1.0),
  importanceWeight: real('importance_weight').notNull().default(1.0),
  maxMemoriesPerNpc: smallint('max_memories_per_npc').notNull().default(1000),
  tokenBudget: smallint('token_budget').notNull().default(400),
  importanceFirstMeeting: smallint('importance_first_meeting')
    .notNull()
    .default(7),
  importanceNormalDialogue: smallint('importance_normal_dialogue')
    .notNull()
    .default(4),
  importanceEmotionalDialogue: smallint('importance_emotional_dialogue')
    .notNull()
    .default(6),
  importanceGiftReceived: smallint('importance_gift_received')
    .notNull()
    .default(7),
  importanceQuestRelated: smallint('importance_quest_related')
    .notNull()
    .default(8),
  semanticWeight: real('semantic_weight').notNull().default(0.0),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MemoryStreamConfigRow = typeof memoryStreamConfig.$inferSelect;

export const npcMemoryOverrides = pgTable('npc_memory_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  botId: uuid('bot_id')
    .notNull()
    .unique()
    .references(() => npcBots.id, { onDelete: 'cascade' }),
  topK: smallint('top_k'),
  halfLifeHours: real('half_life_hours'),
  recencyWeight: real('recency_weight'),
  importanceWeight: real('importance_weight'),
  maxMemoriesPerNpc: smallint('max_memories_per_npc'),
  tokenBudget: smallint('token_budget'),
  semanticWeight: real('semantic_weight'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type NpcMemoryOverrideRow = typeof npcMemoryOverrides.$inferSelect;
