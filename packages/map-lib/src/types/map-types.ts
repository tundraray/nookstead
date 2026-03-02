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
  | 'lighting';

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
];

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
