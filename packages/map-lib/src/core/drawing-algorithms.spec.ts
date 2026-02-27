import { bresenhamLine, floodFill, rectangleFill, stampCells } from './drawing-algorithms';
import type { Cell } from '@nookstead/shared';
import type { EditorLayer } from '../types/editor-types';

/**
 * Helper to create a uniform grid of cells with the given terrain.
 */
function makeGrid(width: number, height: number, terrain: string): Cell[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ terrain, elevation: 0, meta: {} }) as Cell),
  );
}

/**
 * Helper to create an EditorLayer with zeroed frames.
 */
function makeLayer(width: number, height: number, terrainKey: string): EditorLayer {
  return {
    id: 'l1',
    name: 'Layer',
    terrainKey,
    visible: true,
    opacity: 1,
    frames: Array.from({ length: height }, () => new Array(width).fill(0)),
  };
}

describe('bresenhamLine', () => {
  it('should return a contiguous path from (0,0) to (5,3)', () => {
    const points = bresenhamLine(0, 0, 5, 3);
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 5, y: 3 });
    // Verify no diagonal gaps: each consecutive point differs by at most 1 in each axis
    for (let i = 1; i < points.length; i++) {
      expect(Math.abs(points[i].x - points[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(points[i].y - points[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });

  it('should return single point for same start and end', () => {
    const points = bresenhamLine(2, 3, 2, 3);
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ x: 2, y: 3 });
  });

  it('should handle horizontal line', () => {
    const points = bresenhamLine(0, 0, 4, 0);
    expect(points).toHaveLength(5);
    points.forEach((p, i) => expect(p).toEqual({ x: i, y: 0 }));
  });

  it('should handle vertical line', () => {
    const points = bresenhamLine(0, 0, 0, 3);
    expect(points).toHaveLength(4);
    points.forEach((p, i) => expect(p).toEqual({ x: 0, y: i }));
  });

  it('should handle negative direction (right-to-left)', () => {
    const points = bresenhamLine(4, 0, 0, 0);
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual({ x: 4, y: 0 });
    expect(points[4]).toEqual({ x: 0, y: 0 });
  });

  it('should handle negative direction (bottom-to-top)', () => {
    const points = bresenhamLine(0, 3, 0, 0);
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ x: 0, y: 3 });
    expect(points[3]).toEqual({ x: 0, y: 0 });
  });
});

describe('floodFill', () => {
  it('should return empty array when start cell already has the new terrain', () => {
    const grid = makeGrid(3, 3, 'grass');
    const layer = makeLayer(3, 3, 'grass');
    const deltas = floodFill(grid, 1, 1, 'grass', 3, 3, 0, [layer]);
    expect(deltas).toHaveLength(0);
  });

  it('should fill all connected cells with the new terrain', () => {
    const grid = makeGrid(3, 3, 'grass');
    const layer = makeLayer(3, 3, 'grass');
    const deltas = floodFill(grid, 0, 0, 'sand', 3, 3, 0, [layer]);
    expect(deltas).toHaveLength(9); // all cells should be filled
    deltas.forEach((d) => {
      expect(d.newTerrain).toBe('sand');
      expect(d.oldTerrain).toBe('grass');
    });
  });

  it('should not fill across terrain boundaries', () => {
    const grid = makeGrid(3, 3, 'grass');
    // Create a wall of different terrain in the middle column
    grid[0][1] = { terrain: 'stone', elevation: 0, meta: {} } as Cell;
    grid[1][1] = { terrain: 'stone', elevation: 0, meta: {} } as Cell;
    grid[2][1] = { terrain: 'stone', elevation: 0, meta: {} } as Cell;
    const layer = makeLayer(3, 3, 'grass');
    // Fill from (0,0): should only fill the left column (3 cells)
    const deltas = floodFill(grid, 0, 0, 'sand', 3, 3, 0, [layer]);
    expect(deltas).toHaveLength(3);
    deltas.forEach((d) => {
      expect(d.x).toBe(0); // only column 0
      expect(d.newTerrain).toBe('sand');
    });
  });

  it('should return empty array for out-of-bounds start', () => {
    const grid = makeGrid(3, 3, 'grass');
    const layer = makeLayer(3, 3, 'grass');
    const deltas = floodFill(grid, -1, 0, 'sand', 3, 3, 0, [layer]);
    expect(deltas).toHaveLength(0);
  });

  it('should record correct oldFrame from the layer', () => {
    const grid = makeGrid(2, 2, 'grass');
    const layer = makeLayer(2, 2, 'grass');
    layer.frames[0][0] = 5;
    layer.frames[0][1] = 10;
    const deltas = floodFill(grid, 0, 0, 'sand', 2, 2, 0, [layer]);
    const delta00 = deltas.find((d) => d.x === 0 && d.y === 0);
    const delta10 = deltas.find((d) => d.x === 1 && d.y === 0);
    expect(delta00?.oldFrame).toBe(5);
    expect(delta10?.oldFrame).toBe(10);
  });
});

describe('rectangleFill', () => {
  it('should fill a single cell', () => {
    const grid = makeGrid(3, 3, 'grass');
    const layer = makeLayer(3, 3, 'grass');
    const deltas = rectangleFill({
      grid,
      minX: 1,
      minY: 1,
      maxX: 1,
      maxY: 1,
      newTerrain: 'sand',
      width: 3,
      height: 3,
      layerIndex: 0,
      layers: [layer],
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({ x: 1, y: 1, newTerrain: 'sand', oldTerrain: 'grass' });
  });

  it('should return empty array when terrain is unchanged', () => {
    const grid = makeGrid(3, 3, 'grass');
    const layer = makeLayer(3, 3, 'grass');
    const deltas = rectangleFill({
      grid,
      minX: 0,
      minY: 0,
      maxX: 2,
      maxY: 2,
      newTerrain: 'grass',
      width: 3,
      height: 3,
      layerIndex: 0,
      layers: [layer],
    });
    expect(deltas).toHaveLength(0);
  });

  it('should fill a full rectangle', () => {
    const grid = makeGrid(4, 4, 'grass');
    const layer = makeLayer(4, 4, 'grass');
    const deltas = rectangleFill({
      grid,
      minX: 1,
      minY: 1,
      maxX: 2,
      maxY: 2,
      newTerrain: 'sand',
      width: 4,
      height: 4,
      layerIndex: 0,
      layers: [layer],
    });
    expect(deltas).toHaveLength(4); // 2x2 area
    const coords = deltas.map((d) => `${d.x},${d.y}`).sort();
    expect(coords).toEqual(['1,1', '1,2', '2,1', '2,2']);
  });

  it('should clip to grid bounds', () => {
    const grid = makeGrid(3, 3, 'grass');
    const layer = makeLayer(3, 3, 'grass');
    // Rectangle extends beyond grid bounds
    const deltas = rectangleFill({
      grid,
      minX: -1,
      minY: -1,
      maxX: 5,
      maxY: 5,
      newTerrain: 'sand',
      width: 3,
      height: 3,
      layerIndex: 0,
      layers: [layer],
    });
    // Only cells within 3x3 grid should be returned
    expect(deltas).toHaveLength(9);
  });
});

describe('stampCells', () => {
  it('should return single cell for brushSize=1 (circle)', () => {
    const cells = stampCells(5, 5, 1, 'circle', 10, 10);
    expect(cells).toEqual([{ x: 5, y: 5 }]);
  });

  it('should return single cell for brushSize=1 (square)', () => {
    const cells = stampCells(5, 5, 1, 'square', 10, 10);
    expect(cells).toEqual([{ x: 5, y: 5 }]);
  });

  it('should return correct circle for brushSize=3', () => {
    const cells = stampCells(5, 5, 3, 'circle', 10, 10);
    // r=1, circle includes cells where dx*dx+dy*dy <= 1
    // That's (0,0), (-1,0), (1,0), (0,-1), (0,1) = 5 cells (cross pattern)
    expect(cells).toHaveLength(5);
    const keys = cells.map((c) => `${c.x},${c.y}`).sort();
    expect(keys).toEqual(['4,5', '5,4', '5,5', '5,6', '6,5']);
  });

  it('should return correct square for brushSize=3', () => {
    const cells = stampCells(5, 5, 3, 'square', 10, 10);
    // r=1, square is 3x3 = 9 cells
    expect(cells).toHaveLength(9);
    const keys = cells.map((c) => `${c.x},${c.y}`).sort();
    expect(keys).toEqual([
      '4,4', '4,5', '4,6',
      '5,4', '5,5', '5,6',
      '6,4', '6,5', '6,6',
    ]);
  });

  it('should return correct circle for brushSize=5', () => {
    const cells = stampCells(5, 5, 5, 'circle', 20, 20);
    // r=2, circle: dx*dx+dy*dy <= 4
    // Count: 13 cells (filled circle of radius 2)
    expect(cells).toHaveLength(13);
  });

  it('should return correct square for brushSize=5', () => {
    const cells = stampCells(5, 5, 5, 'square', 20, 20);
    // r=2, square: 5x5 = 25 cells
    expect(cells).toHaveLength(25);
  });

  it('should clip cells to map bounds', () => {
    const cells = stampCells(0, 0, 5, 'square', 10, 10);
    // r=2, center at (0,0): x range [-2,2] clipped to [0,2], y range [-2,2] clipped to [0,2]
    // 3x3 = 9 cells
    expect(cells).toHaveLength(9);
    cells.forEach((c) => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle even brushSize (circle)', () => {
    // brushSize=2, r=1, same as brushSize=3
    const cells = stampCells(5, 5, 2, 'circle', 10, 10);
    expect(cells).toHaveLength(5);
  });

  it('should return empty array for fully out-of-bounds stamp', () => {
    const cells = stampCells(-10, -10, 3, 'circle', 10, 10);
    expect(cells).toHaveLength(0);
  });
});
