/**
 * Spawn system — finds the best walkable grass tile nearest to map center.
 *
 * Uses an expanding concentric square search starting from the center of the
 * map. Prefers grass tiles; falls back to any walkable tile if no grass is
 * found. Throws if the map contains no walkable tiles at all.
 *
 * Pure function with no Phaser dependency.
 */

import type { Grid } from '../types/map.js';

/** Coordinate of a spawn tile in tile-space. */
export interface SpawnTile {
  tileX: number;
  tileY: number;
}

/**
 * Checks whether a tile is a valid spawn point (walkable grass within bounds).
 *
 * Uses row-major [y][x] indexing for both `walkable` and `grid`.
 *
 * @param x - Tile x coordinate.
 * @param y - Tile y coordinate.
 * @param walkable - 2D walkability grid (row-major [y][x]).
 * @param grid - 2D generation grid (row-major [y][x]).
 * @returns `true` if the tile is in bounds, walkable, and grass.
 */
export function isValidSpawn(
  x: number,
  y: number,
  walkable: boolean[][],
  grid: Grid
): boolean {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) {
    return false;
  }
  return walkable[y][x] && grid[y][x].terrain === 'grass';
}

/**
 * Searches concentric squares around the center for a valid grass spawn tile.
 *
 * @returns The first valid grass tile found, or `null` if none exists within
 *          the given radius range.
 */
function searchConcentricSquares(
  centerX: number,
  centerY: number,
  maxRadius: number,
  walkable: boolean[][],
  grid: Grid
): SpawnTile | null {
  for (let radius = 1; radius <= maxRadius; radius++) {
    // Top and bottom edges (full width including corners)
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      // Top edge
      if (isValidSpawn(x, centerY - radius, walkable, grid)) {
        return { tileX: x, tileY: centerY - radius };
      }
      // Bottom edge
      if (isValidSpawn(x, centerY + radius, walkable, grid)) {
        return { tileX: x, tileY: centerY + radius };
      }
    }

    // Left and right edges (excluding corners, already checked above)
    for (let y = centerY - radius + 1; y <= centerY + radius - 1; y++) {
      // Left edge
      if (isValidSpawn(centerX - radius, y, walkable, grid)) {
        return { tileX: centerX - radius, tileY: y };
      }
      // Right edge
      if (isValidSpawn(centerX + radius, y, walkable, grid)) {
        return { tileX: centerX + radius, tileY: y };
      }
    }
  }

  return null;
}

/**
 * Scans the entire map for any walkable tile (regardless of terrain type).
 *
 * Used as a last-resort fallback when no grass tile is reachable.
 */
function findAnyWalkableTile(
  walkable: boolean[][],
  mapWidth: number,
  mapHeight: number
): SpawnTile | null {
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      if (walkable[y][x]) {
        return { tileX: x, tileY: y };
      }
    }
  }
  return null;
}

/**
 * Finds the best spawn tile on the map.
 *
 * Algorithm:
 * 1. Check the map center first — if it is walkable grass, return immediately.
 * 2. Search expanding concentric squares (radius 1..max) for the nearest grass
 *    tile.
 * 3. Fallback: scan the entire map for any walkable tile (not necessarily grass).
 * 4. If no walkable tile exists at all, throw an `Error`.
 *
 * @param walkable  - 2D walkability grid (row-major [y][x]).
 * @param grid      - 2D generation grid (row-major [y][x]).
 * @param mapWidth  - Width of the map in tiles.
 * @param mapHeight - Height of the map in tiles.
 * @returns The chosen spawn tile coordinates.
 * @throws {Error} If no walkable tile exists on the map.
 */
export function findSpawnTile(
  walkable: boolean[][],
  grid: Grid,
  mapWidth: number,
  mapHeight: number
): SpawnTile {
  const centerX = Math.floor(mapWidth / 2);
  const centerY = Math.floor(mapHeight / 2);

  // 1. Check center tile
  if (isValidSpawn(centerX, centerY, walkable, grid)) {
    return { tileX: centerX, tileY: centerY };
  }

  // 2. Expanding concentric square search for grass
  const maxRadius = Math.max(mapWidth, mapHeight);
  const grassTile = searchConcentricSquares(
    centerX,
    centerY,
    maxRadius,
    walkable,
    grid
  );
  if (grassTile) {
    return grassTile;
  }

  // 3. Fallback: any walkable tile
  const anyTile = findAnyWalkableTile(walkable, mapWidth, mapHeight);
  if (anyTile) {
    return anyTile;
  }

  // 4. No walkable tile exists
  throw new Error('No walkable tile found');
}
