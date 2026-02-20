import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { materials } from './materials';
import { tilesetTags } from './tileset-tags';

export const tilesets = pgTable('tilesets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  s3Key: text('s3_key').notNull().unique(),
  s3Url: text('s3_url').notNull(),
  width: integer('width').notNull().default(192),
  height: integer('height').notNull().default(64),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 50 }).notNull(),
  fromMaterialId: uuid('from_material_id').references(() => materials.id, {
    onDelete: 'set null',
  }),
  toMaterialId: uuid('to_material_id').references(() => materials.id, {
    onDelete: 'set null',
  }),
  inverseTilesetId: uuid('inverse_tileset_id').references(
    (): any => tilesets.id,
    { onDelete: 'set null' }
  ),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tilesetsRelations = relations(tilesets, ({ one, many }) => ({
  fromMaterial: one(materials, {
    fields: [tilesets.fromMaterialId],
    references: [materials.id],
    relationName: 'fromMaterial',
  }),
  toMaterial: one(materials, {
    fields: [tilesets.toMaterialId],
    references: [materials.id],
    relationName: 'toMaterial',
  }),
  inverseTileset: one(tilesets, {
    fields: [tilesets.inverseTilesetId],
    references: [tilesets.id],
    relationName: 'inverseTileset',
  }),
  tags: many(tilesetTags),
}));

export type Tileset = typeof tilesets.$inferSelect;
export type NewTileset = typeof tilesets.$inferInsert;
