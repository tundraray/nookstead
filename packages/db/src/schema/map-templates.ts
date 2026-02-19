import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const mapTemplates = pgTable('map_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  mapType: varchar('map_type', { length: 50 }).notNull(),
  baseWidth: integer('base_width').notNull(),
  baseHeight: integer('base_height').notNull(),
  parameters: jsonb('parameters'),
  constraints: jsonb('constraints'),
  grid: jsonb('grid').notNull(),
  layers: jsonb('layers').notNull(),
  zones: jsonb('zones'),
  version: integer('version').notNull().default(1),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MapTemplateRecord = typeof mapTemplates.$inferSelect;
export type NewMapTemplateRecord = typeof mapTemplates.$inferInsert;
