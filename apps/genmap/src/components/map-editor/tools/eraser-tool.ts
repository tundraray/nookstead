import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';
import type { CellDelta } from '@/hooks/map-editor-commands';
import { PaintCommand } from '@/hooks/map-editor-commands';
import { bresenhamLine } from './brush-tool';
import type { ToolHandlers } from '../map-editor-canvas';

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
  const erasedCells = new Map<string, CellDelta>();

  function tryErase(x: number, y: number): void {
    // Bounds check
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;

    const key = `${x},${y}`;
    if (erasedCells.has(key)) return;

    const oldTerrain = state.grid[y][x].terrain;
    if (oldTerrain === DEFAULT_TERRAIN) return;

    const layerIndex = state.activeLayerIndex;
    const activeLayer =
      layerIndex >= 0 && layerIndex < state.layers.length
        ? state.layers[layerIndex]
        : null;
    const oldFrame =
      activeLayer && activeLayer.type !== 'object'
        ? activeLayer.frames[y][x]
        : 0;

    erasedCells.set(key, {
      layerIndex,
      x,
      y,
      oldTerrain,
      newTerrain: DEFAULT_TERRAIN,
      oldFrame,
      newFrame: 0,
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

      const command = new PaintCommand(
        Array.from(erasedCells.values()),
        'Erase'
      );
      dispatch({ type: 'PUSH_COMMAND', command });
      erasedCells.clear();
    },
  };
}
