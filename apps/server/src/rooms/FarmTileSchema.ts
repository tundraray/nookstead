import { Schema, type } from '@colyseus/schema';

/**
 * Colyseus schema for active crop state on a tilled tile.
 * Server-authoritative — synced to clients via Colyseus patches.
 *
 * Stub: no farm logic implemented yet. Deferred to farming feature.
 */
export class CropSchema extends Schema {
  @type('string') cropId!: string;
  @type('number') growthPoints!: number;
  @type('string') stage!: string; // CropStage serialized as string
  @type('boolean') wateredToday!: boolean;
  @type('number') totalWateredDays!: number;
}

/**
 * Colyseus schema for debris on a natural (untilled) tile.
 */
export class DebrisSchema extends Schema {
  @type('string') debrisType!: string; // DebrisType serialized as string
  @type('number') spawnedAt!: number;
}

/**
 * Colyseus schema for per-tile farm state.
 * ADR-0017 Decision 5: Server-authoritative FarmTileState via Colyseus.
 *
 * Stub: schema definition only, no farm logic or state transitions.
 * Will be integrated into ChunkRoomState when farming feature is implemented.
 */
export class FarmTileSchema extends Schema {
  @type('string') soilState!: string; // 'natural' | 'tilled'
  @type('boolean') watered!: boolean;
  @type('string') fertilizer?: string; // FertilizerType | undefined
  @type(CropSchema) crop?: CropSchema;
  @type(DebrisSchema) debris?: DebrisSchema;
}
