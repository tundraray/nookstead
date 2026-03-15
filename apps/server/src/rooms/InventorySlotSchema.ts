import { Schema, type } from '@colyseus/schema';

/**
 * Colyseus-serializable representation of a single hotbar slot.
 * Used in ChunkPlayer.hotbar ArraySchema for real-time hotbar sync.
 *
 * Field design:
 * - itemType: '' means empty slot (Colyseus Schema does not support null strings)
 * - spriteX/Y/W/H: sprite sheet coordinates split from the spriteRect tuple
 *   (Schema cannot serialize tuples; reassembled by the client)
 * - 6 fields total — nested schemas count separately from parent's 64-field budget
 */
export class InventorySlotSchema extends Schema {
  @type('string') itemType = '';
  @type('int16') quantity = 0;
  @type('int16') spriteX = 0;
  @type('int16') spriteY = 0;
  @type('int8') spriteW = 16;
  @type('int8') spriteH = 16;
}
