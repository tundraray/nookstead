import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction, CellPatchEntry } from '@nookstead/map-lib';
import { bresenhamLine, RoutingPaintCommand } from '@nookstead/map-lib';
import type { ToolHandlers } from '../map-editor-canvas';
import { getRetileEngine } from '../../../hooks/use-map-editor';

/** Default terrain that the eraser sets cells to. */
const DEFAULT_TERRAIN = 'deep_water';

/**
 * Creates eraser tool handlers.
 * Same interaction model as the brush (click and click-drag with Bresenham line)
 * but sets terrain to the default terrain ('deep_water') instead of the active terrain.
 */
export function createEraserTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>
): ToolHandlers {
  let isDrawing = false;
  let lastTile: { x: number; y: number } | null = null;
  const erasedCells = new Map<string, CellPatchEntry>();

  function tryErase(x: number, y: number): void {
    // Bounds check
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;

    const key = `${x},${y}`;
    if (erasedCells.has(key)) return;

    const oldFg = state.grid[y][x].terrain;
    if (oldFg === DEFAULT_TERRAIN) return;

    erasedCells.set(key, {
      x,
      y,
      oldFg,
      newFg: DEFAULT_TERRAIN,
    });
  }

  return {
    onMouseDown(tile: { x: number; y: number }) {
      isDrawing = true;
      erasedCells.clear();
      lastTile = tile;
      tryErase(tile.x, tile.y);
    },

    onMouseMove(tile: { x: number; y: number }) {
      if (!isDrawing || !lastTile) return;
      if (tile.x === lastTile.x && tile.y === lastTile.y) return;

      const points = bresenhamLine(
        lastTile.x,
        lastTile.y,
        tile.x,
        tile.y
      );
      for (const pt of points) {
        tryErase(pt.x, pt.y);
      }
      lastTile = tile;
    },

    onMouseUp() {
      if (!isDrawing) return;
      isDrawing = false;
      lastTile = null;

      if (erasedCells.size === 0) return;

      const engine = getRetileEngine();
      if (!engine) return;

      const command = new RoutingPaintCommand(
        Array.from(erasedCells.values()),
        engine
      );
      dispatch({ type: 'PUSH_COMMAND', command });
      erasedCells.clear();
    },
  };
}
