/**
 * Unit tests for the click-pathfinding system module.
 *
 * Tests verify:
 * 1. handleClick on walkable reachable tile calls player.setWaypoints with a path
 * 2. handleClick on non-walkable tile does not call player.setWaypoints
 * 3. handleClick on walkable but unreachable tile does not call player.setWaypoints
 * 4. handleClick on the player's current tile does nothing harmful
 * 5. destroy() can be called without error
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClickPathfindingSystem } from './click-pathfinding';

const TILE_SIZE = 16;

/**
 * Build a small walkable grid for testing.
 * 5x5 grid, all walkable except specified blocked tiles.
 */
function buildGrid(
  width: number,
  height: number,
  blocked: Array<{ x: number; y: number }> = []
): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const isBlocked = blocked.some((b) => b.x === x && b.y === y);
      row.push(!isBlocked);
    }
    grid.push(row);
  }
  return grid;
}

/** Create a mock player (ClickTarget interface) at a given tile position. */
function createMockPlayer(
  tileX: number,
  tileY: number,
  walkable: boolean[][]
) {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: (tileY + 1) * TILE_SIZE,
    mapData: { walkable },
    tileSize: TILE_SIZE,
    setWaypoints: jest.fn(),
  };
}

/** Minimal Phaser.Scene mock with graphics methods needed by visual feedback. */
function createMockScene(): any {
  return {
    add: {
      graphics: jest.fn(() => ({
        destroy: jest.fn(),
        lineStyle: jest.fn(),
        fillStyle: jest.fn(),
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        setDepth: jest.fn(),
      })),
    },
    tweens: {
      add: jest.fn((config: any) => {
        // Immediately invoke onComplete to simulate tween finishing
        config.onComplete?.();
      }),
    },
  };
}

describe('click-pathfinding system', () => {
  describe('handleClick on walkable reachable tile', () => {
    it('should call player.setWaypoints with a non-empty path', () => {
      const walkable = buildGrid(5, 5);
      const scene = createMockScene();
      const system = createClickPathfindingSystem(scene, walkable, TILE_SIZE);
      const player = createMockPlayer(0, 0, walkable);

      // Click on tile (3, 0) — walkable and reachable
      const worldX = 3 * TILE_SIZE + TILE_SIZE / 2;
      const worldY = 0 * TILE_SIZE + TILE_SIZE / 2;
      system.handleClick(worldX, worldY, player);

      expect(player.setWaypoints).toHaveBeenCalledTimes(1);
      const waypoints = player.setWaypoints.mock.calls[0][0];
      expect(waypoints.length).toBeGreaterThan(0);
      // The final waypoint should be the target tile
      expect(waypoints[waypoints.length - 1]).toEqual({ x: 3, y: 0 });
    });
  });

  describe('handleClick on non-walkable tile', () => {
    it('should not call player.setWaypoints', () => {
      // Block tile (2, 0)
      const walkable = buildGrid(5, 5, [{ x: 2, y: 0 }]);
      const scene = createMockScene();
      const system = createClickPathfindingSystem(scene, walkable, TILE_SIZE);
      const player = createMockPlayer(0, 0, walkable);

      // Click on the non-walkable tile (2, 0)
      const worldX = 2 * TILE_SIZE + TILE_SIZE / 2;
      const worldY = 0 * TILE_SIZE + TILE_SIZE / 2;
      system.handleClick(worldX, worldY, player);

      expect(player.setWaypoints).not.toHaveBeenCalled();
    });
  });

  describe('handleClick on walkable but unreachable tile', () => {
    it('should not call player.setWaypoints when path is blocked', () => {
      // Create a grid where tile (4, 0) is walkable but completely surrounded
      // by blocked tiles, making it unreachable from (0, 0)
      const blocked = [
        { x: 3, y: 0 },
        { x: 4, y: 1 },
        { x: 3, y: 1 },
      ];
      // Also block the whole row 1 to fully surround
      const walkable = buildGrid(5, 5, [
        ...blocked,
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ]);
      // Make sure (4, 0) is walkable but (3, 0) is blocked
      // Player at (0, 0), target at (4, 0)
      // Row 1 fully blocked, tile (3, 0) blocked => no path to (4, 0)
      const scene = createMockScene();
      const system = createClickPathfindingSystem(scene, walkable, TILE_SIZE);
      const player = createMockPlayer(0, 0, walkable);

      const worldX = 4 * TILE_SIZE + TILE_SIZE / 2;
      const worldY = 0 * TILE_SIZE + TILE_SIZE / 2;
      system.handleClick(worldX, worldY, player);

      expect(player.setWaypoints).not.toHaveBeenCalled();
    });
  });

  describe('handleClick on current tile', () => {
    it('should not throw and should not set waypoints (empty path)', () => {
      const walkable = buildGrid(5, 5);
      const scene = createMockScene();
      const system = createClickPathfindingSystem(scene, walkable, TILE_SIZE);
      const player = createMockPlayer(2, 2, walkable);

      // Click on the tile the player is already standing on
      const worldX = 2 * TILE_SIZE + TILE_SIZE / 2;
      const worldY = 2 * TILE_SIZE + TILE_SIZE / 2;

      expect(() => {
        system.handleClick(worldX, worldY, player);
      }).not.toThrow();

      // findPath returns empty when start == end (excludes start tile),
      // so setWaypoints should not be called
      expect(player.setWaypoints).not.toHaveBeenCalled();
    });
  });

  describe('handleClick out of bounds', () => {
    it('should not call player.setWaypoints for out-of-bounds click', () => {
      const walkable = buildGrid(5, 5);
      const scene = createMockScene();
      const system = createClickPathfindingSystem(scene, walkable, TILE_SIZE);
      const player = createMockPlayer(0, 0, walkable);

      // Click outside the grid (negative coordinates)
      system.handleClick(-10, -10, player);

      expect(player.setWaypoints).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should be callable without error', () => {
      const walkable = buildGrid(5, 5);
      const scene = createMockScene();
      const system = createClickPathfindingSystem(scene, walkable, TILE_SIZE);

      expect(() => {
        system.destroy();
      }).not.toThrow();
    });
  });
});
