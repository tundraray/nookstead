import { ArraySchema, Schema, MapSchema, type } from '@colyseus/schema';
import { HOTBAR_SLOT_COUNT } from '@nookstead/shared';
import { InventorySlotSchema } from './InventorySlotSchema.js';

/**
 * Per-player state synchronized to clients.
 * Contains only data that clients need to see (no userId, no sessionId).
 */
export class ChunkPlayer extends Schema {
  @type('string') id!: string;
  @type('number') worldX!: number;
  @type('number') worldY!: number;
  @type('string') direction!: string;
  @type('string') skin!: string;
  @type('string') name!: string;
  @type('string') animState!: string;
  @type([InventorySlotSchema]) hotbar = new ArraySchema<InventorySlotSchema>(
    ...Array.from({ length: HOTBAR_SLOT_COUNT }, () => new InventorySlotSchema())
  );
}

/**
 * Per-bot state synchronized to clients.
 * Extends ChunkPlayer fields with mapId and animation state.
 */
export class ChunkBot extends Schema {
  @type('string') id!: string;
  @type('string') mapId!: string;
  @type('number') worldX!: number;
  @type('number') worldY!: number;
  @type('string') direction!: string;
  @type('string') skin!: string;
  @type('string') name!: string;
  @type('string') state!: string; // 'idle' | 'walking' — BotAnimState serialized as string
}

/**
 * ChunkRoom state schema.
 * Each ChunkRoom instance represents one world chunk.
 */
export class ChunkRoomState extends Schema {
  @type({ map: ChunkPlayer }) players = new MapSchema<ChunkPlayer>();
  @type({ map: ChunkBot }) bots = new MapSchema<ChunkBot>();
}
