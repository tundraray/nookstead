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
import { ClientMessage } from '@nookstead/shared';
import type { PlayerContext } from './types';

/** Distance threshold (in pixels) to consider the player "arrived" at the move target. */
const ARRIVAL_THRESHOLD = 8;

/**
 * Walk state: handles movement, animation updates, and idle transition.
 *
 * Lifecycle:
 * - `enter()`: plays the walk animation for the current facing direction
 * - `update()`: checks keyboard first (priority), then moveTarget, then idle
 */
export class WalkState implements State {
  readonly name = 'walk';

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
      this.context.clearMoveTarget();
      this.context.stateMachine.setState('idle');
      return;
    }

    const keyboardDir = this.context.inputController.getDirection();
    const hasKeyboardInput = keyboardDir.x !== 0 || keyboardDir.y !== 0;

    if (hasKeyboardInput) {
      // Keyboard takes priority -- clear any click-to-move target
      this.context.clearMoveTarget();
      this.moveWithKeyboard(keyboardDir, delta);
      return;
    }

    if (this.context.moveTarget) {
      this.moveTowardTarget(delta);
      return;
    }

    // No keyboard input and no moveTarget -- transition to idle
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
    const target = this.context.moveTarget!;
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
   * Apply movement using the movement system (shared by both input modes).
   *
   * Computes the movement delta, applies it locally for zero-frame-lag
   * prediction, then sends the delta to the server (fire-and-forget).
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

    // Send movement delta to server (fire-and-forget, drop if not connected)
    const room = getRoom();
    if (room && (dx !== 0 || dy !== 0)) {
      room.send(ClientMessage.MOVE, { dx, dy });
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
}
