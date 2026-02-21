import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';
import type { ToolHandlers } from '../map-editor-canvas';
import { bresenhamLine } from './brush-tool';

/**
 * Creates fence eraser tool handlers.
 *
 * Click or drag to erase fence cells from the active fence layer.
 * On removal, the reducer recalculates neighbor frames and walkability.
 */
export function createFenceEraserTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>
): ToolHandlers {
  let isErasing = false;
  let lastTile: { x: number; y: number } | null = null;
  const erasedCells = new Set<string>();

  function findActiveFenceLayerIndex(): number {
    const idx = state.activeLayerIndex;
    const layer = state.layers[idx];
    if (layer && layer.type === 'fence') return idx;
    // Try to find first fence layer matching active fence type key
    for (let i = 0; i < state.layers.length; i++) {
      const l = state.layers[i];
      if (l.type === 'fence' && l.fenceTypeKey === state.activeFenceTypeKey) {
        return i;
      }
    }
    return -1;
  }

  function tryErase(x: number, y: number): void {
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;

    const key = `${x},${y}`;
    if (erasedCells.has(key)) return;
    erasedCells.add(key);
  }

  function flushErase(): void {
    if (erasedCells.size === 0) return;

    const layerIndex = findActiveFenceLayerIndex();
    if (layerIndex < 0) {
      erasedCells.clear();
      return;
    }

    const positions = Array.from(erasedCells).map((key) => {
      const [xStr, yStr] = key.split(',');
      return { x: parseInt(xStr, 10), y: parseInt(yStr, 10) };
    });

    dispatch({
      type: 'ERASE_FENCE',
      layerIndex,
      positions,
    });

    erasedCells.clear();
  }

  return {
    onMouseDown(tile) {
      isErasing = true;
      erasedCells.clear();
      lastTile = tile;
      tryErase(tile.x, tile.y);
    },

    onMouseMove(tile) {
      if (!isErasing || !lastTile) return;
      if (tile.x === lastTile.x && tile.y === lastTile.y) return;

      // Use Bresenham's line to fill gaps during fast drags
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
      if (!isErasing) return;
      isErasing = false;
      lastTile = null;
      flushErase();
    },
  };
}
