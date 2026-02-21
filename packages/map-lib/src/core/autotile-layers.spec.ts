import { recomputeAutotileLayers } from './autotile-layers';
import type { EditorLayer } from '../types/editor-types';
import type { TilesetInfo } from '../types/material-types';
import type { Cell } from '@nookstead/shared';

/**
 * Helper to create a Cell with the given terrain.
 */
function makeCell(terrain: string): Cell {
  return { terrain, elevation: 0, meta: {} } as Cell;
}

/**
 * Tileset where name matches terrain strings used in cells.
 * checkTerrainPresence looks up by key and compares name to cell terrain.
 */
const tilesets: TilesetInfo[] = [{ key: 'terrain-01', name: 'grass' }];

const emptyLayer: EditorLayer = {
  id: 'layer-1',
  name: 'Grass',
  terrainKey: 'terrain-01',
  visible: true,
  opacity: 1,
  frames: [
    [0, 0],
    [0, 0],
  ],
};

describe('recomputeAutotileLayers', () => {
  it('should return input layers unchanged (same reference) when affectedCells is empty', () => {
    const grid: Cell[][] = [[makeCell('grass'), makeCell('grass')]];
    const layers = [emptyLayer];
    const result = recomputeAutotileLayers(grid, layers, [], tilesets);
    expect(result).toBe(layers); // same reference
  });

  it('should not mutate the original layers frames when affectedCells is non-empty', () => {
    const grid: Cell[][] = [
      [makeCell('grass'), makeCell('grass')],
      [makeCell('grass'), makeCell('grass')],
    ];
    // Deep copy the layer so we can detect mutation on this specific instance
    const originalLayer: EditorLayer = {
      ...emptyLayer,
      frames: emptyLayer.frames.map((row) => [...row]),
    };
    const layers = [originalLayer];

    // Save original frame values
    const frame00Before = originalLayer.frames[0][0];
    const frame01Before = originalLayer.frames[0][1];

    recomputeAutotileLayers(grid, layers, [{ x: 0, y: 0 }], tilesets);

    // Original frames should not be mutated
    expect(originalLayer.frames[0][0]).toBe(frame00Before);
    expect(originalLayer.frames[0][1]).toBe(frame01Before);
  });

  it('should return a new layers array when affectedCells is non-empty', () => {
    const grid: Cell[][] = [
      [makeCell('grass'), makeCell('grass')],
      [makeCell('grass'), makeCell('grass')],
    ];
    const layers = [emptyLayer];
    const result = recomputeAutotileLayers(grid, layers, [{ x: 0, y: 0 }], tilesets);
    // Should be a new array reference
    expect(result).not.toBe(layers);
  });

  it('should return layers unchanged when grid has zero width', () => {
    const grid: Cell[][] = [[]]; // height=1, width=0
    const layers = [emptyLayer];
    const result = recomputeAutotileLayers(grid, layers, [{ x: 0, y: 0 }], tilesets);
    expect(result).toBe(layers);
  });

  it('should return layers unchanged when grid is empty', () => {
    const grid: Cell[][] = []; // height=0
    const layers = [emptyLayer];
    const result = recomputeAutotileLayers(grid, layers, [{ x: 0, y: 0 }], tilesets);
    expect(result).toBe(layers);
  });
});
