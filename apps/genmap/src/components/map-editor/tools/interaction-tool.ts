import type { Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@nookstead/map-lib';
import type { ToolHandlers } from '../map-editor-canvas';
import type { CellTrigger } from '@nookstead/shared';

/**
 * Builds a default trigger of the given type.
 * Default configs are minimal — the user edits via config panel later.
 */
function buildDefaultTrigger(triggerType: CellTrigger['type']): CellTrigger {
  switch (triggerType) {
    case 'warp':
      return {
        type: 'warp',
        activation: 'touch',
        targetMap: '',
        targetX: 0,
        targetY: 0,
      };
    case 'interact':
      return {
        type: 'interact',
        activation: 'click',
        interactionType: 'custom',
      };
    case 'event':
      return {
        type: 'event',
        activation: 'touch',
        eventName: '',
      };
    case 'sound':
      return {
        type: 'sound',
        activation: 'proximity',
        soundKey: '',
      };
    case 'damage':
      return {
        type: 'damage',
        activation: 'touch',
        amount: 1,
        interval: 1000,
      };
  }
}

/**
 * Finds the index of the first InteractionLayer in the layers array.
 * Returns -1 if none exists.
 */
function findInteractionLayerIndex(state: MapEditorState): number {
  return state.layers.findIndex((l) => l.type === 'interaction');
}

/**
 * Creates interaction-place tool handlers.
 * On click: places a default trigger of the active type at the clicked tile.
 * Auto-creates an InteractionLayer if none exists.
 */
export function createInteractionPlaceTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>,
): ToolHandlers {
  return {
    onMouseDown(tile) {
      let layerIndex = findInteractionLayerIndex(state);

      if (layerIndex === -1) {
        dispatch({ type: 'ADD_INTERACTION_LAYER', name: 'Interactions' });
        layerIndex = state.layers.length;
      }

      const triggerType = state.activeTriggerType ?? 'warp';

      const trigger = buildDefaultTrigger(triggerType);
      dispatch({
        type: 'PLACE_TRIGGER',
        layerIndex,
        x: tile.x,
        y: tile.y,
        trigger,
      });
    },
    onMouseMove() { /* no-op: interaction tools are click-only */ },
    onMouseUp() { /* no-op: interaction tools are click-only */ },
  };
}

/**
 * Creates interaction-eraser tool handlers.
 * On click: removes all triggers at the clicked tile position.
 */
export function createInteractionEraserTool(
  state: MapEditorState,
  dispatch: Dispatch<MapEditorAction>,
): ToolHandlers {
  return {
    onMouseDown(tile) {
      const layerIndex = findInteractionLayerIndex(state);
      if (layerIndex === -1) return;

      dispatch({
        type: 'REMOVE_TRIGGER',
        layerIndex,
        x: tile.x,
        y: tile.y,
      });
    },
    onMouseMove() { /* no-op: interaction tools are click-only */ },
    onMouseUp() { /* no-op: interaction tools are click-only */ },
  };
}
