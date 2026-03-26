/**
 * Walk state for the player character.
 *
 * Plays the walk animation on entry, calculates movement each frame
 * using the movement system, and transitions back to idle when input
 * ceases. Updates the animation key when the facing direction changes
 * during movement.
 *
 * Supports two movement sources with keyboard taking priority:
 * 1. **Keyboard input** (WASD/arrows) -- clears any active moveTarget
 * 2. **Click-to-move target** -- moves toward a pixel position set by
 *    the click handler in Game.ts
 */

import type { State } from '../StateMachine';
import type { Direction } from '../../characters/frame-map';
import { animKey } from '../../characters/frame-map';
import { calculateMovement } from '../../systems/movement';
import { isMovementLocked } from '../../systems/dialogue-lock';
import { getRoom } from '../../../services/colyseus';
import { ClientMessage, PLAYER_WAYPOINT_THRESHOLD } from '@nookstead/shared';
import type { PlayerContext } from './types';
import type Phaser from 'phaser';

/** Distance threshold (in pixels) to consider the player "arrived" at the move target. */
const ARRIVAL_THRESHOLD = 8;

/**
 * Walk state: handles movement, animation updates, and idle transition.
 *
 * Lifecycle:
 * - `enter()`: plays the walk animation for the current facing direction
 * - `update()`: checks keyboard first (priority), then moveTarget, then idle
 */
/** Minimum interval between MOVE messages sent to the server (ms). */
const SEND_INTERVAL_MS = 50;

export class WalkState implements State {
  readonly name = 'walk';

  /** Accumulated unsent movement deltas. */
  private pendingDx = 0;
  private pendingDy = 0;
  /** Timestamp of last MOVE message sent to server. */
  private lastSendTime = 0;

  constructor(private context: PlayerContext) {}

  enter(): void {
    const key = animKey(
      this.context.sheetKey,
      'walk',
      this.context.facingDirection
    );
    this.context.play(key, true);
  }

  update(delta: number): void {
    if (isMovementLocked()) {
      this.clearPathMarker();
      this.context.clearWaypoints();
      this.context.clearMoveTarget();
      this.context.stateMachine.setState('idle');
      return;
    }

    const keyboardDir = this.context.inputController.getDirection();
    const hasKeyboardInput = keyboardDir.x !== 0 || keyboardDir.y !== 0;

    if (hasKeyboardInput) {
      // Keyboard takes priority -- clear any click-to-move target and waypoints
      this.clearPathMarker();
      this.context.clearWaypoints();
      this.context.clearMoveTarget();
      this.moveWithKeyboard(keyboardDir, delta);
      return;
    }

    // Waypoint following (A* path from click-pathfinding system)
    if (this.context.waypoints.length > 0) {
      this.moveAlongWaypoints(delta);
      return;
    }

    // Legacy straight-line click-to-move fallback
    if (this.context.moveTarget) {
      this.moveTowardTarget(delta);
      return;
    }

    // No keyboard input, no waypoints, and no moveTarget -- transition to idle
    this.context.stateMachine.setState('idle');
  }

  /**
   * Handle keyboard-driven movement (existing behavior).
   */
  private moveWithKeyboard(
    direction: { x: number; y: number },
    delta: number
  ): void {
    // Update facing direction (horizontal priority handled by InputController)
    const newFacing = this.context.inputController.getFacingDirection();
    if (newFacing !== this.context.facingDirection) {
      this.context.facingDirection = newFacing;
      const key = animKey(this.context.sheetKey, 'walk', newFacing);
      this.context.play(key, true);
    }

    // Normalize diagonal direction so diagonal speed equals cardinal speed
    const mag = Math.sqrt(
      direction.x * direction.x + direction.y * direction.y
    );
    const normalizedDir =
      mag > 0
        ? { x: direction.x / mag, y: direction.y / mag }
        : direction;

    this.applyMovement(normalizedDir, delta);
  }

  /**
   * Handle click-to-move movement toward the stored target.
   */
  private moveTowardTarget(delta: number): void {
    const target = this.context.moveTarget;
    if (!target) return;
    const dx = target.x - this.context.x;
    const dy = target.y - this.context.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check if we have arrived at the target
    if (dist <= ARRIVAL_THRESHOLD) {
      this.context.clearMoveTarget();
      this.context.stateMachine.setState('idle');
      return;
    }

    // Calculate normalized direction toward target
    const normalizedDir = { x: dx / dist, y: dy / dist };

    // Determine facing direction from movement direction
    const newFacing = this.directionFromVector(normalizedDir);
    if (newFacing !== this.context.facingDirection) {
      this.context.facingDirection = newFacing;
      const key = animKey(this.context.sheetKey, 'walk', newFacing);
      this.context.play(key, true);
    }

    this.applyMovement(normalizedDir, delta);
  }

  /**
   * Handle waypoint-based movement along an A* computed path.
   *
   * Moves toward the current waypoint (tile coords converted to pixel position).
   * When within threshold, advances to the next waypoint. When all waypoints
   * are exhausted, clears waypoints and transitions to idle.
   */
  private moveAlongWaypoints(delta: number): void {
    const waypoint = this.context.waypoints[this.context.currentWaypointIndex];
    const isLastWaypoint =
      this.context.currentWaypointIndex === this.context.waypoints.length - 1;

    // Convert tile coords to pixel position (feet-aligned: bottom edge of tile)
    const targetPx = waypoint.x * this.context.tileSize + this.context.tileSize / 2;
    const targetPy = (waypoint.y + 1) * this.context.tileSize;

    const dx = targetPx - this.context.x;
    const dy = targetPy - this.context.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Use arrival threshold for final waypoint, tight threshold for intermediates
    const threshold = isLastWaypoint ? ARRIVAL_THRESHOLD : PLAYER_WAYPOINT_THRESHOLD;

    if (dist <= threshold) {
      if (isLastWaypoint) {
        // Reached destination -- clear marker and waypoints
        this.clearPathMarker();
        this.context.clearWaypoints();
        this.context.clearMoveTarget();
        this.context.stateMachine.setState('idle');
      } else {
        // Advance to next waypoint
        this.context.currentWaypointIndex += 1;
      }
      return;
    }

    const normalizedDir = { x: dx / dist, y: dy / dist };

    const newFacing = this.directionFromVector(normalizedDir);
    if (newFacing !== this.context.facingDirection) {
      this.context.facingDirection = newFacing;
      const key = animKey(this.context.sheetKey, 'walk', newFacing);
      this.context.play(key, true);
    }

    this.applyMovement(normalizedDir, delta);
  }

  /**
   * Apply movement using the movement system (shared by both input modes).
   *
   * Computes the movement delta, applies it locally for zero-frame-lag
   * prediction, then sends accumulated deltas to the server at a
   * throttled rate (~20Hz) to reduce network overhead.
   */
  private applyMovement(
    direction: { x: number; y: number },
    delta: number
  ): void {
    const result = calculateMovement({
      position: { x: this.context.x, y: this.context.y },
      direction,
      speed: this.context.speed,
      delta,
      walkable: this.context.mapData.walkable,
      grid: this.context.mapData.grid,
      mapWidth: this.context.mapWidth,
      mapHeight: this.context.mapHeight,
      tileSize: this.context.tileSize,
      feetOffsetY: 1,
    });

    // Compute movement delta BEFORE updating position
    const dx = result.x - this.context.x;
    const dy = result.y - this.context.y;

    // Apply movement locally for zero-frame-lag prediction (FR-16 AC16.1)
    this.context.setPosition(result.x, result.y);

    // Accumulate deltas and send at throttled rate
    this.pendingDx += dx;
    this.pendingDy += dy;

    const room = getRoom();
    const now = performance.now();
    if (
      room &&
      (this.pendingDx !== 0 || this.pendingDy !== 0) &&
      now - this.lastSendTime >= SEND_INTERVAL_MS
    ) {
      room.send(ClientMessage.MOVE, {
        dx: this.pendingDx,
        dy: this.pendingDy,
      });
      this.pendingDx = 0;
      this.pendingDy = 0;
      this.lastSendTime = now;
    }
  }

  /**
   * Flush any remaining unsent movement deltas to the server.
   * Called when transitioning out of walk state to ensure the
   * server receives the final position.
   */
  exit(): void {
    const room = getRoom();
    if (room && (this.pendingDx !== 0 || this.pendingDy !== 0)) {
      room.send(ClientMessage.MOVE, {
        dx: this.pendingDx,
        dy: this.pendingDy,
      });
      this.pendingDx = 0;
      this.pendingDy = 0;
    }
  }

  /**
   * Convert a direction vector to a cardinal facing direction.
   * Horizontal takes priority for diagonal movement.
   */
  private directionFromVector(dir: { x: number; y: number }): Direction {
    if (Math.abs(dir.x) >= Math.abs(dir.y)) {
      return dir.x < 0 ? 'left' : 'right';
    }
    return dir.y < 0 ? 'up' : 'down';
  }

  /**
   * Clear the click-pathfinding destination marker via the scene data registry.
   *
   * Retrieves the `clickPathClearMarker` callback registered by Game.ts.
   * Defensive: silently does nothing if the context lacks a scene reference
   * or the callback is not registered (e.g., during unit tests).
   */
  private clearPathMarker(): void {
    const scene = (this.context as unknown as { scene?: Phaser.Scene }).scene;
    const cb = scene?.data?.get('clickPathClearMarker') as (() => void) | undefined;
    cb?.();
  }
}
