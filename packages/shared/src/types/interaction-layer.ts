/**
 * Interactive Map System — Trigger types and serialization.
 *
 * ADR-0017 Decision 1: InteractionLayer with sparse CellTrigger[] per tile.
 * Design Doc: design-024-interactive-map-system.md, Contract Definitions.
 *
 * These types are used identically in:
 * - Map editor (genmap) for authoring triggers
 * - Game server for processing interactions
 * - Game client for rendering indicators and proximity detection
 */

// ============================================================
// Shared enums / helper types
// ============================================================

/** Direction a player can face after warp. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** How a trigger is activated by the player. */
export type TriggerActivation = 'touch' | 'click' | 'proximity';

/** Warp transition visual style. */
export type WarpTransition = 'fade' | 'door' | 'walk' | 'transport';

/** Condition that must be met for a warp to activate. */
export interface WarpCondition {
  type: 'has_item' | 'quest_complete' | 'time_range' | 'custom';
  value: string;
}

// ============================================================
// Trigger subtypes (discriminated on `type` field)
// ============================================================

/** Teleports the player to another map location. */
export interface WarpTrigger {
  type: 'warp';
  activation: TriggerActivation;
  targetMap: string;
  targetX: number;
  targetY: number;
  targetDirection?: Direction;
  /** Activation radius in tiles (for proximity mode). Default 0 = same tile. */
  radius?: number;
  transition?: WarpTransition;
  conditions?: WarpCondition[];
  /** Prompt shown to player, e.g. "Press E to travel to town". */
  promptText?: string;
}

/** Interaction types for click-activated triggers. */
export type InteractionType =
  | 'shop'
  | 'crafting_station'
  | 'mailbox'
  | 'shipping_bin'
  | 'notice_board'
  | 'fishing_spot'
  | 'bed'
  | 'door'
  | 'npc_schedule_point'
  | 'custom';

/** Opens an interaction UI or triggers a game mechanic. */
export interface InteractTrigger {
  type: 'interact';
  activation: 'click';
  interactionType: InteractionType;
  /** Type-specific configuration data. */
  data?: Record<string, unknown>;
}

/** Fires a named game event. */
export interface EventTrigger {
  type: 'event';
  activation: TriggerActivation;
  eventName: string;
  data?: Record<string, unknown>;
  /** If true, trigger fires only once per player. */
  oneShot?: boolean;
}

/** Plays a sound effect when player enters area. */
export interface SoundTrigger {
  type: 'sound';
  activation: TriggerActivation;
  soundKey: string;
  /** Volume 0.0–1.0. Default 1.0. */
  volume?: number;
  loop?: boolean;
}

/** Applies damage to the player while on this tile. */
export interface DamageTrigger {
  type: 'damage';
  activation: 'touch';
  amount: number;
  /** Milliseconds between damage ticks. */
  interval: number;
  damageType?: 'fire' | 'poison' | 'cold' | 'generic';
}

// ============================================================
// Discriminated union
// ============================================================

/** All possible tile trigger types. Discriminated on the `type` field. */
export type CellTrigger =
  | WarpTrigger
  | InteractTrigger
  | EventTrigger
  | SoundTrigger
  | DamageTrigger;

// ============================================================
// Serialization types (matches SerializedFenceLayer pattern)
// ============================================================

/** A single trigger entry with its position for sparse serialization. */
export interface SerializedTriggerEntry {
  x: number;
  y: number;
  triggers: CellTrigger[];
}

/**
 * Serialized interaction layer for MapDataPayload and JSONB persistence.
 * Follows the same pattern as SerializedFenceLayer in fence-layer.ts.
 */
export interface SerializedInteractionLayer {
  /** Discriminant for deserialization from mixed layers JSONB array. */
  type: 'interaction';
  /** Display name (e.g., "Interactions"). */
  name: string;
  /** Sparse list of positioned trigger entries. */
  triggers: SerializedTriggerEntry[];
}
