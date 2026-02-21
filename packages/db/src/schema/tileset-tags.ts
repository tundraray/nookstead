import { pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tilesets } from './tilesets';

export const tilesetTags = pgTable(
  'tileset_tags',
  {
    tilesetId: uuid('tileset_id')
      .notNull()
      .references(() => tilesets.id, { onDelete: 'cascade' }),
    tag: varchar('tag', { length: 50 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tilesetId, table.tag] }),
  ]
);

export const tilesetTagsRelations = relations(tilesetTags, ({ one }) => ({
  tileset: one(tilesets, {
    fields: [tilesetTags.tilesetId],
    references: [tilesets.id],
  }),
}));

export type TilesetTag = typeof tilesetTags.$inferSelect;
export type NewTilesetTag = typeof tilesetTags.$inferInsert;
