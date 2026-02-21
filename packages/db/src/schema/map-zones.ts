import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { editorMaps } from './editor-maps';

export const mapZones = pgTable('map_zones', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapId: uuid('map_id')
    .notNull()
    .references(() => editorMaps.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  zoneType: varchar('zone_type', { length: 50 }).notNull(),
  shape: varchar('shape', { length: 20 }).notNull(),
  bounds: jsonb('bounds'),
  vertices: jsonb('vertices'),
  properties: jsonb('properties'),
  zIndex: integer('z_index').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MapZone = typeof mapZones.$inferSelect;
export type NewMapZone = typeof mapZones.$inferInsert;
