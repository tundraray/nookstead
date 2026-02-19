import type { ZoneData, ZoneType } from '@nookstead/map-lib';
import { ZONE_OVERLAP_ALLOWED } from '@nookstead/map-lib';

export interface TileCoord {
  x: number;
  y: number;
}

export interface OverlapResult {
  overlaps: boolean;
  allowed: boolean;
  tiles: TileCoord[];
}

export interface ValidationError {
  zoneA: string;
  zoneB: string;
  zoneAType: ZoneType;
  zoneBType: ZoneType;
  tiles: TileCoord[];
}

/** Get the set of tiles covered by a zone's geometry. */
export function getZoneTiles(zone: ZoneData): TileCoord[] {
  if (zone.shape === 'rectangle' && zone.bounds) {
    const tiles: TileCoord[] = [];
    for (let y = zone.bounds.y; y < zone.bounds.y + zone.bounds.height; y++) {
      for (
        let x = zone.bounds.x;
        x < zone.bounds.x + zone.bounds.width;
        x++
      ) {
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  if (zone.shape === 'polygon' && zone.vertices && zone.vertices.length >= 3) {
    return rasterizePolygon(zone.vertices);
  }

  return [];
}

/** Rasterize a polygon to tile coordinates using scanline algorithm. */
export function rasterizePolygon(
  vertices: Array<{ x: number; y: number }>
): TileCoord[] {
  const n = vertices.length;
  if (n < 3) return [];

  // Find bounding box
  let yMin = Infinity;
  let yMax = -Infinity;
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const v of vertices) {
    if (v.y < yMin) yMin = v.y;
    if (v.y > yMax) yMax = v.y;
    if (v.x < xMin) xMin = v.x;
    if (v.x > xMax) xMax = v.x;
  }

  yMin = Math.floor(yMin);
  yMax = Math.ceil(yMax);
  xMin = Math.floor(xMin);
  xMax = Math.ceil(xMax);

  const tiles: TileCoord[] = [];

  // Point-in-polygon test for each tile center
  for (let y = yMin; y < yMax; y++) {
    for (let x = xMin; x < xMax; x++) {
      // Test if tile center (x+0.5, y+0.5) is inside the polygon
      if (pointInPolygon(x + 0.5, y + 0.5, vertices)) {
        tiles.push({ x, y });
      }
    }
  }

  return tiles;
}

/** Ray casting point-in-polygon test. */
function pointInPolygon(
  px: number,
  py: number,
  vertices: Array<{ x: number; y: number }>
): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Check if two zone types are allowed to overlap. */
function isOverlapAllowed(typeA: ZoneType, typeB: ZoneType): boolean {
  return ZONE_OVERLAP_ALLOWED.some(
    ([a, b]) => (a === typeA && b === typeB) || (a === typeB && b === typeA)
  );
}

/** Detect overlap between two zones. */
export function detectZoneOverlap(
  zoneA: ZoneData,
  zoneB: ZoneData
): OverlapResult {
  const tilesA = getZoneTiles(zoneA);
  const tilesB = getZoneTiles(zoneB);

  // Build set from tilesB for O(n) lookup
  const setB = new Set(tilesB.map((t) => `${t.x},${t.y}`));
  const overlapping: TileCoord[] = [];

  for (const t of tilesA) {
    if (setB.has(`${t.x},${t.y}`)) {
      overlapping.push(t);
    }
  }

  if (overlapping.length === 0) {
    return { overlaps: false, allowed: true, tiles: [] };
  }

  return {
    overlaps: true,
    allowed: isOverlapAllowed(zoneA.zoneType, zoneB.zoneType),
    tiles: overlapping,
  };
}

/** Validate all zone pairs and return disallowed overlaps as errors. */
export function validateAllZones(zones: ZoneData[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const result = detectZoneOverlap(zones[i], zones[j]);
      if (result.overlaps && !result.allowed) {
        errors.push({
          zoneA: zones[i].name,
          zoneB: zones[j].name,
          zoneAType: zones[i].zoneType,
          zoneBType: zones[j].zoneType,
          tiles: result.tiles,
        });
      }
    }
  }

  return errors;
}
