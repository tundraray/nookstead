/**
 * Farm Tile State — server-authoritative per-tile farming state.
 *
 * ADR-0017 Decision 5: Server-authoritative FarmTileState via Colyseus.
 * Design Doc: design-024-interactive-map-system.md, Contract Definitions.
 *
 * This state is managed exclusively on the server and synced to clients
 * via Colyseus schema patches. It is NEVER sent as part of MapDataPayload.
 *
 * Growth point arithmetic:
 * - +1 growthPoint per game-hour when watered === true
 * - +0.5 bonus with speed fertilizer
 * - Growth pauses if not watered (no points accumulated)
 * - Rain bonus (+0.25/game-hour) deferred until weather system is implemented
 */

// ============================================================
// Type aliases
// ============================================================

/** Crop growth stages, ordered by progression. */
export type CropStage =
  | 'seed'
  | 'sprout'
  | 'growing'
  | 'mature'
  | 'harvestable'
  | 'dead';

/** Fertilizer types affecting growth. */
export type FertilizerType = 'basic' | 'quality' | 'speed';

/** Debris types that can spawn on natural tiles. */
export type DebrisType = 'weed' | 'stick' | 'stone';

// ============================================================
// State interfaces
// ============================================================

/** Active crop state on a tilled tile. */
export interface CropState {
  /** References crop definition (e.g., 'tomato', 'corn'). */
  cropId: string;
  /** Accumulated growth points. Stage thresholds defined per crop. */
  growthPoints: number;
  /** Current growth stage, computed from growthPoints thresholds. */
  stage: CropStage;
  /** Reset to false at start of each game day. */
  wateredToday: boolean;
  /** Total count of days watered (for quality calculation at harvest). */
  totalWateredDays: number;
}

/** Debris state on a natural (untilled) tile. */
export interface DebrisState {
  type: DebrisType;
  /** Game timestamp when debris spawned. */
  spawnedAt: number;
}

/**
 * Per-tile farm state. Server-authoritative.
 *
 * State transitions:
 * - natural + hoe → tilled
 * - tilled + seed → tilled + crop(seed)
 * - tilled + watering_can → watered=true
 * - crop(harvestable) + harvest → tilled (crop removed, watered=false)
 * - crop(any) + neglect → crop(dead)
 * - tilled(empty) + daily_decay → natural (DirtDecayChance)
 * - natural + debris_spawn → natural + debris
 *
 * Rejected transitions (server validation):
 * - tilled + crop + plant → REJECT (crop already exists)
 * - natural + debris + hoe → REJECT (must clear debris first)
 * - tilled + crop + pickaxe → REJECT (must harvest/scythe crop first)
 *
 * Invariants:
 * - crop can only exist when soilState === 'tilled'
 * - debris can only exist when soilState === 'natural'
 * - watered resets to false at start of each game day
 * - growthPoints only increase when watered === true
 */
export interface FarmTileState {
  soilState: 'natural' | 'tilled';
  watered: boolean;
  fertilizer?: FertilizerType;
  crop?: CropState;
  debris?: DebrisState;
}
