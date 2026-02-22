import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction, CellDelta } from '@nookstead/map-lib';
import { bresenhamLine, PaintCommand, resolvePaint } from '@nookstead/map-lib';
import type { Cell } from '@nookstead/map-lib';
import type { ToolHandlers } from '../map-editor-canvas';

/**
 * Creates brush tool handlers.
 * Click to paint a single cell; drag to paint along a Bresenham line path.
 * Collects CellDelta entries and dispatches a PaintCommand on mouse up.
 *
 * Uses resolvePaint() per cell so material validation and grid update
 * follow the canonical pipeline. currentGrid tracks the accumulated grid
 * state during a stroke; state.grid provides oldTerrain for correct undo.
 */
export function createBrushTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>
): ToolHandlers {
  let isDrawing = false;
  let lastTile: { x: number; y: number } | null = null;
  let currentGrid: Cell[][] = state.grid;
  const paintedCells = new Map<string, CellDelta>();

  function tryPaint(x: number, y: number): void {
    const key = `${x},${y}`;
    if (paintedCells.has(key)) return;

    // Same-terrain check against accumulated grid (not original -- supports multi-material strokes)
    if (currentGrid[y]?.[x]?.terrain === state.activeMaterialKey) return;

    const result = resolvePaint({
      grid: currentGrid,
      x,
      y,
      materialKey: state.activeMaterialKey,
      width: state.width,
      height: state.height,
      materials: state.materials,
    });

    if (result.affectedCells.length === 0) return;

    // Advance accumulated grid for next cell in stroke
    currentGrid = result.updatedGrid;

    const layerIndex = state.activeLayerIndex;
    const oldFrame =
      layerIndex >= 0 && layerIndex < state.layers.length
        ? state.layers[layerIndex].frames[y][x]
        : 0;

    paintedCells.set(key, {
      layerIndex,
      x,
      y,
      // oldTerrain from ORIGINAL state.grid (not currentGrid) for correct undo
      oldTerrain: state.grid[y][x].terrain,
      newTerrain: state.activeMaterialKey,
      oldFrame,
      newFrame: 0, // Overridden by recomputeAutotileLayers in applyDeltas
    });
  }

  return {
    onMouseDown(tile: { x: number; y: number }) {
      isDrawing = true;
      paintedCells.clear();
      currentGrid = state.grid; // Reset to original grid at stroke start
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
