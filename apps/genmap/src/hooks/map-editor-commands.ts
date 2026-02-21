import type { FenceCellData } from '@nookstead/shared';
import type { FenceLayer, MapEditorState } from './map-editor-types';
import {
  recomputeAutotileLayers,
  recomputeWalkability,
} from './autotile-utils';

/**
 * A cell-level delta entry: stores position, layer, and before/after terrain + frame.
 */
export interface CellDelta {
  layerIndex: number;
  x: number;
  y: number;
  oldTerrain: string;
  newTerrain: string;
  oldFrame: number;
  newFrame: number;
}

/**
 * A reversible editor command that can be executed (do/redo) or undone.
 */
export interface EditorCommand {
  /** Human-readable description. */
  readonly description: string;
  /** Apply the command (do/redo). */
  execute(state: MapEditorState): MapEditorState;
  /** Reverse the command (undo). */
  undo(state: MapEditorState): MapEditorState;
}

/**
 * Apply a set of cell deltas to the state in the given direction.
 * Returns a new state with immutable updates (no direct mutation).
 *
 * After applying terrain changes, recomputes autotile frames for affected
 * cells and their 8 neighbors, and regenerates the walkability grid.
 */
export function applyDeltas(
  state: MapEditorState,
  deltas: CellDelta[],
  direction: 'forward' | 'backward'
): MapEditorState {
  // Create shallow copies for immutable update
  const newGrid = state.grid.map((row) => [...row]);
  const newLayers = state.layers.map((layer) => {
    // Only tile and fence layers have frames to clone
    if (layer.type === 'object') return { ...layer };
    return {
      ...layer,
      frames: layer.frames.map((row: number[]) => [...row]),
    };
  });

  for (const delta of deltas) {
    const terrain =
      direction === 'forward' ? delta.newTerrain : delta.oldTerrain;
    const frame = direction === 'forward' ? delta.newFrame : delta.oldFrame;

    // Update grid terrain
    newGrid[delta.y][delta.x] = {
      ...newGrid[delta.y][delta.x],
      terrain: terrain as MapEditorState['grid'][0][0]['terrain'],
    };

    // Update layer frames (only for layers with frames, i.e., tile and fence layers)
    if (
      delta.layerIndex >= 0 &&
      delta.layerIndex < newLayers.length
    ) {
      const targetLayer = newLayers[delta.layerIndex];
      if (targetLayer.type !== 'object') {
        targetLayer.frames[delta.y][delta.x] = frame;
      }
    }
  }

  // Collect affected cells for autotile recomputation
  const affectedCells = deltas.map((d) => ({ x: d.x, y: d.y }));

  // Recompute autotile frames for affected cells and their 8 neighbors
  const recomputedLayers = recomputeAutotileLayers(
    newGrid,
    newLayers,
    affectedCells
  );

  // Recompute walkability for the entire grid
  const newWalkable = recomputeWalkability(
    newGrid,
    state.width,
    state.height
  );

  return {
    ...state,
    grid: newGrid,
    layers: recomputedLayers,
    walkable: newWalkable,
  };
}

/**
 * Command: paint a set of cells to a new terrain.
 * Stores only the cells that changed (delta-based).
 */
export class PaintCommand implements EditorCommand {
  readonly description: string;

  constructor(private readonly deltas: CellDelta[], description?: string) {
    this.description =
      description ??
      `Paint ${deltas.length} cell(s) with ${deltas[0]?.newTerrain ?? 'unknown'}`;
  }

  execute(state: MapEditorState): MapEditorState {
    return applyDeltas(state, this.deltas, 'forward');
  }

  undo(state: MapEditorState): MapEditorState {
    return applyDeltas(state, this.deltas, 'backward');
  }
}

/**
 * Command: flood fill.
 * Same structure as PaintCommand; semantic distinction for description only.
 */
export class FillCommand implements EditorCommand {
  readonly description: string;

  constructor(private readonly deltas: CellDelta[], description?: string) {
    this.description =
      description ??
      `Fill ${deltas.length} cell(s) with ${deltas[0]?.newTerrain ?? 'unknown'}`;
  }

  execute(state: MapEditorState): MapEditorState {
    return applyDeltas(state, this.deltas, 'forward');
  }

  undo(state: MapEditorState): MapEditorState {
    return applyDeltas(state, this.deltas, 'backward');
  }
}

// ---------------------------------------------------------------------------
// Fence undo/redo commands (Design Doc Section 2.4)
// ---------------------------------------------------------------------------

/**
 * A fence cell-level delta entry: stores position, layer index, and
 * before/after cell data, frame index, and walkability.
 *
 * All three dimensions (cell, frame, walkability) are captured so that
 * undo can restore the exact prior state.
 */
export interface FenceCellDelta {
  layerIndex: number;
  x: number;
  y: number;
  oldCell: FenceCellData | null;
  newCell: FenceCellData | null;
  oldFrame: number;
  newFrame: number;
  oldWalkable: boolean;
  newWalkable: boolean;
}

/**
 * Apply a set of fence cell deltas to the state immutably.
 *
 * Unlike terrain's `applyDeltas`, this function does NOT trigger autotile
 * recomputation -- fence frame indices are pre-computed by the caller and
 * stored in the delta. This keeps commands deterministic regardless of
 * surrounding state.
 */
export function applyFenceDeltas(
  state: MapEditorState,
  deltas: FenceCellDelta[],
  direction: 'forward' | 'backward'
): MapEditorState {
  // Shallow-clone layers array, then deep-clone only affected fence layers
  const newLayers = state.layers.map((layer, idx) => {
    // Only clone fence layers that are referenced by a delta
    const needsClone =
      layer.type === 'fence' && deltas.some((d) => d.layerIndex === idx);
    if (!needsClone) return layer;
    const fenceLayer = layer as FenceLayer;
    return {
      ...fenceLayer,
      cells: fenceLayer.cells.map((row) => [...row]),
      frames: fenceLayer.frames.map((row) => [...row]),
    };
  });

  // Clone walkability grid
  const newWalkable = state.walkable.map((row) => [...row]);

  for (const delta of deltas) {
    const cell = direction === 'forward' ? delta.newCell : delta.oldCell;
    const frame = direction === 'forward' ? delta.newFrame : delta.oldFrame;
    const walkable =
      direction === 'forward' ? delta.newWalkable : delta.oldWalkable;

    const layer = newLayers[delta.layerIndex] as FenceLayer;
    layer.cells[delta.y][delta.x] = cell;
    layer.frames[delta.y][delta.x] = frame;
    newWalkable[delta.y][delta.x] = walkable;
  }

  return {
    ...state,
    layers: newLayers,
    walkable: newWalkable,
  };
}

/**
 * Command: place fence cells.
 *
 * Stores all affected cells (placed cells plus neighbor frame changes) in a
 * single delta array so that the entire multi-cell operation undoes atomically.
 */
export class FencePlaceCommand implements EditorCommand {
  readonly description: string;

  constructor(
    private readonly deltas: FenceCellDelta[],
    description?: string
  ) {
    this.description =
      description ?? `Place ${deltas.length} fence cell(s)`;
  }

  execute(state: MapEditorState): MapEditorState {
    return applyFenceDeltas(state, this.deltas, 'forward');
  }

  undo(state: MapEditorState): MapEditorState {
    return applyFenceDeltas(state, this.deltas, 'backward');
  }
}

/**
 * Command: erase fence cells.
 *
 * On execute, sets cells to null and frames to 0 (via pre-computed deltas).
 * The delta array also includes neighbor frame recalculations so that
 * surrounding fences update their connection frames.
 *
 * On undo, restores erased cells and their original frames, and re-applies
 * the neighbor frame values that existed before the erase.
 */
export class FenceEraseCommand implements EditorCommand {
  readonly description: string;

  constructor(
    private readonly deltas: FenceCellDelta[],
    description?: string
  ) {
    this.description =
      description ?? `Erase ${deltas.length} fence cell(s)`;
  }

  execute(state: MapEditorState): MapEditorState {
    return applyFenceDeltas(state, this.deltas, 'forward');
  }

  undo(state: MapEditorState): MapEditorState {
    return applyFenceDeltas(state, this.deltas, 'backward');
  }
}

/**
 * Command: toggle gate state on a single fence cell.
 *
 * Toggles between fence/gate or open/closed gate states. The single delta
 * captures the cell data change (isGate/gateOpen), frame change (fence vs
 * gate frame), and walkability change (closed gate = non-walkable, open = walkable).
 */
export class GateToggleCommand implements EditorCommand {
  readonly description: string;

  constructor(
    private readonly delta: FenceCellDelta,
    description?: string
  ) {
    this.description =
      description ?? `Toggle gate at (${delta.x}, ${delta.y})`;
  }

  execute(state: MapEditorState): MapEditorState {
    return applyFenceDeltas(state, [this.delta], 'forward');
  }

  undo(state: MapEditorState): MapEditorState {
    return applyFenceDeltas(state, [this.delta], 'backward');
  }
}
