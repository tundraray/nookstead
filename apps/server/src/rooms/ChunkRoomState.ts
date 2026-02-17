import { Schema, MapSchema, type } from '@colyseus/schema';

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
}

/**
 * ChunkRoom state schema.
 * Each ChunkRoom instance represents one world chunk.
 */
export class ChunkRoomState extends Schema {
  @type({ map: ChunkPlayer }) players = new MapSchema<ChunkPlayer>();
}
