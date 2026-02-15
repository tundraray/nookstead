/**
 * Player entity for the game world.
 *
 * Extends {@link Phaser.GameObjects.Sprite} and integrates all player
 * subsystems: input reading via {@link InputController}, behavioral
 * state management via {@link StateMachine}, and map-aware movement.
 *
 * The sprite uses a bottom-center anchor (origin 0.5, 1.0) so the
 * character's feet align to tile centers. Renders at depth 2, above
 * the hover highlight layer (depth 1) and the map texture (depth 0).
 *
 * Seven states are registered in the FSM:
 * - **idle** and **walk** are fully implemented MVP states
 * - **waiting**, **sit**, **hit**, **punch**, **hurt** are placeholder
 *   states that play the corresponding animation on entry
 */

import Phaser from 'phaser';
import { StateMachine, type State } from './StateMachine';
import { InputController } from '../input/InputController';
import { IdleState, WalkState } from './states';
import { type Direction, animKey } from '../characters/frame-map';
import { getDefaultSkin } from '../characters/skin-registry';
import type { GeneratedMap } from '../mapgen/types';
import { PLAYER_SPEED, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../constants';

export class Player extends Phaser.GameObjects.Sprite {
  public readonly sheetKey: string;
  public facingDirection: Direction;

  public readonly inputController: InputController;

  public readonly stateMachine: StateMachine;
  public readonly mapData: GeneratedMap;
  public readonly speed: number;
  public readonly mapWidth: number;
  public readonly mapHeight: number;
  public readonly tileSize: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    mapData: GeneratedMap,
  ) {
    const skin = getDefaultSkin();
    super(scene, x, y, skin.sheetKey);

    this.sheetKey = skin.sheetKey;
    this.facingDirection = 'down';
    this.mapData = mapData;
    this.speed = PLAYER_SPEED;
    this.mapWidth = MAP_WIDTH;
    this.mapHeight = MAP_HEIGHT;
    this.tileSize = TILE_SIZE;

    // Bottom-center anchor (feet alignment)
    this.setOrigin(0.5, 1.0);
    // Above hover highlight (depth 1), map render texture (depth 0)
    this.setDepth(2);

    // Add to scene display list
    scene.add.existing(this);

    // Create input controller
    this.inputController = new InputController(scene);

    // Create MVP states
    const idleState = new IdleState(this);
    const walkState = new WalkState(this);

    // Create state machine (starts in 'idle')
    this.stateMachine = new StateMachine(this, 'idle', {
      idle: idleState,
      walk: walkState,
      waiting: this.createPlaceholderState('waiting'),
      sit: this.createPlaceholderState('sit'),
      hit: this.createPlaceholderState('hit'),
      punch: this.createPlaceholderState('punch'),
      hurt: this.createPlaceholderState('hurt'),
    });
  }

  /**
   * Phaser frame update hook.
   *
   * Calls the parent implementation (required for the animation system)
   * then delegates to the active FSM state.
   */
  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.stateMachine.update(delta);
  }

  /**
   * Create a placeholder state for non-MVP animations.
   *
   * Placeholder states play their corresponding animation on entry
   * but have no update logic. They are used for states that will
   * receive full implementation in future tasks.
   */
  private createPlaceholderState(name: string): State {
    return {
      name,
      enter: () => {
        this.play(animKey(this.sheetKey, name, this.facingDirection));
      },
    };
  }
}
