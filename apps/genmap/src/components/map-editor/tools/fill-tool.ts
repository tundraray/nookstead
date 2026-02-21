import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@nookstead/map-lib';
import { floodFill, FillCommand } from '@nookstead/map-lib';
import type { ToolHandlers } from '../map-editor-canvas';

/**
 * Creates fill tool handlers.
 * Single-click performs a flood fill; no drag behavior.
 */
export function createFillTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>
): ToolHandlers {
  return {
    onMouseDown(tile: { x: number; y: number }) {
      const deltas = floodFill(
        state.grid,
        tile.x,
        tile.y,
        state.activeTerrainKey,
        state.width,
        state.height,
        state.activeLayerIndex,
        state.layers
      );

      if (deltas.length === 0) return;

      const command = new FillCommand(deltas);
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
