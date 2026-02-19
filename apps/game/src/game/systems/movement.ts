/**
 * Movement and collision system.
 *
 * Pure functions for calculating player movement with terrain speed
 * modifiers, axis-independent collision detection (wall-sliding),
 * delta time clamping, and map boundary clamping.
 *
 * No Phaser dependency -- framework-agnostic logic.
 */

import { getSurfaceProperties } from '@nookstead/map-lib';
import type { Grid } from '@nookstead/shared';

/** Input parameters for a single movement calculation. */
export interface MovementInput {
  /** Current position in pixel coordinates. */
  position: { x: number; y: number };
  /** Normalized direction vector (caller is responsible for normalization). */
  direction: { x: number; y: number };
  /** Base movement speed in pixels per second. */
  speed: number;
  /** Frame delta time in milliseconds. */
  delta: number;
  /** Walkability grid: walkable[y][x] (row-major). */
  walkable: boolean[][];
  /** Terrain grid: grid[y][x] (row-major). */
  grid: Grid;
  /** Map width in tiles. */
  mapWidth: number;
  /** Map height in tiles. */
  mapHeight: number;
  /** Size of each tile in pixels. */
  tileSize: number;
}

/** Result of a movement calculation. */
export interface MovementResult {
  /** New X position in pixels. */
  x: number;
  /** New Y position in pixels. */
  y: number;
  /** Which axes were blocked by collision. */
  blocked: { x: boolean; y: boolean };
}

/** Maximum delta time in milliseconds to prevent wall tunneling. */
const MAX_DELTA_MS = 50;

/**
 * Convert a pixel coordinate to a tile coordinate.
 *
 * @param pixel - Position in pixels.
 * @param tileSize - Size of a tile in pixels.
 * @returns The tile index (floored).
 */
function pixelToTile(pixel: number, tileSize: number): number {
  return Math.floor(pixel / tileSize);
}

/**
 * Clamp a value to a [min, max] range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check whether a tile coordinate is walkable.
 *
 * Returns false for out-of-bounds coordinates.
 *
 * @param tileX - Tile X coordinate.
 * @param tileY - Tile Y coordinate.
 * @param walkable - Walkability grid (row-major [y][x]).
 * @param mapWidth - Map width in tiles.
 * @param mapHeight - Map height in tiles.
 */
function isTileWalkable(
  tileX: number,
  tileY: number,
  walkable: boolean[][],
  mapWidth: number,
  mapHeight: number
): boolean {
  if (tileX < 0 || tileX >= mapWidth || tileY < 0 || tileY >= mapHeight) {
    return false;
  }
  return walkable[tileY][tileX];
}

/**
 * Get the terrain speed modifier at a pixel position.
 *
 * Converts pixel coordinates to tile coordinates and looks up the
 * terrain type in the grid, then returns the speed modifier from
 * surface properties.
 *
 * @param x - Pixel X position.
 * @param y - Pixel Y position.
 * @param grid - Terrain grid (row-major [y][x]).
 * @param tileSize - Size of a tile in pixels.
 * @returns Speed modifier (1.0 = normal, 0.5 = half speed, etc.).
 */
export function getTerrainSpeedModifier(
  x: number,
  y: number,
  grid: Grid,
  tileSize: number
): number {
  const tileX = pixelToTile(x, tileSize);
  const tileY = pixelToTile(y, tileSize);
  const terrain = grid[tileY][tileX].terrain;
  return getSurfaceProperties(terrain).speedModifier;
}

/**
 * Calculate movement with axis-independent collision detection.
 *
 * The algorithm tries X and Y movement independently so that if one
 * axis is blocked by a wall the other can still move (wall-sliding).
 *
 * Steps:
 * 1. Clamp delta to MAX_DELTA_MS to prevent tunneling when the
 *    browser tab is backgrounded.
 * 2. Get terrain speed modifier at current position.
 * 3. Calculate desired displacement on each axis.
 * 4. Try X movement: if the destination tile is walkable, accept;
 *    otherwise block X and keep the current X position.
 * 5. Try Y movement (using the accepted X): if the destination tile
 *    is walkable, accept; otherwise block Y.
 * 6. Clamp the final position to map bounds.
 *
 * @param input - All parameters needed for the movement calculation.
 * @returns The new position and which axes were blocked.
 */
export function calculateMovement(input: MovementInput): MovementResult {
  const {
    position,
    direction,
    speed,
    walkable,
    grid,
    mapWidth,
    mapHeight,
    tileSize,
  } = input;

  // 1. Clamp delta to prevent tunneling
  const delta = Math.min(input.delta, MAX_DELTA_MS);

  // 2. Get terrain speed modifier at current feet position
  const speedMod = getTerrainSpeedModifier(
    position.x,
    position.y,
    grid,
    tileSize
  );

  // 3. Calculate desired displacement
  const deltaSeconds = delta / 1000;
  const dx = direction.x * speed * speedMod * deltaSeconds;
  const dy = direction.y * speed * speedMod * deltaSeconds;

  let newX = position.x;
  let newY = position.y;
  let blockedX = false;
  let blockedY = false;

  // 4. Try X movement independently
  if (dx !== 0) {
    const candidateX = position.x + dx;
    const feetTileX = pixelToTile(candidateX, tileSize);
    const feetTileY = pixelToTile(position.y, tileSize);
    if (isTileWalkable(feetTileX, feetTileY, walkable, mapWidth, mapHeight)) {
      newX = candidateX;
    } else {
      blockedX = true;
    }
  }

  // 5. Try Y movement independently (using accepted X)
  if (dy !== 0) {
    const candidateY = position.y + dy;
    const feetTileX = pixelToTile(newX, tileSize);
    const feetTileY = pixelToTile(candidateY, tileSize);
    if (isTileWalkable(feetTileX, feetTileY, walkable, mapWidth, mapHeight)) {
      newY = candidateY;
    } else {
      blockedY = true;
    }
  }

  // 6. Clamp to map bounds
  const maxX = mapWidth * tileSize - 1;
  const maxY = mapHeight * tileSize - 1;
  newX = clamp(newX, 0, maxX);
  newY = clamp(newY, 0, maxY);

  return { x: newX, y: newY, blocked: { x: blockedX, y: blockedY } };
}
