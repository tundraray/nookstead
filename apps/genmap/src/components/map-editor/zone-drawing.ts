import type { ZoneBounds, ZoneVertex } from '@nookstead/map-lib';

export interface TilePos {
  x: number;
  y: number;
}

/** Compute ZoneBounds from two tile positions (handles reversed drags). */
export function computeRectBounds(start: TilePos, end: TilePos): ZoneBounds {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x) + 1;
  const height = Math.abs(end.y - start.y) + 1;
  return { x, y, width, height };
}

/** Clamp ZoneBounds to map dimensions. */
export function clampBounds(
  bounds: ZoneBounds,
  mapWidth: number,
  mapHeight: number
): ZoneBounds {
  const x = Math.max(0, Math.min(bounds.x, mapWidth - 1));
  const y = Math.max(0, Math.min(bounds.y, mapHeight - 1));
  const width = Math.min(bounds.width, mapWidth - x);
  const height = Math.min(bounds.height, mapHeight - y);
  return { x, y, width, height };
}

/** Check if line segments (a-b) and (c-d) properly intersect. */
function segmentsIntersect(
  a: TilePos,
  b: TilePos,
  c: TilePos,
  d: TilePos
): boolean {
  const cross = (o: TilePos, u: TilePos, v: TilePos) =>
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

/** Check if a polygon defined by tile corner vertices is simple (no self-intersection). */
export function isSimplePolygon(vertices: TilePos[]): boolean {
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

/** Compute polygon area using shoelace formula (returns absolute area in tile units squared). */
export function polygonArea(vertices: TilePos[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/** Convert TilePos array to ZoneVertex array. */
export function toZoneVertices(vertices: TilePos[]): ZoneVertex[] {
  return vertices.map((v) => ({ x: v.x, y: v.y }));
}
