import { describe, it, expect } from '@jest/globals';
import { BOT_MAX_PATH_LENGTH } from '@nookstead/shared';
import { Pathfinder } from './Pathfinder.js';
import type { Point } from './Pathfinder.js';

/**
 * Create a fully walkable grid of given dimensions.
 * walkable[y][x] = true (row-major).
 */
function makeOpenGrid(width: number, height: number): boolean[][] {
  return Array.from({ length: height }, () => Array(width).fill(true));
}

/**
 * Create an open grid with a vertical wall blocking column `wallX`
 * from row `fromY` to row `toY` (inclusive).
 */
function makeGridWithWall(
  width: number,
  height: number,
  wallX: number,
  fromY: number,
  toY: number
): boolean[][] {
  const grid = makeOpenGrid(width, height);
  for (let y = fromY; y <= toY; y++) {
    grid[y][wallX] = false;
  }
  return grid;
}

describe('Pathfinder', () => {
  // --- constructor ---

  describe('constructor', () => {
    it('creates an instance with a walkable grid', () => {
      const pf = new Pathfinder([[true]]);
      expect(pf).toBeInstanceOf(Pathfinder);
    });
  });

  // --- findPath ---

  describe('findPath', () => {
    it('returns path on open 4x4 grid', () => {
      const pf = new Pathfinder(makeOpenGrid(4, 4));
      const path = pf.findPath(0, 0, 3, 0);

      expect(path.length).toBeGreaterThan(0);
      // Path should exclude start, include end
      expect(path[0]).not.toEqual({ x: 0, y: 0 });
      expect(path[path.length - 1]).toEqual({ x: 3, y: 0 });
    });

    it('returns Point[] for a trivial 3x1 walkable grid', () => {
      const pf = new Pathfinder(makeOpenGrid(3, 1));
      const path: Point[] = pf.findPath(0, 0, 2, 0);

      expect(path.length).toBe(2);
      expect(path[0]).toEqual({ x: 1, y: 0 });
      expect(path[1]).toEqual({ x: 2, y: 0 });
    });

    it('returns empty array for non-walkable target', () => {
      const grid = makeOpenGrid(4, 4);
      grid[3][3] = false;
      const pf = new Pathfinder(grid);
      const path = pf.findPath(0, 0, 3, 3);

      expect(path).toEqual([]);
    });

    it('navigates around a vertical wall', () => {
      // 6x4 grid with wall at column 2, rows 0-2 (leaves row 3 open)
      const grid = makeGridWithWall(6, 4, 2, 0, 2);
      const pf = new Pathfinder(grid);
      const path = pf.findPath(0, 0, 4, 0);

      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual({ x: 4, y: 0 });
      // No waypoint should be on the wall
      for (const p of path) {
        expect(p.x !== 2 || p.y > 2).toBe(true);
      }
    });

    it('returns empty array for unreachable target', () => {
      // 4x4 grid with wall at column 2, rows 0-3 (full wall, no gap)
      const grid = makeGridWithWall(4, 4, 2, 0, 3);
      const pf = new Pathfinder(grid);
      const path = pf.findPath(0, 0, 3, 0);

      expect(path).toEqual([]);
    });

    it('returns empty array when start tile is not walkable', () => {
      const grid = makeOpenGrid(4, 4);
      grid[0][0] = false;
      const pf = new Pathfinder(grid);
      const path = pf.findPath(0, 0, 3, 3);

      expect(path).toEqual([]);
    });

    it('produces only 4-directional steps (no diagonals)', () => {
      // 6x4 grid with wall forcing a detour -- path must turn corners
      const grid = makeGridWithWall(6, 4, 2, 0, 2);
      const pf = new Pathfinder(grid);
      const path = pf.findPath(0, 0, 4, 0);

      expect(path.length).toBeGreaterThan(0);

      // Check every consecutive pair including start->first waypoint
      const fullPath: Point[] = [{ x: 0, y: 0 }, ...path];
      for (let i = 1; i < fullPath.length; i++) {
        const dx = Math.abs(fullPath[i].x - fullPath[i - 1].x);
        const dy = Math.abs(fullPath[i].y - fullPath[i - 1].y);
        // Each step must be exactly 1 tile in one axis, 0 in the other
        expect(dx + dy).toBe(1);
      }
    });

    it('returns empty array when start equals end', () => {
      const pf = new Pathfinder(makeOpenGrid(4, 4));
      const path = pf.findPath(2, 2, 2, 2);

      // pathfinding library returns [[2,2],[2,2]] or just [[2,2]];
      // after excluding start, result should be empty
      expect(path).toEqual([]);
    });

    it('truncates path at default maxPathLength (BOT_MAX_PATH_LENGTH)', () => {
      // Create a large grid where the path exceeds BOT_MAX_PATH_LENGTH
      const size = BOT_MAX_PATH_LENGTH + 50;
      const grid = makeOpenGrid(size, 1);
      const pf = new Pathfinder(grid);
      const path = pf.findPath(0, 0, size - 1, 0);

      expect(path.length).toBeLessThanOrEqual(BOT_MAX_PATH_LENGTH);
    });

    it('truncates path at custom maxPathLength when provided', () => {
      const customMax = 5;
      const grid = makeOpenGrid(20, 1);
      const pf = new Pathfinder(grid, customMax);
      const path = pf.findPath(0, 0, 19, 0);

      expect(path.length).toBe(customMax);
      // First waypoint should be (1,0), last should be (5,0)
      expect(path[0]).toEqual({ x: 1, y: 0 });
      expect(path[path.length - 1]).toEqual({ x: customMax, y: 0 });
    });

    it('does not truncate path shorter than maxPathLength', () => {
      const grid = makeOpenGrid(5, 1);
      const pf = new Pathfinder(grid, 100);
      const path = pf.findPath(0, 0, 4, 0);

      expect(path.length).toBe(4);
    });
  });

  // --- setWalkableAt ---

  describe('setWalkableAt', () => {
    it('newly blocked tile is avoided in subsequent findPath call', () => {
      const pf = new Pathfinder(makeOpenGrid(4, 4));

      // Before blocking: path through (2,0) should exist
      const pathBefore = pf.findPath(0, 0, 3, 0);
      expect(pathBefore.length).toBeGreaterThan(0);

      // Block tile (2,0)
      pf.setWalkableAt(2, 0, false);

      const pathAfter = pf.findPath(0, 0, 3, 0);
      expect(pathAfter.length).toBeGreaterThan(0);
      // Path should not include the blocked tile
      for (const p of pathAfter) {
        if (p.x === 2) {
          expect(p.y).not.toBe(0);
        }
      }
    });
  });

  // --- updateGrid ---

  describe('updateGrid', () => {
    it('replaces entire grid and new paths reflect the change', () => {
      // Start with an open 4x4 grid
      const pf = new Pathfinder(makeOpenGrid(4, 4));
      const pathBefore = pf.findPath(0, 0, 3, 0);
      expect(pathBefore.length).toBeGreaterThan(0);

      // Replace with a grid that has a full wall at column 2
      const newGrid = makeGridWithWall(4, 4, 2, 0, 3);
      pf.updateGrid(newGrid);

      const pathAfter = pf.findPath(0, 0, 3, 0);
      expect(pathAfter).toEqual([]);
    });
  });
});
