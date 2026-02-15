/**
 * Idle state for the player character.
 *
 * Plays the idle animation on entry and monitors input for movement.
 * When directional input is detected, transitions to the walk state.
 *
 * This state is the default resting state -- the character stands still
 * and faces the last movement direction.
 */

import type { State } from '../StateMachine';
import { animKey } from '../../characters/frame-map';
import type { PlayerContext } from './types';

/**
 * Idle state: plays idle animation and transitions to walk on input.
 *
 * Lifecycle:
 * - `enter()`: plays the idle animation for the current facing direction
 * - `update()`: checks input each frame and transitions to walk if moving
 */
export class IdleState implements State {
  readonly name = 'idle';

  constructor(private context: PlayerContext) {}

  enter(): void {
    const key = animKey(
      this.context.sheetKey,
      'idle',
      this.context.facingDirection
    );
    this.context.play(key, true);
  }

  update(_delta: number): void {
    if (this.context.input.isMoving()) {
      this.context.stateMachine.setState('walk');
    }
  }
}
