import {
  rasterizePolygon,
  getZoneTiles,
  detectZoneOverlap,
  validateAllZones,
} from './zone-validation';
import type { ZoneData, ZoneType } from '../types/map-types';

/**
 * Build a rectangular ZoneData for testing.
 * Uses the actual ZoneBounds format: { x, y, width, height }.
 */
function makeRectZone(
  id: string,
  zoneType: ZoneType,
  x: number,
  y: number,
  width: number,
  height: number,
): ZoneData {
  return {
    id,
    name: id,
    zoneType,
    shape: 'rectangle',
    bounds: { x, y, width, height },
    vertices: [],
    properties: {},
    zIndex: 0,
  };
}

describe('rasterizePolygon', () => {
  it('should return tiles inside a triangle [(0,0), (4,0), (2,4)]', () => {
    // AC5: rasterizePolygon with known triangle
    const vertices = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 4 },
    ];
    const tiles = rasterizePolygon(vertices);

    // The triangle covers some cells -- verify at minimum the centroid area is included
    expect(tiles.length).toBeGreaterThan(0);

    // Centroid approximately at (2, 1.3) -- tile (2,1) center is (2.5, 1.5) which should be inside
    expect(tiles.some((t) => t.x === 2 && t.y === 1)).toBe(true);

    // Tile (0,0) center is (0.5, 0.5) which should be inside the triangle
    expect(tiles.some((t) => t.x === 0 && t.y === 0)).toBe(true);
  });

  it('should return empty array for degenerate polygon (fewer than 3 vertices)', () => {
    const tiles = rasterizePolygon([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(tiles).toHaveLength(0);
  });

  it('should rasterize a square polygon correctly', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ];
    const tiles = rasterizePolygon(vertices);

    // 3x3 square polygon, tile centers at (0.5,0.5) through (2.5,2.5) should be inside
    expect(tiles.length).toBe(9);
  });
});

describe('getZoneTiles', () => {
  it('should return all tiles within a rectangle zone', () => {
    // Rectangle at (0,0) with width=3, height=3 -> 9 tiles
    const zone = makeRectZone('z1', 'crop_field', 0, 0, 3, 3);
    const tiles = getZoneTiles(zone);
    expect(tiles.length).toBe(9);
  });

  it('should return tiles including corner coordinates', () => {
    const zone = makeRectZone('z1', 'crop_field', 2, 3, 2, 2);
    const tiles = getZoneTiles(zone);
    // Width 2 x Height 2 = 4 tiles
    expect(tiles.length).toBe(4);
    expect(tiles.some((t) => t.x === 2 && t.y === 3)).toBe(true);
    expect(tiles.some((t) => t.x === 3 && t.y === 4)).toBe(true);
  });

  it('should return empty for polygon zone with no vertices', () => {
    const zone: ZoneData = {
      id: 'z-empty',
      name: 'z-empty',
      zoneType: 'path',
      shape: 'polygon',
      vertices: [],
      properties: {},
      zIndex: 0,
    };
    const tiles = getZoneTiles(zone);
    expect(tiles).toHaveLength(0);
  });

  it('should rasterize polygon zone using vertices', () => {
    const zone: ZoneData = {
      id: 'z-poly',
      name: 'z-poly',
      zoneType: 'decoration',
      shape: 'polygon',
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      properties: {},
      zIndex: 0,
    };
    const tiles = getZoneTiles(zone);
    // 4x4 polygon should produce 16 tiles
    expect(tiles.length).toBe(16);
  });
});

describe('detectZoneOverlap', () => {
  it('should detect no overlap for non-overlapping zones', () => {
    const zone1 = makeRectZone('z1', 'crop_field', 0, 0, 3, 3);
    const zone2 = makeRectZone('z2', 'path', 5, 5, 3, 3);
    const result = detectZoneOverlap(zone1, zone2);
    expect(result.overlaps).toBe(false);
    expect(result.tiles).toHaveLength(0);
  });

  it('should detect overlap and mark as allowed for decoration+path', () => {
    // decoration+path is in ZONE_OVERLAP_ALLOWED
    const zone1 = makeRectZone('z1', 'decoration', 0, 0, 3, 3);
    const zone2 = makeRectZone('z2', 'path', 2, 2, 3, 3);
    const result = detectZoneOverlap(zone1, zone2);
    expect(result.overlaps).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.tiles.length).toBeGreaterThan(0);
  });

  it('should detect overlap and mark as disallowed for crop_field+crop_field', () => {
    // crop_field+crop_field is NOT in ZONE_OVERLAP_ALLOWED
    const zone1 = makeRectZone('z1', 'crop_field', 0, 0, 3, 3);
    const zone2 = makeRectZone('z2', 'crop_field', 2, 2, 3, 3);
    const result = detectZoneOverlap(zone1, zone2);
    expect(result.overlaps).toBe(true);
    expect(result.allowed).toBe(false);
    expect(result.tiles.length).toBeGreaterThan(0);
  });
});

describe('validateAllZones', () => {
  it('should return no errors when zones do not overlap', () => {
    const zone1 = makeRectZone('z1', 'crop_field', 0, 0, 3, 3);
    const zone2 = makeRectZone('z2', 'path', 5, 5, 3, 3);
    const errors = validateAllZones([zone1, zone2]);
    expect(errors).toHaveLength(0);
  });

  it('should return no errors when overlap is allowed (decoration+path)', () => {
    const zone1 = makeRectZone('z1', 'decoration', 0, 0, 3, 3);
    const zone2 = makeRectZone('z2', 'path', 2, 2, 3, 3);
    const errors = validateAllZones([zone1, zone2]);
    expect(errors).toHaveLength(0);
  });

  it('should return errors when zones with disallowed types overlap', () => {
    // AC5: validateAllZones with overlapping zones
    // crop_field+crop_field is NOT in ZONE_OVERLAP_ALLOWED
    const zone1 = makeRectZone('z1', 'crop_field', 0, 0, 4, 4);
    const zone2 = makeRectZone('z2', 'crop_field', 2, 2, 4, 4);
    const errors = validateAllZones([zone1, zone2]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].zoneA).toBe('z1');
    expect(errors[0].zoneB).toBe('z2');
    expect(errors[0].zoneAType).toBe('crop_field');
    expect(errors[0].zoneBType).toBe('crop_field');
    expect(errors[0].tiles.length).toBeGreaterThan(0);
  });

  it('should return errors for each disallowed overlapping pair', () => {
    const zone1 = makeRectZone('z1', 'crop_field', 0, 0, 5, 5);
    const zone2 = makeRectZone('z2', 'crop_field', 3, 3, 5, 5);
    const zone3 = makeRectZone('z3', 'spawn_point', 4, 4, 3, 3);
    // z1 overlaps z2 (crop_field+crop_field = disallowed)
    // z1 overlaps z3 (crop_field+spawn_point = disallowed)
    // z2 overlaps z3 (crop_field+spawn_point = disallowed)
    const errors = validateAllZones([zone1, zone2, zone3]);
    expect(errors.length).toBe(3);
  });

  it('should return empty array for empty zone list', () => {
    const errors = validateAllZones([]);
    expect(errors).toHaveLength(0);
  });
});
