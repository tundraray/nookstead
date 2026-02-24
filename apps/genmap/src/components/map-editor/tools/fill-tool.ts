import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction, CellPatchEntry } from '@nookstead/map-lib';
import { floodFill, RoutingFillCommand } from '@nookstead/map-lib';
import type { ToolHandlers } from '../map-editor-canvas';
import { getRetileEngine } from '../../../hooks/use-map-editor';

/**
 * Creates fill tool handlers.
 * Single-click performs a flood fill; no drag behavior.
 * Converts CellDelta results from floodFill into CellPatchEntry format
 * for RoutingFillCommand.
 */
export function createFillTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>
): ToolHandlers {
  return {
    onMouseDown(tile: { x: number; y: number }) {
      if (!state.materials.has(state.activeMaterialKey)) return;

      const deltas = floodFill(
        state.grid,
        tile.x,
        tile.y,
        state.activeMaterialKey,
        state.width,
        state.height,
        state.activeLayerIndex,
        state.layers
      );

      if (deltas.length === 0) return;

      const engine = getRetileEngine();
      if (!engine) return;

      // Convert CellDelta[] to CellPatchEntry[]
      const patches: CellPatchEntry[] = deltas.map((d) => ({
        x: d.x,
        y: d.y,
        oldFg: d.oldTerrain,
        newFg: d.newTerrain,
      }));

      const command = new RoutingFillCommand(patches, engine);
      dispatch({ type: 'PUSH_COMMAND', command });
    },

    onMouseMove() {
      // No-op: fill is single-click, no drag behavior
    },

    onMouseUp() {
      // No-op
    },
  };
}
