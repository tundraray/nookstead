/**
 * Player entity for the game world.
 *
 * Extends {@link Phaser.GameObjects.Sprite} and integrates all player
 * subsystems: input reading via {@link InputController}, behavioral
 * state management via {@link StateMachine}, and map-aware movement.
 *
 * The sprite uses a bottom-center anchor (origin 0.5, 1.0) so the
 * character's feet align to tile centers. Depth is y-sorted each
 * frame via `setDepth(this.y)` so the player correctly occludes
 * game objects based on vertical screen position.
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
import { getActiveSkin } from '../characters/skin-registry';
import type { GeneratedMap } from '@nookstead/shared';
import { PLAYER_SPEED, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../constants';
import { CORRECTION_THRESHOLD, INTERPOLATION_SPEED } from '@nookstead/shared';

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

  /** Click-to-move target position, or null when inactive. */
  public moveTarget: { x: number; y: number } | null = null;

  // Prediction state (FR-16)
  /** Last authoritative X position received from the server. */
  authoritativeX: number;
  /** Last authoritative Y position received from the server. */
  authoritativeY: number;
  /** Whether the player is currently interpolating toward the authoritative position. */
  private isInterpolating = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    mapData: GeneratedMap,
    initialDirection: Direction = 'down',
  ) {
    const skin = getActiveSkin();
    super(scene, x, y, skin.sheetKey);

    this.sheetKey = skin.sheetKey;
    this.facingDirection = initialDirection;
    this.mapData = mapData;
    this.speed = PLAYER_SPEED;
    this.mapWidth = MAP_WIDTH;
    this.mapHeight = MAP_HEIGHT;
    this.tileSize = TILE_SIZE;

    // Initialize authoritative position to starting position
    this.authoritativeX = x;
    this.authoritativeY = y;

    // Bottom-center anchor (feet alignment)
    this.setOrigin(0.5, 1.0);

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
   * Calls the parent implementation (required for the animation system),
   * applies reconciliation interpolation toward the authoritative position,
   * then delegates to the active FSM state.
   *
   * Interpolation runs at the Player entity level so it continues through
   * Walk -> Idle state transitions without interruption.
   */
  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    // Y-sorted depth: player renders in front of objects with lower y (AC-4.6)
    this.setDepth(this.y);

    // Apply reconciliation interpolation if active (FR-16)
    if (this.isInterpolating) {
      const dx = this.authoritativeX - this.x;
      const dy = this.authoritativeY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.5) {
        // Close enough: snap to authoritative and stop interpolating
        this.x = this.authoritativeX;
        this.y = this.authoritativeY;
        this.isInterpolating = false;
      } else {
        // Lerp toward authoritative position
        this.x += dx * INTERPOLATION_SPEED;
        this.y += dy * INTERPOLATION_SPEED;
      }
    }

    this.stateMachine.update(delta);
  }

  /**
   * Called when the server sends an authoritative position update.
   *
   * Determines whether to interpolate smoothly or snap to the new position
   * based on the distance delta between predicted and authoritative positions.
   *
   * - Delta >= CORRECTION_THRESHOLD (8px): snap immediately
   * - Delta > 0.5px but < CORRECTION_THRESHOLD: smooth interpolation
   * - Delta <= 0.5px: already in sync, no action needed
   *
   * This method is called at the Player entity level, NOT within FSM states.
   * Interpolation continues even when state transitions from Walk to Idle.
   */
  reconcile(serverX: number, serverY: number): void {
    this.authoritativeX = serverX;
    this.authoritativeY = serverY;

    const dx = serverX - this.x;
    const dy = serverY - this.y;
    const delta = Math.sqrt(dx * dx + dy * dy);

    if (delta >= CORRECTION_THRESHOLD) {
      // Large delta: snap immediately
      this.x = serverX;
      this.y = serverY;
      this.isInterpolating = false;
    } else if (delta > 0.5) {
      // Small delta: begin interpolation
      this.isInterpolating = true;
    } else {
      // Negligible delta: already in sync
      this.isInterpolating = false;
    }
  }

  /**
   * Set a click-to-move target position.
   *
   * Stores the target and transitions to 'walk' if currently idle,
   * so the WalkState can begin moving toward the target.
   */
  setMoveTarget(x: number, y: number): void {
    this.moveTarget = { x, y };
    if (this.stateMachine.currentState === 'idle') {
      this.stateMachine.setState('walk');
    }
  }

  /**
   * Clear the click-to-move target.
   */
  clearMoveTarget(): void {
    this.moveTarget = null;
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
