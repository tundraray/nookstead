import type { ZoneBounds, ZoneVertex } from '../types/map-types';

/**
 * A tile coordinate (integer grid position).
 * Canonical home for the TileCoord type shared by zone-geometry and zone-validation.
 */
export interface TileCoord {
  x: number;
  y: number;
}

/**
 * Compute ZoneBounds from two tile positions (handles reversed drags).
 * Ensures minX <= maxX and minY <= maxY regardless of drag direction.
 */
export function computeRectBounds(
  start: TileCoord,
  end: TileCoord,
): ZoneBounds {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x) + 1;
  const height = Math.abs(end.y - start.y) + 1;
  return { x, y, width, height };
}

/**
 * Clamp ZoneBounds to map dimensions.
 * Ensures bounds stay within [0, mapWidth-1] x [0, mapHeight-1].
 */
export function clampBounds(
  bounds: ZoneBounds,
  mapWidth: number,
  mapHeight: number,
): ZoneBounds {
  const x = Math.max(0, Math.min(bounds.x, mapWidth - 1));
  const y = Math.max(0, Math.min(bounds.y, mapHeight - 1));
  const width = Math.min(bounds.width, mapWidth - x);
  const height = Math.min(bounds.height, mapHeight - y);
  return { x, y, width, height };
}

/**
 * Check if line segments (a-b) and (c-d) properly intersect.
 * Uses cross product orientation test.
 */
function segmentsIntersect(
  a: TileCoord,
  b: TileCoord,
  c: TileCoord,
  d: TileCoord,
): boolean {
  const cross = (o: TileCoord, u: TileCoord, v: TileCoord) =>
    (u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
    return true;
  return false;
}

/**
 * Check if a polygon defined by vertices is simple (no self-intersection).
 * Uses line segment intersection test for each pair of non-adjacent edges.
 */
export function isSimplePolygon(vertices: TileCoord[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = vertices[j];
      const d = vertices[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

/**
 * Compute polygon area using the shoelace formula.
 * Returns the absolute area (positive regardless of vertex winding order).
 */
export function polygonArea(vertices: TileCoord[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Convert TileCoord array to ZoneVertex array.
 * ZoneVertex has the same shape as TileCoord (x, y).
 */
export function toZoneVertices(vertices: TileCoord[]): ZoneVertex[] {
  return vertices.map((v) => ({ x: v.x, y: v.y }));
}
