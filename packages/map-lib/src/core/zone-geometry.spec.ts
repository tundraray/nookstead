import {
  computeRectBounds,
  clampBounds,
  isSimplePolygon,
  polygonArea,
  toZoneVertices,
} from './zone-geometry';
import type { TileCoord } from './zone-geometry';

describe('computeRectBounds', () => {
  it('should compute correct bounds for normal drag (top-left to bottom-right)', () => {
    const bounds = computeRectBounds({ x: 1, y: 1 }, { x: 5, y: 4 });
    expect(bounds).toEqual({ x: 1, y: 1, width: 5, height: 4 });
  });

  it('should compute correct bounds for reversed drag (bottom-right to top-left)', () => {
    // AC5: computeRectBounds with reversed drag
    const bounds = computeRectBounds({ x: 5, y: 4 }, { x: 1, y: 1 });
    expect(bounds).toEqual({ x: 1, y: 1, width: 5, height: 4 });
  });

  it('should handle same start and end point', () => {
    const bounds = computeRectBounds({ x: 2, y: 3 }, { x: 2, y: 3 });
    expect(bounds).toEqual({ x: 2, y: 3, width: 1, height: 1 });
  });

  it('should produce width and height of 1 for adjacent tiles', () => {
    const bounds = computeRectBounds({ x: 3, y: 5 }, { x: 3, y: 5 });
    expect(bounds.width).toBe(1);
    expect(bounds.height).toBe(1);
  });
});

describe('clampBounds', () => {
  it('should return bounds unchanged when within map dimensions', () => {
    const bounds = { x: 1, y: 1, width: 4, height: 4 };
    const result = clampBounds(bounds, 10, 10);
    expect(result).toEqual({ x: 1, y: 1, width: 4, height: 4 });
  });

  it('should clamp x and y to zero when negative', () => {
    const bounds = { x: -2, y: -3, width: 5, height: 6 };
    const result = clampBounds(bounds, 10, 10);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
  });

  it('should clamp width so bounds do not exceed map dimensions', () => {
    const bounds = { x: 8, y: 8, width: 5, height: 5 };
    const result = clampBounds(bounds, 10, 10);
    expect(result.x + result.width).toBeLessThanOrEqual(10);
    expect(result.y + result.height).toBeLessThanOrEqual(10);
  });

  it('should clamp x to mapWidth-1 at most', () => {
    const bounds = { x: 15, y: 15, width: 3, height: 3 };
    const result = clampBounds(bounds, 10, 10);
    expect(result.x).toBeLessThanOrEqual(9);
    expect(result.y).toBeLessThanOrEqual(9);
  });
});

describe('isSimplePolygon', () => {
  it('should return true for a simple triangle', () => {
    const triangle: TileCoord[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 4 },
    ];
    expect(isSimplePolygon(triangle)).toBe(true);
  });

  it('should return true for a convex square', () => {
    const square: TileCoord[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(isSimplePolygon(square)).toBe(true);
  });

  it('should return false for a self-intersecting polygon (bowtie)', () => {
    const bowtie: TileCoord[] = [
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 4, y: 0 },
      { x: 0, y: 4 },
    ];
    expect(isSimplePolygon(bowtie)).toBe(false);
  });

  it('should return false for fewer than 3 vertices', () => {
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
    expect(isSimplePolygon([])).toBe(false);
  });
});

describe('polygonArea', () => {
  it('should compute correct area for a 4x4 square', () => {
    const square: TileCoord[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(polygonArea(square)).toBe(16);
  });

  it('should compute positive area regardless of winding order', () => {
    const cwSquare: TileCoord[] = [
      { x: 0, y: 0 },
      { x: 0, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 0 },
    ];
    expect(polygonArea(cwSquare)).toBe(16);
  });

  it('should compute correct area for a triangle', () => {
    // Triangle with base 4 and height 3 -> area = 6
    const triangle: TileCoord[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    expect(polygonArea(triangle)).toBe(6);
  });

  it('should return 0 for a degenerate polygon (collinear points)', () => {
    const line: TileCoord[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ];
    expect(polygonArea(line)).toBe(0);
  });
});

describe('toZoneVertices', () => {
  it('should convert TileCoord array to ZoneVertex array with same x, y values', () => {
    const coords: TileCoord[] = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ];
    const vertices = toZoneVertices(coords);
    expect(vertices).toHaveLength(2);
    expect(vertices[0]).toEqual({ x: 1, y: 2 });
    expect(vertices[1]).toEqual({ x: 3, y: 4 });
  });

  it('should return empty array for empty input', () => {
    const vertices = toZoneVertices([]);
    expect(vertices).toHaveLength(0);
  });

  it('should produce new objects (not references to original)', () => {
    const coords: TileCoord[] = [{ x: 5, y: 6 }];
    const vertices = toZoneVertices(coords);
    expect(vertices[0]).not.toBe(coords[0]);
    expect(vertices[0]).toEqual({ x: 5, y: 6 });
  });
});
