/** Map type classification. */
export type MapType = 'homestead' | 'city' | 'open_world' | 'template';

/** Dimension constraints per map type. */
export interface MapDimensionConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export const MAP_TYPE_CONSTRAINTS: Record<MapType, MapDimensionConstraints> = {
  homestead: { minWidth: 32, maxWidth: 64, minHeight: 32, maxHeight: 64 },
  city: { minWidth: 64, maxWidth: 128, minHeight: 64, maxHeight: 128 },
  open_world: { minWidth: 64, maxWidth: 256, minHeight: 64, maxHeight: 256 },
  template: { minWidth: 16, maxWidth: 256, minHeight: 16, maxHeight: 256 },
};

/** Zone type classification for map regions. */
export type ZoneType =
  | 'crop_field'
  | 'path'
  | 'water_feature'
  | 'decoration'
  | 'spawn_point'
  | 'transition'
  | 'npc_location'
  | 'animal_pen'
  | 'building_footprint'
  | 'transport_point'
  | 'lighting'
  | 'warp_zone'
  | 'no_dig'
  | 'no_build'
  | 'no_fish'
  | 'no_spawn'
  | 'farmland';

/** Shape of a zone. */
export type ZoneShape = 'rectangle' | 'polygon';

/** Axis-aligned bounding box for rectangular zones. */
export interface ZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A vertex in a polygon zone. */
export interface ZoneVertex {
  x: number;
  y: number;
}

/** Complete zone definition. */
export interface ZoneData {
  id: string;
  name: string;
  zoneType: ZoneType;
  shape: ZoneShape;
  bounds?: ZoneBounds;
  vertices?: ZoneVertex[];
  properties: Record<string, unknown>;
  zIndex: number;
}

/** Color per zone type for overlay rendering (hex string). */
export const ZONE_COLORS: Record<ZoneType, string> = {
  crop_field: '#4CAF50',
  path: '#9E9E9E',
  water_feature: '#2196F3',
  decoration: '#FF9800',
  spawn_point: '#E91E63',
  transition: '#9C27B0',
  npc_location: '#00BCD4',
  animal_pen: '#795548',
  building_footprint: '#607D8B',
  transport_point: '#FFC107',
  lighting: '#FFEB3B',
  warp_zone: '#AB47BC',
  no_dig: '#D32F2F',
  no_build: '#C62828',
  no_fish: '#E53935',
  no_spawn: '#B71C1C',
  farmland: '#66BB6A',
};

/** Pairs of zone types that can overlap. */
export const ZONE_OVERLAP_ALLOWED: [ZoneType, ZoneType][] = [
  ['decoration', 'path'],
  ['lighting', 'crop_field'],
  ['lighting', 'path'],
  ['lighting', 'decoration'],
  ['lighting', 'spawn_point'],
  ['lighting', 'npc_location'],
  ['lighting', 'building_footprint'],
  // Farmland overlaps
  ['farmland', 'crop_field'],
  ['farmland', 'lighting'],
  ['farmland', 'decoration'],
  // Restriction zones overlay gameplay zones
  ['no_dig', 'farmland'],
  ['no_dig', 'crop_field'],
  ['no_dig', 'building_footprint'],
  ['no_build', 'farmland'],
  ['no_build', 'crop_field'],
  ['no_fish', 'water_feature'],
  ['no_spawn', 'farmland'],
  ['no_spawn', 'crop_field'],
  ['no_spawn', 'spawn_point'],
  // Warp zones
  ['warp_zone', 'transition'],
  ['warp_zone', 'lighting'],
  // Restriction zones can stack
  ['no_dig', 'no_build'],
  ['no_dig', 'no_spawn'],
  ['no_build', 'no_spawn'],
];

// ============================================================
// Zone property schemas (ADR-0017 Decision 3)
// ============================================================

import type {
  Direction,
  WarpTransition,
  WarpCondition,
  DebrisType,
} from '@nookstead/shared';

/** Warp zone configuration stored in ZoneData.properties. */
export interface WarpZoneProperties {
  targetMap: string;
  targetX: number;
  targetY: number;
  targetDirection?: Direction;
  transition?: WarpTransition;
  conditions?: WarpCondition[];
  promptText?: string;
}

/** Spawn rules for farmland/crop zones stored in ZoneData.properties. */
export interface SpawnRuleConfig {
  allowedTypes: DebrisType[];
  /** Daily spawn probability per empty tile (0-1). */
  probability: number;
  /** Max percentage of tiles with spawns (0-1). */
  maxDensity: number;
  /** Only spawn after N days without player activity. */
  neglectDays?: number;
}

/** NPC schedule binding stored in ZoneData.properties. */
export interface NpcScheduleConfig {
  /** Named location (e.g., "bakery", "park_bench"). */
  locationName: string;
  /** Which NPCs use this location. */
  npcIds?: string[];
  /** Max NPCs at this location simultaneously. */
  capacity?: number;
}

/** Operating hours for shop/market zones stored in ZoneData.properties. */
export interface OperatingHoursConfig {
  /** Opening hour (24h format, e.g., 8). */
  openHour: number;
  /** Closing hour (24h format, e.g., 18). */
  closeHour: number;
  /** Message shown when closed. */
  closedMessage?: string;
}

/** Type guard: checks if a zone is a warp zone with warp properties. */
export function isWarpZone(
  zone: ZoneData,
): zone is ZoneData & { properties: WarpZoneProperties } {
  return zone.zoneType === 'warp_zone';
}

/** Result of map dimension validation. */
export interface DimensionValidationResult {
  valid: boolean;
  reason?: string;
}

/** Validate map dimensions against constraints for a given map type. */
export function validateMapDimensions(
  mapType: MapType,
  width: number,
  height: number,
): DimensionValidationResult {
  const c = MAP_TYPE_CONSTRAINTS[mapType];

  if (width < c.minWidth || width > c.maxWidth) {
    return { valid: false, reason: `Width ${width} out of range [${c.minWidth}, ${c.maxWidth}] for ${mapType}` };
  }
  if (height < c.minHeight || height > c.maxHeight) {
    return { valid: false, reason: `Height ${height} out of range [${c.minHeight}, ${c.maxHeight}] for ${mapType}` };
  }

  return { valid: true };
}
