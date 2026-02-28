import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction, CellPatchEntry, BrushShape } from '@nookstead/map-lib';
import { bresenhamLine, stampCells, RoutingPaintCommand } from '@nookstead/map-lib';
import type { ToolHandlers } from '../map-editor-canvas';
import { getRetileEngine } from '../../../hooks/use-map-editor';

/**
 * Creates brush tool handlers.
 * Click to paint cells within the brush stamp; drag to paint along a Bresenham
 * line path with stamp expansion at each point.
 * Collects CellPatchEntry entries and dispatches a RoutingPaintCommand on mouse up.
 */
export function createBrushTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>,
  brushSize: number,
  brushShape: BrushShape,
): ToolHandlers {
  let isDrawing = false;
  let lastTile: { x: number; y: number } | null = null;
  const paintedCells = new Map<string, CellPatchEntry>();

  function tryPaint(x: number, y: number): void {
    // Bounds check
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;

    const key = `${x},${y}`;
    if (paintedCells.has(key)) return;

    const oldFg = state.grid[y][x].terrain;
    if (oldFg === state.activeMaterialKey) return;

    paintedCells.set(key, {
      x,
      y,
      oldFg,
      newFg: state.activeMaterialKey,
    });
  }

  function paintStamp(cx: number, cy: number): void {
    const cells = stampCells(cx, cy, brushSize, brushShape, state.width, state.height);
    for (const cell of cells) {
      tryPaint(cell.x, cell.y);
    }
  }

  return {
    onMouseDown(tile: { x: number; y: number }) {
      isDrawing = true;
      paintedCells.clear();
      lastTile = tile;
      paintStamp(tile.x, tile.y);
    },

    onMouseMove(tile: { x: number; y: number }) {
      if (!isDrawing || !lastTile) return;
      if (tile.x === lastTile.x && tile.y === lastTile.y) return;

      // Use Bresenham's line to fill gaps during fast drags
      const points = bresenhamLine(
        lastTile.x,
        lastTile.y,
        tile.x,
        tile.y
      );
      for (const pt of points) {
        paintStamp(pt.x, pt.y);
      }
      lastTile = tile;
    },

    onMouseUp() {
      if (!isDrawing) return;
      isDrawing = false;
      lastTile = null;

      if (paintedCells.size === 0) return;

      const engine = getRetileEngine();
      if (!engine) return;

      const command = new RoutingPaintCommand(
        Array.from(paintedCells.values()),
        engine,
        state.activeLayerIndex,
      );
      dispatch({ type: 'PUSH_COMMAND', command });
      paintedCells.clear();
    },
  };
}
