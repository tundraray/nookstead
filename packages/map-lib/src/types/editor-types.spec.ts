import type {
  EditorLayerUnion,
  InteractionLayer,
} from './editor-types';
import type { CellTrigger } from '@nookstead/shared';

describe('EditorLayerUnion', () => {
  it('accepts an InteractionLayer as a valid union member', () => {
    const layer: InteractionLayer = {
      id: 'int-1',
      name: 'Interactions',
      type: 'interaction',
      visible: true,
      opacity: 1,
      triggers: new Map(),
    };
    const union: EditorLayerUnion = layer;
    expect(union.type).toBe('interaction');
  });

  it('narrows to InteractionLayer using type discriminant', () => {
    const layer: EditorLayerUnion = {
      id: 'int-1',
      name: 'Interactions',
      type: 'interaction',
      visible: true,
      opacity: 1,
      triggers: new Map(),
    } as InteractionLayer;

    if (layer.type === 'interaction') {
      expect(layer.triggers).toBeInstanceOf(Map);
    } else {
      fail('Expected layer.type to be interaction');
    }
  });

  it('InteractionLayer triggers Map accepts CellTrigger arrays', () => {
    const warp: CellTrigger = {
      type: 'warp',
      activation: 'touch',
      targetMap: 'town',
      targetX: 0,
      targetY: 0,
    };

    const layer: InteractionLayer = {
      id: 'int-1',
      name: 'Interactions',
      type: 'interaction',
      visible: true,
      opacity: 1,
      triggers: new Map([['3,4', [warp]]]),
    };

    expect(layer.triggers.get('3,4')).toEqual([warp]);
    expect(layer.triggers.size).toBe(1);
  });

  it('covers all 4 layer types in exhaustive type check', () => {
    function getLayerKind(layer: EditorLayerUnion): string {
      switch (layer.type) {
        case 'tile':
          return 'tile';
        case 'object':
          return 'object';
        case 'fence':
          return 'fence';
        case 'interaction':
          return 'interaction';
      }
    }

    const interactionLayer: InteractionLayer = {
      id: 'int-1',
      name: 'Interactions',
      type: 'interaction',
      visible: true,
      opacity: 1,
      triggers: new Map(),
    };

    expect(getLayerKind(interactionLayer)).toBe('interaction');
  });
});
