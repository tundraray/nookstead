/**
 * Walk state for the player character.
 *
 * Plays the walk animation on entry, calculates movement each frame
 * using the movement system, and transitions back to idle when input
 * ceases. Updates the animation key when the facing direction changes
 * during movement.
 */

import type { State } from '../StateMachine';
import { animKey } from '../../characters/frame-map';
import { calculateMovement } from '../../systems/movement';
import type { PlayerContext } from './types';

/**
 * Walk state: handles movement, animation updates, and idle transition.
 *
 * Lifecycle:
 * - `enter()`: plays the walk animation for the current facing direction
 * - `update()`: reads input direction, updates animation on direction
 *   change, calculates movement via the movement system, and applies
 *   the resulting position. Transitions to idle when input stops.
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
    const direction = this.context.input.getDirection();

    if (direction.x === 0 && direction.y === 0) {
      this.context.stateMachine.setState('idle');
      return;
    }

    // Update facing direction (horizontal priority is handled by InputController)
    const newFacing = this.context.input.getFacingDirection();
    if (newFacing !== this.context.facingDirection) {
      this.context.facingDirection = newFacing;
      const key = animKey(this.context.sheetKey, 'walk', newFacing);
      this.context.play(key, true);
    }

    // Calculate and apply movement
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
    });

    this.context.setPosition(result.x, result.y);
  }
}
