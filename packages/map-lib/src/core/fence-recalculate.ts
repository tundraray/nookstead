/**
 * Batch bitmask recalculation for fence layers.
 *
 * Given a set of changed positions, computes the affected set (changed cells
 * plus their non-empty cardinal neighbors) and recalculates frame indices
 * for every affected cell.
 *
 * This is the central recalculation algorithm used by all fence modification
 * operations in the editor (placement, removal, gate toggle).
 *
 * This function mutates `layer.frames[][]` in place. It also mutates
 * `layer.cells[][]` when a gate becomes invalid due to neighbor changes
 * (setting `isGate = false` and `gateOpen = false`).
 *
 * Performance: O(N) for N changed cells. Each changed cell contributes at
 * most 5 entries to the affected set (itself + 4 neighbors), so the total
 * work is bounded by 5N.
 *
 * @see Design Doc Section 2.3
 */

import {
  computeFenceBitmask,
  getFenceFrame,
  getGateFrameIndex,
  FENCE_EMPTY_FRAME,
} from './fence-autotile';

// --- Types ---

/** A fence cell exposing gate state for recalculation. */
export interface RecalculateCell {
  isGate: boolean;
  gateOpen: boolean;
}

/** A fence layer with mutable cells and frames grids. */
export interface RecalculateLayer {
  cells: (RecalculateCell | null)[][];
  frames: number[][];
}

/** A 2D position on the map grid. */
export interface Position {
  x: number;
  y: number;
}

// --- Core function ---

/**
 * Recalculate frame indices for all cells affected by a set of changes.
 *
 * Algorithm (Design Doc Section 2.3):
 * 1. Build affected set: all changed cells + their non-empty cardinal
 *    neighbors, deduplicated via Map.
 * 2. For each affected cell:
 *    - If null, set frame to FENCE_EMPTY_FRAME.
 *    - Else compute bitmask via computeFenceBitmask.
 *    - Gate invalidation: if cell.isGate AND bitmask is not 5 (NS) and
 *      not 10 (EW), revert the gate (cell.isGate = false, cell.gateOpen = false).
 *    - If cell.isGate, frame = getGateFrameIndex(bitmask, cell.gateOpen).
 *    - Else frame = getFenceFrame(bitmask).
 *
 * @param layer - The fence layer to update (mutated in place)
 * @param changedPositions - Positions where fence cells were added, removed, or modified
 * @param mapWidth - Total number of columns in the grid
 * @param mapHeight - Total number of rows in the grid
 */
export function recalculateAffectedCells(
  layer: RecalculateLayer,
  changedPositions: Position[],
  mapWidth: number,
  mapHeight: number
): void {
  // Step 1: Build affected set (changed cells + non-empty cardinal neighbors)
  const affectedKey = (x: number, y: number) => `${x},${y}`;
  const affectedMap = new Map<string, Position>();

  for (const { x: cx, y: cy } of changedPositions) {
    affectedMap.set(affectedKey(cx, cy), { x: cx, y: cy });

    const neighbors: Position[] = [
      { x: cx, y: cy - 1 }, // North
      { x: cx + 1, y: cy }, // East
      { x: cx, y: cy + 1 }, // South
      { x: cx - 1, y: cy }, // West
    ];

    for (const { x: nx, y: ny } of neighbors) {
      if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
        if (layer.cells[ny][nx] !== null) {
          affectedMap.set(affectedKey(nx, ny), { x: nx, y: ny });
        }
      }
    }
  }

  // Step 2: Recalculate frame for each affected cell
  for (const { x: ax, y: ay } of affectedMap.values()) {
    const cell = layer.cells[ay][ax];

    if (cell === null) {
      layer.frames[ay][ax] = FENCE_EMPTY_FRAME;
      continue;
    }

    const bitmask = computeFenceBitmask(layer.cells, ax, ay, mapWidth, mapHeight);

    // Gate invalidation: if gate's bitmask is no longer a valid corridor, revert to fence
    if (cell.isGate && bitmask !== 5 && bitmask !== 10) {
      cell.isGate = false;
      cell.gateOpen = false;
    }

    if (cell.isGate) {
      layer.frames[ay][ax] = getGateFrameIndex(bitmask, cell.gateOpen);
    } else {
      layer.frames[ay][ax] = getFenceFrame(bitmask);
    }
  }
}
