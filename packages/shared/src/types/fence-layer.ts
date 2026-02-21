/**
 * Per-cell authoritative data for a fence cell.
 * Design Doc Section 4.1
 */
export interface FenceCellData {
  /** UUID referencing the fence_types table */
  fenceTypeId: string;
  /** True if this cell is a gate (can be toggled open/closed) */
  isGate: boolean;
  /** True if gate is currently open. Only meaningful when isGate is true. */
  gateOpen: boolean;
}

/**
 * Sparse gate position data for network serialization.
 * Design Doc Section 4.5
 */
export interface SerializedGateData {
  x: number;
  y: number;
  open: boolean;
}

/**
 * Serialized fence layer for MapDataPayload transmission.
 * Design Doc Section 4.5
 */
export interface SerializedFenceLayer {
  /** Display name (e.g., "Wooden Fence") */
  name: string;
  /** Programmatic fence type key (e.g., "wooden_fence") */
  fenceTypeKey: string;
  /** Precomputed frame indices [y][x]. 0 = empty, 1-20 = content frames. */
  frames: number[][];
  /** Sparse list of gate positions and their open/closed state */
  gates: SerializedGateData[];
}
