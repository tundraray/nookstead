import {
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { maps } from './maps';

/**
 * Persistent storage for NPC bot companions on player homesteads.
 *
 * Each bot is tied to a map (mapId) and tracks its last known position
 * so it can be restored when the player re-enters the homestead.
 *
 * worldX and worldY use real (floating-point) to support sub-tile
 * movement precision.
 */
export const npcBots = pgTable('npc_bots', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapId: uuid('map_id')
    .notNull()
    .references(() => maps.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
  skin: varchar('skin', { length: 32 }).notNull(),
  worldX: real('world_x').notNull().default(0),
  worldY: real('world_y').notNull().default(0),
  direction: varchar('direction', { length: 8 }).notNull().default('down'),
  personality: text('personality'),
  role: varchar('role', { length: 64 }),
  speechStyle: text('speech_style'),
  bio: text('bio'),
  age: smallint('age'),
  traits: jsonb('traits').$type<string[]>(),
  goals: jsonb('goals').$type<string[]>(),
  fears: jsonb('fears').$type<string[]>(),
  interests: jsonb('interests').$type<string[]>(),
  mood: varchar('mood', { length: 32 }),
  moodIntensity: smallint('mood_intensity').default(0),
  moodUpdatedAt: timestamp('mood_updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type inferred from the npcBots table schema (for select results). */
export type NpcBot = typeof npcBots.$inferSelect;

/** TypeScript type inferred from the npcBots table schema (for insert operations). */
export type NewNpcBot = typeof npcBots.$inferInsert;
