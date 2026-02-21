/**
 * 4-cardinal fence connection engine.
 *
 * Computes visual state for fence cells based on cardinal neighbors (N/E/S/W).
 * Uses a 4-bit bitmask encoding (N=1, E=2, S=4, W=8) producing 16 base states
 * plus 4 gate states for a total of 20 frames per fence tileset.
 *
 * Frame 0 is the empty sentinel (no fence). Frames 1-16 are the 16 autotile
 * variants indexed by bitmask + 1. Frames 17-20 are gate variants.
 *
 * This module has ZERO imports from other map-lib modules (pure functions only).
 * The fence encoding (N=1, E=2, S=4, W=8) is intentionally different from the
 * terrain blob-47 encoding (N=1, E=4, S=16, W=64).
 */

// --- Cardinal direction flags (4-bit, clockwise from N) ---

/** North neighbor flag. */
export const FENCE_N = 1;

/** East neighbor flag. */
export const FENCE_E = 2;

/** South neighbor flag. */
export const FENCE_S = 4;

/** West neighbor flag. */
export const FENCE_W = 8;

// --- Frame constants ---

/** Empty sentinel frame (no fence in cell). */
export const FENCE_EMPTY_FRAME = 0;

/** Number of columns in a fence tileset spritesheet. */
export const FENCE_TILESET_COLS = 4;

/** Number of base fence frames (16 autotile variants). */
export const FENCE_FRAME_COUNT = 16;

/** Number of gate frames (2 orientations x 2 states). */
export const FENCE_GATE_FRAME_COUNT = 4;

/** Total frames per fence tileset (16 base + 4 gate). */
export const FENCE_TOTAL_FRAMES = 20;

// --- Gate bitmask constants ---

/** North-south corridor bitmask (N|S = 1|4 = 5). Valid for vertical gates. */
export const GATE_BITMASK_NS = 5;

/** East-west corridor bitmask (E|W = 2|8 = 10). Valid for horizontal gates. */
export const GATE_BITMASK_EW = 10;

// --- Types ---

/** A fence cell must expose gate state. */
export interface FenceCellLike {
  isGate: boolean;
  gateOpen: boolean;
}

/** 2D grid of fence cells. null means no fence at that position. */
export type FenceCells = (FenceCellLike | null)[][];

// --- Functions ---

/**
 * Compute the 4-bit cardinal neighbor bitmask for the fence cell at (x, y).
 *
 * Scans the four cardinal neighbors (N, E, S, W) and sets the corresponding
 * bit when a non-null fence cell is present. Returns 0 if the cell itself
 * is null.
 *
 * @param cells - 2D grid of fence cells (row-major: cells[y][x])
 * @param x - Column index of the target cell
 * @param y - Row index of the target cell
 * @param mapWidth - Total number of columns in the grid
 * @param mapHeight - Total number of rows in the grid
 * @returns Bitmask in range 0-15
 *
 * @see Design Doc Section 1.3
 */
export function computeFenceBitmask(
  cells: FenceCells,
  x: number,
  y: number,
  mapWidth: number,
  mapHeight: number
): number {
  if (cells[y][x] === null) return 0;

  let mask = 0;
  if (y > 0 && cells[y - 1][x] !== null) mask |= FENCE_N;
  if (x < mapWidth - 1 && cells[y][x + 1] !== null) mask |= FENCE_E;
  if (y < mapHeight - 1 && cells[y + 1][x] !== null) mask |= FENCE_S;
  if (x > 0 && cells[y][x - 1] !== null) mask |= FENCE_W;

  return mask;
}

/**
 * Convert a neighbor bitmask (0-15) to a 1-based frame index (1-16).
 *
 * Frame 0 is reserved as the empty sentinel, so the mapping is simply
 * `frameIndex = neighbors + 1`.
 *
 * @param neighbors - Bitmask from computeFenceBitmask (0-15)
 * @returns Frame index in range 1-16
 *
 * @see Design Doc Section 1.4
 */
export function getFenceFrame(neighbors: number): number {
  return neighbors + 1;
}

/**
 * Check whether a gate can be placed at position (x, y).
 *
 * A gate is only valid in a straight corridor (exactly two opposite neighbors).
 * Returns false if the cell is null, already a gate, or has any bitmask other
 * than NS (5) or EW (10).
 *
 * @param cells - 2D grid of fence cells (row-major: cells[y][x])
 * @param x - Column index of the target cell
 * @param y - Row index of the target cell
 * @param mapWidth - Total number of columns in the grid
 * @param mapHeight - Total number of rows in the grid
 * @returns true if a gate can be placed at this position
 *
 * @see Design Doc Section 3.2
 */
export function canPlaceGate(
  cells: FenceCells,
  x: number,
  y: number,
  mapWidth: number,
  mapHeight: number
): boolean {
  const cell = cells[y][x];
  if (cell === null) return false;
  if (cell.isGate) return false;

  const bitmask = computeFenceBitmask(cells, x, y, mapWidth, mapHeight);
  return bitmask === GATE_BITMASK_NS || bitmask === GATE_BITMASK_EW;
}

/**
 * Check whether a bitmask value represents a valid gate position.
 *
 * A gate is only valid in a straight corridor -- either north-south (bitmask 5)
 * or east-west (bitmask 10). All other bitmask values are invalid for gates.
 *
 * Used during batch bitmask recalculation to detect gates that have become
 * invalid due to neighbor changes and need to be auto-reverted to regular
 * fence cells.
 *
 * @param bitmask - 4-bit cardinal neighbor bitmask (0-15)
 * @returns true if the bitmask represents a valid gate corridor
 *
 * @see Design Doc Section 3.2
 */
export function isValidGateBitmask(bitmask: number): boolean {
  return bitmask === GATE_BITMASK_NS || bitmask === GATE_BITMASK_EW;
}

/**
 * Apply gate placement to a fence cell, returning a new cell with gate state.
 *
 * Sets `isGate` to true and `gateOpen` to false (gates always start closed).
 * The caller is responsible for validating that the cell is in a corridor
 * position (bitmask 5 or 10) before calling this function.
 *
 * This is a pure function -- the input cell is not mutated.
 *
 * @param cell - The fence cell to convert to a gate
 * @returns A new cell with `isGate: true, gateOpen: false`
 *
 * @see Design Doc Section 3.3
 */
export function applyGatePlacement(cell: FenceCellLike): FenceCellLike {
  return { ...cell, isGate: true, gateOpen: false };
}

/**
 * Remove gate status from a fence cell, reverting it to a regular fence.
 *
 * Sets both `isGate` and `gateOpen` to false. The caller should then use
 * `getFenceFrame(bitmask)` to determine the correct visual frame for the
 * reverted fence cell.
 *
 * This is a pure function -- the input cell is not mutated.
 *
 * @param cell - The gate cell to revert to a regular fence
 * @returns A new cell with `isGate: false, gateOpen: false`
 *
 * @see Design Doc Section 3.5
 */
export function applyGateRemoval(cell: FenceCellLike): FenceCellLike {
  return { ...cell, isGate: false, gateOpen: false };
}

/**
 * Toggle the open/closed state of a gate cell.
 *
 * Flips `gateOpen` between true and false. If the cell is not a gate
 * (`isGate === false`), this is a no-op and returns the same object reference.
 *
 * State machine transitions (Design Doc Section 3.3):
 *   CLOSED -> OPEN on player interaction
 *   OPEN -> CLOSED on player interaction
 *
 * This is a pure function -- the input cell is not mutated when toggling.
 *
 * @param cell - The gate cell to toggle
 * @returns A new cell with flipped `gateOpen`, or the same cell if not a gate
 *
 * @see Design Doc Section 3.3
 */
export function applyGateToggle(cell: FenceCellLike): FenceCellLike {
  if (!cell.isGate) return cell;
  return { ...cell, gateOpen: !cell.gateOpen };
}

/**
 * Get the 1-based frame index for a gate given its orientation and open state.
 *
 * Gate frames are laid out after the 16 base frames:
 *   - Frame 17: vertical (NS) closed
 *   - Frame 18: vertical (NS) open
 *   - Frame 19: horizontal (EW) closed
 *   - Frame 20: horizontal (EW) open
 *
 * @param bitmask - Must be GATE_BITMASK_NS (5) or GATE_BITMASK_EW (10)
 * @param isOpen - Whether the gate is in the open state
 * @returns Frame index in range 17-20
 *
 * @see Design Doc Section 3.4
 */
export function getGateFrameIndex(bitmask: number, isOpen: boolean): number {
  if (bitmask === GATE_BITMASK_NS) {
    return isOpen ? 18 : 17;
  }
  // GATE_BITMASK_EW
  return isOpen ? 20 : 19;
}
