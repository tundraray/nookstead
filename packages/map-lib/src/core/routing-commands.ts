import type { CellPatchEntry, MapPatchEntry } from '../types/routing-types';
import type { MapEditorState, EditorCommand } from '../types/editor-types';
import type { RetileEngine } from './retile-engine';
import { recomputeWalkability } from './walkability';

// ---------------------------------------------------------------------------
// RoutingPaintCommand
// ---------------------------------------------------------------------------

/**
 * Reversible paint command for the routing-based autotile pipeline.
 *
 * Wraps a set of `CellPatchEntry` records (produced by
 * `RetileEngine.applyMapPatch`) and implements the `EditorCommand`
 * interface for undo/redo stack compatibility.
 *
 * `execute` replays the forward paint (newFg), `undo` replays the
 * backward paint (oldFg). Both recompute walkability after the
 * terrain change. Input state is NEVER mutated.
 */
export class RoutingPaintCommand implements EditorCommand {
  /** Human-readable description of the paint operation. */
  readonly description: string;

  /**
   * Create a new RoutingPaintCommand.
   *
   * @param patches - Cell-level before/after patch entries from RetileEngine.
   * @param engine - RetileEngine instance for recomputing autotile data.
   * @param activeLayerIndex - Layer to target when painting/undoing (captured at creation, default 0).
   */
  constructor(
    private readonly patches: ReadonlyArray<CellPatchEntry>,
    private readonly engine: RetileEngine,
    private readonly activeLayerIndex = 0,
  ) {
    const changedPatches = patches.filter(p => p.oldFg !== p.newFg);
    const count = changedPatches.length;
    const material = changedPatches[0]?.newFg ?? 'unknown';
    this.description = `Paint ${count} cell(s) with ${material}`;
  }

  /**
   * Apply the paint command (do/redo).
   *
   * Converts stored patches to forward MapPatchEntry (using newFg),
   * calls engine.applyMapPatch, and recomputes walkability.
   *
   * @param state - Current editor state (never mutated).
   * @returns New state with updated grid, layers, and walkable.
   */
  execute(state: MapEditorState): MapEditorState {
    const mapPatches: MapPatchEntry[] = this.patches
      .filter(p => p.oldFg !== p.newFg)
      .map(p => ({ x: p.x, y: p.y, fg: p.newFg }));

    if (mapPatches.length === 0) {
      return state;
    }

    const result = this.engine.applyMapPatch(state, mapPatches, this.activeLayerIndex);
    const newWalkable = recomputeWalkability(
      result.grid,
      state.width,
      state.height,
      state.materials,
    );

    return {
      ...state,
      grid: result.grid,
      layers: result.layers,
      walkable: newWalkable,
    };
  }

  /**
   * Reverse the paint command (undo).
   *
   * Converts stored patches to backward MapPatchEntry (using oldFg),
   * calls engine.applyMapPatch, and recomputes walkability.
   *
   * @param state - Current editor state (never mutated).
   * @returns New state with restored grid, layers, and walkable.
   */
  undo(state: MapEditorState): MapEditorState {
    const mapPatches: MapPatchEntry[] = this.patches
      .filter(p => p.oldFg !== p.newFg)
      .map(p => ({ x: p.x, y: p.y, fg: p.oldFg }));

    if (mapPatches.length === 0) {
      return state;
    }

    const result = this.engine.applyMapPatch(state, mapPatches, this.activeLayerIndex);
    const newWalkable = recomputeWalkability(
      result.grid,
      state.width,
      state.height,
      state.materials,
    );

    return {
      ...state,
      grid: result.grid,
      layers: result.layers,
      walkable: newWalkable,
    };
  }
}

// ---------------------------------------------------------------------------
// RoutingFillCommand
// ---------------------------------------------------------------------------

/**
 * Reversible fill command for the routing-based autotile pipeline.
 *
 * Identical structure to `RoutingPaintCommand` with a semantic
 * distinction in the description (e.g., "Fill N cell(s) with grass").
 *
 * Input state is NEVER mutated.
 */
export class RoutingFillCommand implements EditorCommand {
  /** Human-readable description of the fill operation. */
  readonly description: string;

  /**
   * Create a new RoutingFillCommand.
   *
   * @param patches - Cell-level before/after patch entries from RetileEngine.
   * @param engine - RetileEngine instance for recomputing autotile data.
   * @param activeLayerIndex - Layer to target when filling/undoing (captured at creation, default 0).
   */
  constructor(
    private readonly patches: ReadonlyArray<CellPatchEntry>,
    private readonly engine: RetileEngine,
    private readonly activeLayerIndex = 0,
  ) {
    const changedPatches = patches.filter(p => p.oldFg !== p.newFg);
    const count = changedPatches.length;
    const material = changedPatches[0]?.newFg ?? 'unknown';
    this.description = `Fill ${count} cell(s) with ${material}`;
  }

  /**
   * Apply the fill command (do/redo).
   *
   * @param state - Current editor state (never mutated).
   * @returns New state with updated grid, layers, and walkable.
   */
  execute(state: MapEditorState): MapEditorState {
    const mapPatches: MapPatchEntry[] = this.patches
      .filter(p => p.oldFg !== p.newFg)
      .map(p => ({ x: p.x, y: p.y, fg: p.newFg }));

    if (mapPatches.length === 0) {
      return state;
    }

    const result = this.engine.applyMapPatch(state, mapPatches, this.activeLayerIndex);
    const newWalkable = recomputeWalkability(
      result.grid,
      state.width,
      state.height,
      state.materials,
    );

    return {
      ...state,
      grid: result.grid,
      layers: result.layers,
      walkable: newWalkable,
    };
  }

  /**
   * Reverse the fill command (undo).
   *
   * @param state - Current editor state (never mutated).
   * @returns New state with restored grid, layers, and walkable.
   */
  undo(state: MapEditorState): MapEditorState {
    const mapPatches: MapPatchEntry[] = this.patches
      .filter(p => p.oldFg !== p.newFg)
      .map(p => ({ x: p.x, y: p.y, fg: p.oldFg }));

    if (mapPatches.length === 0) {
      return state;
    }

    const result = this.engine.applyMapPatch(state, mapPatches, this.activeLayerIndex);
    const newWalkable = recomputeWalkability(
      result.grid,
      state.width,
      state.height,
      state.materials,
    );

    return {
      ...state,
      grid: result.grid,
      layers: result.layers,
      walkable: newWalkable,
    };
  }
}
