import PF from 'pathfinding';
import { BOT_MAX_PATH_LENGTH } from '@nookstead/shared';

/**
 * A tile coordinate in the walkability grid.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Thin wrapper around the `pathfinding` npm library's AStarFinder.
 *
 * Holds an internal PF.Grid, clones it before every findPath call
 * (the library mutates grids during search), and converts raw
 * number[][] results into Point[].
 *
 * Zero dependency on Colyseus, BotManager, or any NPC state.
 */
export class Pathfinder {
  private grid: PF.Grid;
  private finder: PF.AStarFinder;
  private maxPathLength: number;

  /**
   * Create a Pathfinder from a walkability grid.
   * walkable[y][x] = true means the tile is passable.
   *
   * @param walkable - 2D boolean grid where true = passable tile
   * @param maxPathLength - Maximum number of waypoints returned by findPath.
   *   Defaults to BOT_MAX_PATH_LENGTH (100). Pass a larger value (e.g.
   *   PLAYER_MAX_PATH_LENGTH = 200) for client-side player pathfinding.
   */
  constructor(
    walkable: boolean[][],
    maxPathLength: number = BOT_MAX_PATH_LENGTH
  ) {
    this.grid = this.buildGrid(walkable);
    this.finder = new PF.AStarFinder({
      diagonalMovement: PF.DiagonalMovement.Never,
    });
    this.maxPathLength = maxPathLength;
  }

  /**
   * Compute an A* path from (startX, startY) to (endX, endY).
   *
   * Returns waypoints as Point[] excluding the start tile, including
   * the end tile. Returns an empty array if no path exists, start or
   * end is non-walkable, or any error occurs. Never throws.
   *
   * Truncates results to the configured maxPathLength waypoints.
   */
  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Point[] {
    try {
      // The library ignores walkability of start/end nodes, so guard manually
      if (!this.grid.isWalkableAt(startX, startY)) return [];
      if (!this.grid.isWalkableAt(endX, endY)) return [];

      const clone = this.grid.clone();
      const rawPath = this.finder.findPath(startX, startY, endX, endY, clone);

      // rawPath is number[][] where each element is [x, y].
      // First element is the start tile -- exclude it.
      const waypoints: Point[] = [];
      for (let i = 1; i < rawPath.length; i++) {
        waypoints.push({ x: rawPath[i][0], y: rawPath[i][1] });
      }

      // Safety cutoff
      if (waypoints.length > this.maxPathLength) {
        return waypoints.slice(0, this.maxPathLength);
      }

      return waypoints;
    } catch {
      return [];
    }
  }

  /**
   * Replace the entire internal grid with a new walkability array.
   */
  updateGrid(walkable: boolean[][]): void {
    this.grid = this.buildGrid(walkable);
  }

  /**
   * Update walkability of a single tile.
   */
  setWalkableAt(x: number, y: number, walkable: boolean): void {
    this.grid.setWalkableAt(x, y, walkable);
  }

  /**
   * Convert a boolean[][] walkability array into a PF.Grid.
   * The pathfinding library expects a number[][] matrix where
   * 0 = walkable and 1 = blocked (inverted from our boolean convention).
   */
  private buildGrid(walkable: boolean[][]): PF.Grid {
    const height = walkable.length;
    const width = height > 0 ? walkable[0].length : 0;
    const matrix: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(walkable[y][x] ? 0 : 1);
      }
      matrix.push(row);
    }
    return new PF.Grid(matrix);
  }
}
