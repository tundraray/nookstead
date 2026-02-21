import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export interface GameObjectLayer {
  frameId: string;
  spriteId: string;
  xOffset: number;
  yOffset: number;
  layerOrder: number;
}

export interface CollisionZone {
  id: string;
  label: string;
  type: 'collision' | 'walkable';
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export const gameObjects = pgTable('game_objects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  objectType: varchar('object_type', { length: 100 }),
  layers: jsonb('layers').notNull(), // GameObjectLayer[]
  collisionZones: jsonb('collision_zones').default([]), // CollisionZone[]
  tags: jsonb('tags'), // string[]
  metadata: jsonb('metadata'), // Record<string, unknown>
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type GameObject = typeof gameObjects.$inferSelect;
export type NewGameObject = typeof gameObjects.$inferInsert;
