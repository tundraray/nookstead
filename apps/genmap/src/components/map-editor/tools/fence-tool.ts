import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';
import type { PreviewRect } from '../canvas-renderer';
import type { ToolHandlers } from '../map-editor-canvas';

/** Fence placement mode. */
export type FencePlacementMode = 'single' | 'rectangle' | 'line';

/**
 * Creates fence tool handlers.
 *
 * Supports three placement modes:
 * - single: Click to place a fence segment at the clicked cell.
 * - rectangle: Drag to define a rectangle; places fences along the perimeter.
 * - line: Click start, then click end; places fences along horizontal or vertical line.
 *
 * Shift-click on an existing fence cell toggles the gate state.
 */
export function createFenceTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>,
  mode: FencePlacementMode,
  setPreviewRect: (rect: PreviewRect | null) => void,
  isShiftHeld: () => boolean
): ToolHandlers {
  // Rectangle mode state
  let rectStartTile: { x: number; y: number } | null = null;
  let isDrawingRect = false;

  // Line mode state
  let lineStartTile: { x: number; y: number } | null = null;

  function findActiveFenceLayerIndex(): number {
    const idx = state.activeLayerIndex;
    const layer = state.layers[idx];
    if (layer && layer.type === 'fence') return idx;
    // If active layer is not a fence layer, try to find the first fence layer
    // matching the active fence type key
    for (let i = 0; i < state.layers.length; i++) {
      const l = state.layers[i];
      if (l.type === 'fence' && l.fenceTypeKey === state.activeFenceTypeKey) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Compute the perimeter cells of a rectangle defined by two corners.
   * Design Doc Section 2.1.2: A cell is on the perimeter if
   * x == minX OR x == maxX OR y == minY OR y == maxY
   */
  function computePerimeterCells(
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): { x: number; y: number }[] {
    const minX = Math.max(0, Math.min(a.x, b.x));
    const minY = Math.max(0, Math.min(a.y, b.y));
    const maxX = Math.min(state.width - 1, Math.max(a.x, b.x));
    const maxY = Math.min(state.height - 1, Math.max(a.y, b.y));

    const cells: { x: number; y: number }[] = [];
    const seen = new Set<string>();

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x === minX || x === maxX || y === minY || y === maxY) {
          const key = `${x},${y}`;
          if (!seen.has(key)) {
            seen.add(key);
            cells.push({ x, y });
          }
        }
      }
    }

    return cells;
  }

  /**
   * Compute cells along a horizontal or vertical line.
   * Design Doc Section 2.1.3: if |deltaX| >= |deltaY|, horizontal; else vertical.
   */
  function computeLineCells(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): { x: number; y: number }[] {
    const deltaX = Math.abs(end.x - start.x);
    const deltaY = Math.abs(end.y - start.y);
    const cells: { x: number; y: number }[] = [];

    if (deltaX >= deltaY) {
      // Horizontal line at start.y
      const y = start.y;
      const fromX = Math.max(0, Math.min(start.x, end.x));
      const toX = Math.min(state.width - 1, Math.max(start.x, end.x));
      for (let x = fromX; x <= toX; x++) {
        if (y >= 0 && y < state.height) {
          cells.push({ x, y });
        }
      }
    } else {
      // Vertical line at start.x
      const x = start.x;
      const fromY = Math.max(0, Math.min(start.y, end.y));
      const toY = Math.min(state.height - 1, Math.max(start.y, end.y));
      for (let y = fromY; y <= toY; y++) {
        if (x >= 0 && x < state.width) {
          cells.push({ x, y });
        }
      }
    }

    return cells;
  }

  function handleGateToggle(tile: { x: number; y: number }): boolean {
    const layerIndex = findActiveFenceLayerIndex();
    if (layerIndex < 0) return false;

    const layer = state.layers[layerIndex];
    if (layer.type !== 'fence') return false;

    const { x, y } = tile;
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return false;

    const cell = layer.cells[y]?.[x];
    if (cell === null || cell === undefined) return false;

    dispatch({
      type: 'TOGGLE_GATE',
      layerIndex,
      x,
      y,
    });
    return true;
  }

  function placeFence(positions: { x: number; y: number }[]): void {
    if (positions.length === 0) return;

    const layerIndex = findActiveFenceLayerIndex();
    if (layerIndex < 0) return;

    dispatch({
      type: 'PLACE_FENCE',
      layerIndex,
      positions,
    });
  }

  switch (mode) {
    case 'single':
      return {
        onMouseDown(tile) {
          // Shift-click: toggle gate
          if (isShiftHeld()) {
            handleGateToggle(tile);
            return;
          }
          placeFence([tile]);
        },
        onMouseMove() {
          // No-op for single mode
        },
        onMouseUp() {
          // No-op for single mode
        },
      };

    case 'rectangle':
      return {
        onMouseDown(tile) {
          if (isShiftHeld()) {
            handleGateToggle(tile);
            return;
          }
          isDrawingRect = true;
          rectStartTile = tile;
          setPreviewRect({
            x: tile.x,
            y: tile.y,
            width: 1,
            height: 1,
          });
        },
        onMouseMove(tile) {
          if (!isDrawingRect || !rectStartTile) return;
          const minX = Math.min(rectStartTile.x, tile.x);
          const minY = Math.min(rectStartTile.y, tile.y);
          const maxX = Math.max(rectStartTile.x, tile.x);
          const maxY = Math.max(rectStartTile.y, tile.y);
          setPreviewRect({
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          });
        },
        onMouseUp(tile) {
          if (!isDrawingRect || !rectStartTile) return;
          isDrawingRect = false;
          setPreviewRect(null);

          const perimeter = computePerimeterCells(rectStartTile, tile);
          placeFence(perimeter);
          rectStartTile = null;
        },
      };

    case 'line':
      return {
        onMouseDown(tile) {
          if (isShiftHeld()) {
            handleGateToggle(tile);
            return;
          }

          if (lineStartTile === null) {
            // First click: set start
            lineStartTile = tile;
          } else {
            // Second click: compute line and place
            const lineCells = computeLineCells(lineStartTile, tile);
            placeFence(lineCells);
            lineStartTile = null;
            setPreviewRect(null);
          }
        },
        onMouseMove(tile) {
          if (lineStartTile === null) return;
          // Show preview of the line extent
          const deltaX = Math.abs(tile.x - lineStartTile.x);
          const deltaY = Math.abs(tile.y - lineStartTile.y);

          if (deltaX >= deltaY) {
            // Horizontal line
            const minX = Math.min(lineStartTile.x, tile.x);
            const maxX = Math.max(lineStartTile.x, tile.x);
            setPreviewRect({
              x: minX,
              y: lineStartTile.y,
              width: maxX - minX + 1,
              height: 1,
            });
          } else {
            // Vertical line
            const minY = Math.min(lineStartTile.y, tile.y);
            const maxY = Math.max(lineStartTile.y, tile.y);
            setPreviewRect({
              x: lineStartTile.x,
              y: minY,
              width: 1,
              height: maxY - minY + 1,
            });
          }
        },
        onMouseUp() {
          // No-op: line mode uses click-click, not drag
        },
      };
  }
}
