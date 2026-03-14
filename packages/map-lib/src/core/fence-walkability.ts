/**
 * Walkability grid computation for fence layers.
 *
 * Composites terrain walkability with fence state to determine whether
 * each cell is passable for players and NPCs. Handles multiple fence
 * layers and gate states correctly.
 *
 * Composite formula (Design Doc Section 5.1):
 *   walkable[y][x] = terrainWalkable[y][x] AND NOT blockedByFence
 *
 * A cell is "blocked by fence" if ANY fence layer has a non-null cell
 * that is NOT an open gate.
 *
 * This module has ZERO imports from other map-lib modules (pure functions only).
 */

import type { FenceCellData } from '@nookstead/shared';

/**
 * A snapshot of a fence layer's cell grid for walkability computation.
 * Each cell is either a FenceCellData (fence/gate present) or null (empty).
 */
export interface FenceLayerSnapshot {
  cells: (FenceCellData | null)[][];
}

/**
 * Compute walkability for a single cell by compositing terrain walkability
 * with all fence layers.
 *
 * Formula: walkable = terrainWalkable AND NOT blockedByAnyFenceLayer
 *
 * A fence layer blocks a cell if it has a non-null cell that is NOT an open gate.
 */
function computeCellWalkability(
  terrainIsWalkable: boolean,
  fenceLayers: FenceLayerSnapshot[],
  x: number,
  y: number,
): boolean {
  if (!terrainIsWalkable) return false;

  for (const layer of fenceLayers) {
    const cell = layer.cells[y]?.[x];
    if (cell === null || cell === undefined) continue;
    // Open gate does not block movement
    if (cell.isGate && cell.gateOpen) continue;
    // Fence segment or closed gate blocks movement
    return false;
  }

  return true;
}

/**
 * Full recomputation of the walkability grid.
 *
 * Iterates every cell and composites terrain walkability with fence state
 * across all fence layers. Returns a NEW 2D array; does not mutate
 * the terrainWalkable input.
 *
 * @param terrainWalkable - Pre-computed terrain walkability grid (boolean[][])
 * @param fenceLayers - All fence layers to consider
 * @param mapWidth - Map width in cells
 * @param mapHeight - Map height in cells
 * @returns A new boolean[][] representing composite walkability
 *
 * @see Design Doc Section 5.2
 */
export function computeFenceWalkability(
  terrainWalkable: boolean[][],
  fenceLayers: FenceLayerSnapshot[],
  mapWidth: number,
  mapHeight: number,
): boolean[][] {
  const walkable: boolean[][] = [];

  for (let y = 0; y < mapHeight; y++) {
    walkable[y] = [];
    for (let x = 0; x < mapWidth; x++) {
      walkable[y][x] = computeCellWalkability(
        terrainWalkable[y][x],
        fenceLayers,
        x,
        y,
      );
    }
  }

  return walkable;
}

/**
 * Incremental update of a single cell's walkability.
 *
 * Mutates walkable[y][x] in place. Must check ALL fence layers (not just
 * the one that changed) to produce identical results to full recomputation.
 *
 * @param walkable - The walkability grid to mutate
 * @param terrainWalkable - Pre-computed terrain walkability grid
 * @param fenceLayers - All fence layers to consider
 * @param x - Cell x coordinate
 * @param y - Cell y coordinate
 *
 * @see Design Doc Section 5.3
 */
export function updateCellWalkability(
  walkable: boolean[][],
  terrainWalkable: boolean[][],
  fenceLayers: FenceLayerSnapshot[],
  x: number,
  y: number,
): void {
  walkable[y][x] = computeCellWalkability(
    terrainWalkable[y][x],
    fenceLayers,
    x,
    y,
  );
}
