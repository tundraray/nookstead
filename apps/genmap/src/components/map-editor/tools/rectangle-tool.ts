import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';
import type { CellDelta } from '@/hooks/map-editor-commands';
import { PaintCommand } from '@/hooks/map-editor-commands';
import type { PreviewRect } from '../canvas-renderer';
import type { ToolHandlers } from '../map-editor-canvas';

/**
 * Creates rectangle fill tool handlers.
 * Click to set start corner, drag to show preview rectangle overlay,
 * release to fill all cells in the rectangle with the active terrain.
 */
export function createRectangleTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>,
  setPreviewRect: (rect: PreviewRect | null) => void
): ToolHandlers {
  let isDrawing = false;
  let startTile: { x: number; y: number } | null = null;

  function computeBounds(
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) {
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x, b.x);
    const maxY = Math.max(a.y, b.y);
    return { minX, minY, maxX, maxY };
  }

  return {
    onMouseDown(tile: { x: number; y: number }) {
      isDrawing = true;
      startTile = tile;
      setPreviewRect({ x: tile.x, y: tile.y, width: 1, height: 1 });
    },

    onMouseMove(tile: { x: number; y: number }) {
      if (!isDrawing || !startTile) return;
      const { minX, minY, maxX, maxY } = computeBounds(startTile, tile);
      setPreviewRect({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    },

    onMouseUp(tile: { x: number; y: number }) {
      if (!isDrawing || !startTile) return;
      isDrawing = false;
      setPreviewRect(null);

      const { minX, minY, maxX, maxY } = computeBounds(startTile, tile);
      const layerIndex = state.activeLayerIndex;
      const deltas: CellDelta[] = [];

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          // Bounds check
          if (x < 0 || x >= state.width || y < 0 || y >= state.height)
            continue;

          const oldTerrain = state.grid[y][x].terrain;
          if (oldTerrain === state.activeTerrainKey) continue;

          const activeLayer =
            layerIndex >= 0 && layerIndex < state.layers.length
              ? state.layers[layerIndex]
              : null;
          const oldFrame =
            activeLayer && activeLayer.type === 'tile'
              ? activeLayer.frames[y][x]
              : 0;

          deltas.push({
            layerIndex,
            x,
            y,
            oldTerrain,
            newTerrain: state.activeTerrainKey,
            oldFrame,
            newFrame: 0,
          });
        }
      }

      if (deltas.length === 0) return;

      const command = new PaintCommand(deltas, 'Rectangle fill');
      dispatch({ type: 'PUSH_COMMAND', command });

      startTile = null;
    },
  };
}
