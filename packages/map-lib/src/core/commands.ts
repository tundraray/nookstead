import { recomputeAutotileLayers } from './autotile-layers';
import { recomputeWalkability } from './walkability';
import type {
  MapEditorState,
  CellDelta,
  EditorCommand,
} from '../types/editor-types';

/**
 * Apply a set of cell deltas to the state in the given direction.
 * 'forward' applies newTerrain/newFrame; 'backward' applies oldTerrain/oldFrame (undo).
 *
 * After applying terrain changes, recomputes autotile frames for affected
 * cells and their 8 neighbors, and regenerates the walkability grid.
 *
 * Returns a new state with immutable updates (no direct mutation).
 *
 * @param state - The current editor state.
 * @param deltas - Cell-level delta entries describing terrain changes.
 * @param direction - 'forward' for do/redo, 'backward' for undo.
 * @returns A new MapEditorState with updated grid, layers, and walkability.
 */
export function applyDeltas(
  state: MapEditorState,
  deltas: CellDelta[],
  direction: 'forward' | 'backward',
): MapEditorState {
  // Create shallow copies for immutable update
  const newGrid = state.grid.map((row: typeof state.grid[0]) => [...row]);
  const newLayers = state.layers.map((layer) => ({
    ...layer,
    frames: layer.frames.map((row: number[]) => [...row]),
    tilesetKeys: layer.tilesetKeys?.map((row: string[]) => [...row]),
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

  // Solid Block Rule: when painting forward, directly painted cells are forced
  // to SOLID_FRAME. On undo, frames are recomputed normally from the mask.
  const paintedCells = direction === 'forward'
    ? new Set(deltas.map((d) => `${d.x},${d.y}`))
    : undefined;

  // Recompute autotile frames for affected cells and their 8 neighbors
  const recomputedLayers = recomputeAutotileLayers(
    newGrid,
    newLayers,
    affectedCells,
    state.materials,
    paintedCells,
    state.tilesets,
  );

  // Recompute walkability for the entire grid
  const newWalkable = recomputeWalkability(
    newGrid,
    state.width,
    state.height,
    state.materials,
  );

  // --- Debug log: show what was drawn ---
  if (typeof console !== 'undefined') {
    const xs = deltas.map((d) => d.x);
    const ys = deltas.map((d) => d.y);
    const minX = Math.max(0, Math.min(...xs) - 1);
    const maxX = Math.min(state.width - 1, Math.max(...xs) + 1);
    const minY = Math.max(0, Math.min(...ys) - 1);
    const maxY = Math.min(state.height - 1, Math.max(...ys) + 1);

    const layer = recomputedLayers[state.activeLayerIndex ?? 0];
    const activeMat = deltas[0] ? (direction === 'forward' ? deltas[0].newTerrain : deltas[0].oldTerrain) : '?';
    const header = `[paint ${direction}] material="${activeMat}" ${deltas.length} cell(s), area [${minX},${minY}]-[${maxX},${maxY}]`;

    const rows: string[] = [];
    for (let y = minY; y <= maxY; y++) {
      const cells: string[] = [];
      for (let x = minX; x <= maxX; x++) {
        const terrain = newGrid[y][x].terrain ?? '';
        const mat = terrain.slice(0, 6).padEnd(6);
        const frm = String(layer?.frames[y]?.[x] ?? '?').padStart(2);
        const pairTs = layer?.tilesetKeys?.[y]?.[x] || '';
        const baseTs = state.materials.get(terrain)?.baseTilesetKey ?? '';
        const tsLabel = pairTs ? `pair:${pairTs}` : `base:${baseTs || '-'}`;
        const isPainted = deltas.some((d) => d.x === x && d.y === y);
        const marker = isPainted ? '*' : ' ';
        cells.push(`${marker}${mat} f${frm} ${tsLabel.padEnd(16)}`);
      }
      rows.push(`  y${String(y).padStart(2)}: ${cells.join(' | ')}`);
    }

    console.log(`\n${header}\n${rows.join('\n')}\n`);
  }

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
  /** Human-readable description of the paint operation. */
  readonly description: string;

  constructor(
    private readonly deltas: CellDelta[],
    description?: string,
  ) {
    this.description =
      description ??
      `Paint ${deltas.length} cell(s) with ${deltas[0]?.newTerrain ?? 'unknown'}`;
  }

  /** Apply the paint command (do/redo). */
  execute(state: MapEditorState): MapEditorState {
    return applyDeltas(state, this.deltas, 'forward');
  }

  /** Reverse the paint command (undo). */
  undo(state: MapEditorState): MapEditorState {
    return applyDeltas(state, this.deltas, 'backward');
  }
}

/**
 * Command: flood fill.
 * Same structure as PaintCommand; semantic distinction for description only.
 */
export class FillCommand implements EditorCommand {
  /** Human-readable description of the fill operation. */
  readonly description: string;

  constructor(
    private readonly deltas: CellDelta[],
    description?: string,
  ) {
    this.description =
      description ??
      `Fill ${deltas.length} cell(s) with ${deltas[0]?.newTerrain ?? 'unknown'}`;
  }

  /** Apply the fill command (do/redo). */
  execute(state: MapEditorState): MapEditorState {
    return applyDeltas(state, this.deltas, 'forward');
  }

  /** Reverse the fill command (undo). */
  undo(state: MapEditorState): MapEditorState {
    return applyDeltas(state, this.deltas, 'backward');
  }
}
