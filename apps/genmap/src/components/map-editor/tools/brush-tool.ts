import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';
import type { CellDelta } from '@/hooks/map-editor-commands';
import { PaintCommand } from '@/hooks/map-editor-commands';
import type { ToolHandlers } from '../map-editor-canvas';

/**
 * Bresenham's line algorithm.
 * Returns an array of integer grid points from (x0,y0) to (x1,y1),
 * including both endpoints. No diagonal gaps.
 */
export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}

/**
 * Creates brush tool handlers.
 * Click to paint a single cell; drag to paint along a Bresenham line path.
 * Collects CellDelta entries and dispatches a PaintCommand on mouse up.
 */
export function createBrushTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>
): ToolHandlers {
  let isDrawing = false;
  let lastTile: { x: number; y: number } | null = null;
  const paintedCells = new Map<string, CellDelta>();

  function tryPaint(x: number, y: number): void {
    // Bounds check
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;

    const key = `${x},${y}`;
    if (paintedCells.has(key)) return;

    const oldTerrain = state.grid[y][x].terrain;
    if (oldTerrain === state.activeTerrainKey) return;

    const layerIndex = state.activeLayerIndex;
    const activeLayer =
      layerIndex >= 0 && layerIndex < state.layers.length
        ? state.layers[layerIndex]
        : null;
    const oldFrame =
      activeLayer && activeLayer.type === 'tile'
        ? activeLayer.frames[y][x]
        : 0;

    paintedCells.set(key, {
      layerIndex,
      x,
      y,
      oldTerrain,
      newTerrain: state.activeTerrainKey,
      oldFrame,
      newFrame: 0, // Will be recalculated by autotile (Task 17)
    });
  }

  return {
    onMouseDown(tile: { x: number; y: number }) {
      isDrawing = true;
      paintedCells.clear();
      lastTile = tile;
      tryPaint(tile.x, tile.y);
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
        tryPaint(pt.x, pt.y);
      }
      lastTile = tile;
    },

    onMouseUp() {
      if (!isDrawing) return;
      isDrawing = false;
      lastTile = null;

      if (paintedCells.size === 0) return;

      const command = new PaintCommand(Array.from(paintedCells.values()));
      dispatch({ type: 'PUSH_COMMAND', command });
      paintedCells.clear();
    },
  };
}
