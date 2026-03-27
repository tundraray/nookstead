/**
 * Sit state for the player character.
 *
 * Plays the sit animation on entry and monitors for stand triggers.
 * The player remains stationary while sitting -- no position mutations
 * occur in this state.
 *
 * Stand triggers:
 * - X key press (toggle off)
 * - Keyboard movement input
 * - Click-to-move target or waypoint path
 *
 * Guards:
 * - Text input focus suppresses all key checks
 * - Movement lock suppresses all key checks
 */

import type { State } from '../StateMachine';
import { animKey } from '../../characters/frame-map';
import { isMovementLocked } from '../../systems/dialogue-lock';
import { isTextInputFocused } from '../../input/InputController';
import { ClientMessage } from '@nookstead/shared';
import { getRoom } from '../../../services/colyseus';
import type { PlayerContext } from './types';
import Phaser from 'phaser';

/**
 * Sit state: plays sit animation and transitions on stand triggers.
 *
 * Lifecycle:
 * - `enter()`: plays the sit animation, notifies server
 * - `update()`: checks guards and stand triggers (no position changes)
 * - `exit()`: notifies server of animation state change
 */
export class SitState implements State {
  readonly name = 'sit';

  constructor(
    private context: PlayerContext,
    private xKey: Phaser.Input.Keyboard.Key | null,
  ) {}

  enter(): void {
    const key = animKey(
      this.context.sheetKey,
      'sit',
      this.context.facingDirection,
    );
    this.context.play(key, false);
    getRoom()?.send(ClientMessage.ANIM_STATE, { animState: 'sit' });
  }

  update(_delta: number): void {
    // Guards: suppress all input when text is focused or movement is locked
    if (isTextInputFocused()) return;
    if (isMovementLocked()) return;

    // X key: stand up (AC-2)
    if (this.xKey && Phaser.Input.Keyboard.JustDown(this.xKey)) {
      this.context.stateMachine.setState('idle');
      return;
    }

    // Movement input: auto-stand (AC-3, AC-4)
    if (
      this.context.inputController.isMoving() ||
      this.context.moveTarget !== null ||
      this.context.waypoints.length > 0
    ) {
      this.context.stateMachine.setState('walk');
    }
  }

  exit(): void {
    getRoom()?.send(ClientMessage.ANIM_STATE, { animState: 'idle' });
  }
}
