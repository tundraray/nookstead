import { BOT_WAYPOINT_THRESHOLD } from '@nookstead/shared';
import type { Point } from '@nookstead/pathfinding';

/**
 * Result of a single movement tick.
 */
export interface MovementResult {
  /** Whether the bot moved this tick. */
  moved: boolean;
  /** Whether the bot reached the current intermediate waypoint. */
  reachedWaypoint: boolean;
  /** Whether the bot reached the final destination. */
  reachedDestination: boolean;
  /** New world X position in pixels. */
  newWorldX: number;
  /** New world Y position in pixels. */
  newWorldY: number;
  /** Movement direction: 'up' | 'down' | 'left' | 'right'. */
  direction: string;
}

/** Result returned when no movement occurs. */
const NO_MOVE: MovementResult = {
  moved: false,
  reachedWaypoint: false,
  reachedDestination: false,
  newWorldX: 0,
  newWorldY: 0,
  direction: 'down',
};

/**
 * Per-bot waypoint-following engine.
 *
 * Given a path of Point[] waypoints (tile coordinates), advances a bot
 * from its current world-pixel position toward each waypoint at a
 * configurable speed. Pure calculation — no Colyseus dependency,
 * no state machine logic.
 */
export class NPCMovementEngine {
  private waypoints: Point[] = [];
  private currentIndex = 0;

  /**
   * Set the waypoint path for this engine to follow.
   * Resets the current index to 0.
   */
  setPath(waypoints: Point[]): void {
    this.waypoints = waypoints;
    this.currentIndex = 0;
  }

  /**
   * Advance the bot position toward the current waypoint.
   *
   * @param currentWorldX - Current bot X in world pixels
   * @param currentWorldY - Current bot Y in world pixels
   * @param deltaMs - Time elapsed since last tick in milliseconds
   * @param speed - Movement speed in pixels per second
   * @param tileSize - Size of one tile in pixels
   * @returns Movement result with new position, direction, and status flags
   */
  tick(
    currentWorldX: number,
    currentWorldY: number,
    deltaMs: number,
    speed: number,
    tileSize: number
  ): MovementResult {
    if (!this.hasPath()) {
      return { ...NO_MOVE, newWorldX: currentWorldX, newWorldY: currentWorldY };
    }

    const waypoint = this.waypoints[this.currentIndex];
    const targetX = waypoint.x * tileSize;
    const targetY = waypoint.y * tileSize;

    const dx = targetX - currentWorldX;
    const dy = targetY - currentWorldY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if already within waypoint threshold
    if (distance <= BOT_WAYPOINT_THRESHOLD) {
      return this.advanceWaypoint(targetX, targetY, dx, dy);
    }

    // Calculate movement distance for this tick
    const moveDistance = speed * (deltaMs / 1000);

    // Clamp to target if overshoot
    if (moveDistance >= distance) {
      return this.advanceWaypoint(targetX, targetY, dx, dy);
    }

    // Move toward waypoint
    const ratio = moveDistance / distance;
    const newX = currentWorldX + dx * ratio;
    const newY = currentWorldY + dy * ratio;
    const direction = computeDirection(dx, dy);

    return {
      moved: true,
      reachedWaypoint: false,
      reachedDestination: false,
      newWorldX: newX,
      newWorldY: newY,
      direction,
    };
  }

  /** Whether a path is set and not yet complete. */
  hasPath(): boolean {
    return this.waypoints.length > 0 && this.currentIndex < this.waypoints.length;
  }

  /** Whether all waypoints have been reached. */
  isComplete(): boolean {
    return this.waypoints.length === 0 || this.currentIndex >= this.waypoints.length;
  }

  /** Reset all internal state. */
  clearPath(): void {
    this.waypoints = [];
    this.currentIndex = 0;
  }

  /** Return waypoints from current index onward. */
  getRemainingWaypoints(): Point[] {
    return this.waypoints.slice(this.currentIndex);
  }

  /**
   * Check if a given tile coordinate is in the remaining path.
   * Only checks from the current index onward (not already-passed waypoints).
   */
  isWaypointBlocked(blockedX: number, blockedY: number): boolean {
    const remaining = this.getRemainingWaypoints();
    return remaining.some((wp) => wp.x === blockedX && wp.y === blockedY);
  }

  /**
   * Advance to the next waypoint (or mark destination reached).
   * Returns a MovementResult snapped to the waypoint position.
   */
  private advanceWaypoint(
    waypointX: number,
    waypointY: number,
    dx: number,
    dy: number
  ): MovementResult {
    this.currentIndex++;
    const reachedDestination = this.currentIndex >= this.waypoints.length;
    const direction = computeDirection(dx, dy);

    return {
      moved: true,
      reachedWaypoint: true,
      reachedDestination,
      newWorldX: waypointX,
      newWorldY: waypointY,
      direction,
    };
  }
}

/**
 * Compute 4-directional movement direction from a delta vector.
 * The axis with the larger absolute delta wins.
 */
function computeDirection(dx: number, dy: number): string {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'down' : 'up';
}
