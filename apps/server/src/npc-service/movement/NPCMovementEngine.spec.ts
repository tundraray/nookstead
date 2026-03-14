import { describe, it, expect, beforeEach } from '@jest/globals';
import { NPCMovementEngine } from './NPCMovementEngine.js';
import type { Point } from '@nookstead/pathfinding';

describe('NPCMovementEngine', () => {
  let engine: NPCMovementEngine;
  const TILE_SIZE = 16;

  beforeEach(() => {
    engine = new NPCMovementEngine();
  });

  // ─── tick ─────────────────────────────────────────────────────────────────

  describe('tick', () => {
    it('moves bot toward first waypoint at correct speed', () => {
      // Waypoint at tile (3, 0) => world pixel (48, 0)
      // Bot starts at (0, 0), speed = 60 px/s, deltaMs = 100ms => move 6px
      const waypoints: Point[] = [{ x: 3, y: 0 }];
      engine.setPath(waypoints);

      const result = engine.tick(0, 0, 100, 60, TILE_SIZE);

      expect(result.moved).toBe(true);
      expect(result.newWorldX).toBe(6);
      expect(result.newWorldY).toBe(0);
    });

    it('advances to next waypoint when within BOT_WAYPOINT_THRESHOLD', () => {
      // Two waypoints: (1, 0) at pixel 16 and (2, 0) at pixel 32
      // Bot starts very close to first waypoint (within threshold)
      const waypoints: Point[] = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
      engine.setPath(waypoints);

      // Start at pixel (15, 0) — distance to waypoint (16, 0) is 1px < threshold (2px)
      const result = engine.tick(15, 0, 100, 60, TILE_SIZE);

      // Should have reached the first waypoint
      expect(result.reachedWaypoint).toBe(true);
      // Should NOT have reached the final destination yet
      expect(result.reachedDestination).toBe(false);
      // Engine should still have a path (second waypoint remaining)
      expect(engine.hasPath()).toBe(true);
    });

    it('signals reachedDestination when final waypoint reached', () => {
      // Single waypoint at (1, 0) => pixel (16, 0)
      // Bot starts at (15, 0) — within threshold
      const waypoints: Point[] = [{ x: 1, y: 0 }];
      engine.setPath(waypoints);

      const result = engine.tick(15, 0, 100, 60, TILE_SIZE);

      expect(result.reachedWaypoint).toBe(true);
      expect(result.reachedDestination).toBe(true);
      expect(engine.isComplete()).toBe(true);
    });

    it('computes correct direction for rightward movement', () => {
      // Waypoint to the right: tile (3, 0) => pixel (48, 0)
      const waypoints: Point[] = [{ x: 3, y: 0 }];
      engine.setPath(waypoints);

      const result = engine.tick(0, 0, 100, 60, TILE_SIZE);

      expect(result.direction).toBe('right');
    });

    it('computes correct direction for upward movement', () => {
      // Waypoint above: tile (0, 0) => pixel (0, 0)
      // Bot starts at (0, 48) — moving up means decreasing Y
      const waypoints: Point[] = [{ x: 0, y: 0 }];
      engine.setPath(waypoints);

      const result = engine.tick(0, 48, 100, 60, TILE_SIZE);

      expect(result.direction).toBe('up');
    });

    it('computes correct direction for leftward movement', () => {
      // Waypoint to the left: tile (0, 0) => pixel (0, 0)
      // Bot starts at (48, 0) — moving left means decreasing X
      const waypoints: Point[] = [{ x: 0, y: 0 }];
      engine.setPath(waypoints);

      const result = engine.tick(48, 0, 100, 60, TILE_SIZE);

      expect(result.direction).toBe('left');
    });

    it('computes correct direction for downward movement', () => {
      // Waypoint below: tile (0, 3) => pixel (0, 48)
      // Bot starts at (0, 0) — moving down means increasing Y
      const waypoints: Point[] = [{ x: 0, y: 3 }];
      engine.setPath(waypoints);

      const result = engine.tick(0, 0, 100, 60, TILE_SIZE);

      expect(result.direction).toBe('down');
    });

    it('returns moved:false with no path set', () => {
      const result = engine.tick(0, 0, 100, 60, TILE_SIZE);

      expect(result.moved).toBe(false);
    });

    it('clamps position to waypoint on overshoot', () => {
      // Waypoint at tile (0, 0) => pixel (0, 0)
      // Bot starts at (3, 0), speed = 60 px/s, deltaMs = 100ms => move 6px
      // Distance to target is only 3px, so should clamp to (0, 0)
      const waypoints: Point[] = [{ x: 0, y: 0 }];
      engine.setPath(waypoints);

      const result = engine.tick(3, 0, 100, 60, TILE_SIZE);

      expect(result.moved).toBe(true);
      expect(result.newWorldX).toBe(0);
      expect(result.newWorldY).toBe(0);
      expect(result.reachedWaypoint).toBe(true);
      expect(result.reachedDestination).toBe(true);
    });
  });

  // ─── clearPath ────────────────────────────────────────────────────────────

  describe('clearPath', () => {
    it('resets state so hasPath() returns false', () => {
      const waypoints: Point[] = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
      engine.setPath(waypoints);
      expect(engine.hasPath()).toBe(true);

      engine.clearPath();

      expect(engine.hasPath()).toBe(false);
      expect(engine.isComplete()).toBe(true);
      expect(engine.getRemainingWaypoints()).toEqual([]);
    });
  });

  // ─── isWaypointBlocked ────────────────────────────────────────────────────

  describe('isWaypointBlocked', () => {
    it('detects blocked tile in remaining path, not already-passed waypoints', () => {
      // Path: (1,0) -> (2,0) -> (3,0)
      const waypoints: Point[] = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ];
      engine.setPath(waypoints);

      // Advance past first waypoint by ticking close to it
      // Bot at pixel (15, 0), waypoint (1,0) at pixel (16, 0) — within threshold
      engine.tick(15, 0, 100, 60, TILE_SIZE);

      // First waypoint (1,0) should no longer be checked (already passed)
      expect(engine.isWaypointBlocked(1, 0)).toBe(false);

      // Second waypoint (2,0) is in remaining path
      expect(engine.isWaypointBlocked(2, 0)).toBe(true);

      // Third waypoint (3,0) is in remaining path
      expect(engine.isWaypointBlocked(3, 0)).toBe(true);

      // Non-existent waypoint
      expect(engine.isWaypointBlocked(5, 5)).toBe(false);
    });
  });

  // ─── getRemainingWaypoints ────────────────────────────────────────────────

  describe('getRemainingWaypoints', () => {
    it('returns correct subset after advancing through waypoints', () => {
      const waypoints: Point[] = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ];
      engine.setPath(waypoints);

      // Initially, all waypoints are remaining
      expect(engine.getRemainingWaypoints()).toEqual(waypoints);

      // Advance past first waypoint
      engine.tick(15, 0, 100, 60, TILE_SIZE);

      // Now only the last two should remain
      expect(engine.getRemainingWaypoints()).toEqual([
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]);
    });
  });
});
