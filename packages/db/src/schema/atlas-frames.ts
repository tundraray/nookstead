import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sprites } from './sprites';

export const atlasFrames = pgTable(
  'atlas_frames',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spriteId: uuid('sprite_id')
      .notNull()
      .references(() => sprites.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 255 }).notNull(),
    frameX: integer('frame_x').notNull(),
    frameY: integer('frame_y').notNull(),
    frameW: integer('frame_w').notNull(),
    frameH: integer('frame_h').notNull(),
    rotated: boolean('rotated').notNull().default(false),
    trimmed: boolean('trimmed').notNull().default(false),
    spriteSourceSizeX: integer('sprite_source_size_x').notNull().default(0),
    spriteSourceSizeY: integer('sprite_source_size_y').notNull().default(0),
    spriteSourceSizeW: integer('sprite_source_size_w'),
    spriteSourceSizeH: integer('sprite_source_size_h'),
    sourceSizeW: integer('source_size_w'),
    sourceSizeH: integer('source_size_h'),
    pivotX: real('pivot_x').notNull().default(0.5),
    pivotY: real('pivot_y').notNull().default(0.5),
    customData: jsonb('custom_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('atlas_frames_sprite_filename_unique').on(
      table.spriteId,
      table.filename
    ),
  ]
);

export const atlasFramesRelations = relations(atlasFrames, ({ one }) => ({
  sprite: one(sprites, {
    fields: [atlasFrames.spriteId],
    references: [sprites.id],
  }),
}));

export type AtlasFrame = typeof atlasFrames.$inferSelect;
export type NewAtlasFrame = typeof atlasFrames.$inferInsert;
