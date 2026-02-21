import type { MapEditorState } from './map-editor-types';
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
  const newLayers = state.layers.map((layer) => ({
    ...layer,
    frames: layer.frames.map((row) => [...row]),
  }));

  for (const delta of deltas) {
    const terrain =
      direction === 'forward' ? delta.newTerrain : delta.oldTerrain;
    const frame = direction === 'forward' ? delta.newFrame : delta.oldFrame;

    // Update grid terrain
    newGrid[delta.y][delta.x] = {
      ...newGrid[delta.y][delta.x],
      terrain: terrain as MapEditorState['grid'][0][0]['terrain'],
    };

    // Update layer frames
    if (
      delta.layerIndex >= 0 &&
      delta.layerIndex < newLayers.length
    ) {
      newLayers[delta.layerIndex].frames[delta.y][delta.x] = frame;
    }
  }

  // Collect affected cells for autotile recomputation
  const affectedCells = deltas.map((d) => ({ x: d.x, y: d.y }));

  // Recompute autotile frames for affected cells and their 8 neighbors
  const recomputedLayers = recomputeAutotileLayers(
    newGrid,
    newLayers,
    affectedCells,
    state.tilesets
  );

  // Recompute walkability for the entire grid
  const newWalkable = recomputeWalkability(
    newGrid,
    state.width,
    state.height,
    state.materials
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
