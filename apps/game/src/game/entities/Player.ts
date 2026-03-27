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
 * - **idle**, **walk**, and **sit** are fully implemented states
 * - **waiting**, **hit**, **punch**, **hurt** are placeholder
 *   states that play the corresponding animation on entry
 */

import Phaser from 'phaser';
import { StateMachine, type State } from './StateMachine';
import { InputController } from '../input/InputController';
import { IdleState, WalkState } from './states';
import { SitState } from './states/SitState';
import { type Direction, animKey } from '../characters/frame-map';
import { getActiveSkin } from '../characters/skin-registry';
import type { GeneratedMap } from '@nookstead/shared';
import type { Point } from '@nookstead/pathfinding';
import { PLAYER_SPEED, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../constants';
import { ClientMessage } from '@nookstead/shared';
import { findNearestWalkable } from '../systems/displacement';
import { getRoom } from '../../services/colyseus';

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

  /** Active A* waypoint path. Empty when not following a path. */
  public waypoints: Point[] = [];
  /** Index into `waypoints` of the waypoint currently being targeted. */
  public currentWaypointIndex = 0;

  /** True while the player is displaced — suppresses repeated spiral searches. */
  private displaced = false;

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

    // Bottom-center anchor (feet alignment)
    this.setOrigin(0.5, 1.0);

    // Add to scene display list
    scene.add.existing(this);

    // Create input controller
    this.inputController = new InputController(scene);

    // Register X key for sit state toggle
    const xKey = scene.input.keyboard?.addKey('X') ?? null;

    // Create MVP states
    const idleState = new IdleState(this);
    const walkState = new WalkState(this);
    const sitState = new SitState(this, xKey);

    // Create state machine (starts in 'idle')
    this.stateMachine = new StateMachine(this, 'idle', {
      idle: idleState,
      walk: walkState,
      waiting: this.createPlaceholderState('waiting'),
      sit: sitState,
      hit: this.createPlaceholderState('hit'),
      punch: this.createPlaceholderState('punch'),
      hurt: this.createPlaceholderState('hurt'),
    });
  }

  /**
   * Phaser frame update hook.
   *
   * Calls the parent implementation (required for the animation system),
   * checks for displacement, then delegates to the active FSM state.
   */
  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    // Displacement check: if on a non-walkable tile, relocate to nearest walkable
    const tileX = Math.floor(this.x / TILE_SIZE);
    const tileY = Math.floor((this.y - 1) / TILE_SIZE);
    const walkable = this.mapData.walkable;
    if (
      walkable &&
      (tileX < 0 ||
        tileX >= MAP_WIDTH ||
        tileY < 0 ||
        tileY >= MAP_HEIGHT ||
        !walkable[tileY]?.[tileX])
    ) {
      if (!this.displaced) {
        const nearby = findNearestWalkable(
          tileX,
          tileY,
          walkable,
          MAP_WIDTH,
          MAP_HEIGHT,
        );
        if (nearby) {
          this.x = nearby.tileX * TILE_SIZE + TILE_SIZE / 2;
          this.y = (nearby.tileY + 1) * TILE_SIZE;
          // Notify server of corrected position
          const room = getRoom();
          if (room) {
            room.send(ClientMessage.POSITION_UPDATE, {
              x: this.x,
              y: this.y,
            });
          }
        }
        this.displaced = true;
      }
    } else {
      this.displaced = false;
    }

    // Y-sorted depth: player renders in front of objects with lower y (AC-4.6)
    this.setDepth(this.y);

    this.stateMachine.update(delta);
  }

  /**
   * Placeholder for future server-authoritative reconciliation.
   * Currently disabled: local player trusts client-side prediction (MVP).
   * Will be re-enabled when input-state architecture is implemented.
   */
  reconcile(_serverX: number, _serverY: number): void {
    // Intentionally no-op during client-authoritative MVP.
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
   * Set a new waypoint path and begin following it.
   * Stores the array, resets index to 0, and transitions to walk if idle.
   */
  setWaypoints(waypoints: Point[]): void {
    this.waypoints = waypoints;
    this.currentWaypointIndex = 0;
    if (waypoints.length > 0 && this.stateMachine.currentState === 'idle') {
      this.stateMachine.setState('walk');
    }
  }

  /**
   * Clear the waypoint path and reset the index.
   */
  clearWaypoints(): void {
    this.waypoints = [];
    this.currentWaypointIndex = 0;
  }

  /**
   * Send an animation state message to the server.
   *
   * Provides a consistent API for states (and external callers) to notify
   * the server of animation state changes rather than calling
   * `getRoom()?.send()` directly.
   */
  sendAnimState(state: string): void {
    getRoom()?.send(ClientMessage.ANIM_STATE, { animState: state });
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
