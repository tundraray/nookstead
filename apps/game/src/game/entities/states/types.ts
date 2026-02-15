/**
 * Shared type definitions for player character states.
 *
 * Defines the {@link PlayerContext} interface that state classes use to
 * interact with the player entity. This decouples the states from the
 * concrete Player class (which is created in a later task) while
 * providing full type safety for animation, input, movement, and
 * map data access.
 */

import type { Direction } from '../../characters/frame-map';
import type { InputController } from '../../input/InputController';
import type { StateMachine } from '../StateMachine';
import type { Grid } from '../../mapgen/types';

/**
 * Context interface that player states use to interact with the player entity.
 *
 * This interface captures the subset of player properties and methods
 * that states need for animation, movement, and state transitions.
 * The concrete Player class (Task 12) will implement this interface.
 */
export interface PlayerContext {
  /** Sprite sheet key used for animation key generation. */
  sheetKey: string;
  /** Current facing direction for animation selection. */
  facingDirection: Direction;
  /** Input controller for reading keyboard state. */
  inputController: InputController;
  /** State machine that manages state transitions. */
  stateMachine: StateMachine;
  /** Base movement speed in pixels per second. */
  speed: number;
  /** Current X position in pixel coordinates. */
  x: number;
  /** Current Y position in pixel coordinates. */
  y: number;
  /** Map data including walkability and terrain grids. */
  mapData: { walkable: boolean[][]; grid: Grid };
  /** Map width in tiles. */
  mapWidth: number;
  /** Map height in tiles. */
  mapHeight: number;
  /** Size of each tile in pixels. */
  tileSize: number;
  /** Play an animation by key. */
  play(key: string, ignoreIfPlaying?: boolean): void;
  /** Set the entity position in pixel coordinates. */
  setPosition(x: number, y: number): this;
}
