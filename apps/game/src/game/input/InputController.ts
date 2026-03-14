/**
 * Keyboard input controller for player movement.
 *
 * Reads WASD and arrow key states from Phaser's keyboard manager
 * and produces normalized direction vectors ({-1|0|1} per axis).
 * Tracks the last non-zero facing direction with horizontal priority
 * for diagonal movement visual clarity.
 *
 * Pure input-reading module with NO game logic.
 */

import type { Direction } from '../characters/frame-map';

const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Check whether the currently focused element accepts text input.
 *
 * Uses `document.activeElement` directly instead of focus-event
 * listeners, which eliminates race conditions when focus moves
 * between elements (focusout fires before focusin on the next
 * element, briefly re-enabling input).
 */
export function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  if (TEXT_INPUT_TAGS.has(el.tagName)) return true;
  const htmlEl = el as HTMLElement;
  if (htmlEl.isContentEditable || htmlEl.contentEditable === 'true')
    return true;
  return false;
}

/**
 * InputController reads keyboard state from a Phaser Scene and
 * exposes directional input as a simple vector plus facing direction.
 */
export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<string, Phaser.Input.Keyboard.Key>;
  private _facingDirection: Direction = 'down';

  /**
   * Create a new InputController bound to the given scene's keyboard.
   *
   * @param scene - The Phaser scene whose keyboard input to read.
   * @throws If scene.input.keyboard is not available.
   */
  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error(
        'InputController requires scene.input.keyboard to be available'
      );
    }
    // Prevent Phaser from calling preventDefault() on keyboard events
    // globally, so WASD/arrow keys still work in HTML inputs and textareas.
    keyboard.disableGlobalCapture();

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D', false) as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  /**
   * Read current key states and return a direction vector.
   *
   * Each axis is -1, 0, or 1. Opposing keys cancel out (e.g. W+S = 0).
   * Returns {0, 0} when a text input element is focused so that
   * typing in chat/forms doesn't move the character.
   *
   * @returns Direction vector with integer x and y components.
   */
  getDirection(): { x: number; y: number } {
    if (isTextInputFocused()) {
      return { x: 0, y: 0 };
    }

    const up = this.wasd.W.isDown || this.cursors.up.isDown;
    const down = this.wasd.S.isDown || this.cursors.down.isDown;
    const left = this.wasd.A.isDown || this.cursors.left.isDown;
    const right = this.wasd.D.isDown || this.cursors.right.isDown;

    const x = (right ? 1 : 0) - (left ? 1 : 0);
    const y = (down ? 1 : 0) - (up ? 1 : 0);

    return { x, y };
  }

  /**
   * Check whether any directional key is currently pressed.
   *
   * @returns True if the direction vector is non-zero.
   */
  isMoving(): boolean {
    const dir = this.getDirection();
    return dir.x !== 0 || dir.y !== 0;
  }

  /**
   * Get the current facing direction, updated from key input.
   *
   * Horizontal input takes priority over vertical when moving diagonally,
   * so the character faces left/right rather than up/down during diagonal
   * movement. The facing direction persists from the last non-zero input.
   *
   * @returns The current facing direction.
   */
  getFacingDirection(): Direction {
    const dir = this.getDirection();

    if (dir.x < 0) {
      this._facingDirection = 'left';
    } else if (dir.x > 0) {
      this._facingDirection = 'right';
    } else if (dir.y < 0) {
      this._facingDirection = 'up';
    } else if (dir.y > 0) {
      this._facingDirection = 'down';
    }

    return this._facingDirection;
  }

  /**
   * Clean up resources. No-op since text-input detection uses
   * document.activeElement polling instead of event listeners.
   */
  destroy(): void {
    // Intentionally empty — no listeners to remove.
  }
}
