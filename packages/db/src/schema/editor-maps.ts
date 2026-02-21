import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const editorMaps = pgTable('editor_maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  mapType: varchar('map_type', { length: 50 }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  seed: integer('seed'),
  grid: jsonb('grid').notNull(),
  layers: jsonb('layers').notNull(),
  walkable: jsonb('walkable').notNull(),
  metadata: jsonb('metadata'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type EditorMap = typeof editorMaps.$inferSelect;
export type NewEditorMap = typeof editorMaps.$inferInsert;
