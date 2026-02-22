import { recomputeAutotileLayers } from './autotile-layers';
import { EMPTY_FRAME, getFrame } from './autotile';
import type { EditorLayer } from '../types/editor-types';
import type { MaterialInfo } from '../types/material-types';
import type { Cell } from '@nookstead/shared';

/**
 * Helper to create a Cell with the given terrain.
 */
function makeCell(terrain: string): Cell {
  return { terrain, elevation: 0, meta: {} } as Cell;
}

function makeMaterial(
  key: string,
  overrides: Partial<MaterialInfo> = {},
): MaterialInfo {
  return {
    key,
    color: '#000',
    walkable: true,
    renderPriority: 0,
    baseTilesetKey: `tileset-${key}`,
    ...overrides,
  };
}

const emptyLayer: EditorLayer = {
  id: 'layer-1',
  name: 'Ground',
  terrainKey: 'terrain-01',
  visible: true,
  opacity: 1,
  frames: [
    [0, 0],
    [0, 0],
  ],
};

// ---------------------------------------------------------------------------
// recomputeAutotileLayers
// ---------------------------------------------------------------------------
describe('recomputeAutotileLayers', () => {
  it('should return input layers unchanged (same reference) when affectedCells is empty', () => {
    const grid: Cell[][] = [[makeCell('grass'), makeCell('grass')]];
    const layers = [emptyLayer];
    const result = recomputeAutotileLayers(grid, layers, []);
    expect(result).toBe(layers); // same reference
  });

  it('should not mutate the original layers frames when affectedCells is non-empty', () => {
    const grid: Cell[][] = [
      [makeCell('grass'), makeCell('grass')],
      [makeCell('grass'), makeCell('grass')],
    ];
    const originalLayer: EditorLayer = {
      ...emptyLayer,
      frames: emptyLayer.frames.map((row) => [...row]),
    };
    const layers = [originalLayer];

    const frame00Before = originalLayer.frames[0][0];
    const frame01Before = originalLayer.frames[0][1];

    recomputeAutotileLayers(grid, layers, [{ x: 0, y: 0 }]);

    expect(originalLayer.frames[0][0]).toBe(frame00Before);
    expect(originalLayer.frames[0][1]).toBe(frame01Before);
  });

  it('should return a new layers array when affectedCells is non-empty', () => {
    const grid: Cell[][] = [
      [makeCell('grass'), makeCell('grass')],
      [makeCell('grass'), makeCell('grass')],
    ];
    const layers = [emptyLayer];
    const result = recomputeAutotileLayers(grid, layers, [{ x: 0, y: 0 }]);
    expect(result).not.toBe(layers);
  });

  it('should return layers unchanged when grid has zero width', () => {
    const grid: Cell[][] = [[]]; // height=1, width=0
    const layers = [emptyLayer];
    const result = recomputeAutotileLayers(grid, layers, [{ x: 0, y: 0 }]);
    expect(result).toBe(layers);
  });

  it('should return layers unchanged when grid is empty', () => {
    const grid: Cell[][] = []; // height=0
    const layers = [emptyLayer];
    const result = recomputeAutotileLayers(grid, layers, [{ x: 0, y: 0 }]);
    expect(result).toBe(layers);
  });

  it('should set EMPTY_FRAME for cells with empty terrain', () => {
    const grid: Cell[][] = [
      [makeCell('grass'), makeCell('')],
    ];
    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: [[0, 0]],
    };

    const result = recomputeAutotileLayers(grid, [layer], [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(result[0].frames[0][1]).toBe(EMPTY_FRAME);
    expect(result[0].frames[0][0]).not.toBe(EMPTY_FRAME);
  });

  it('should skip layers without frames (e.g., object layers)', () => {
    const grid: Cell[][] = [[makeCell('grass')]];
    const objectLayer = {
      id: 'obj',
      name: 'objects',
      type: 'object',
      visible: true,
      opacity: 1,
      objects: [],
    } as unknown as EditorLayer;

    const result = recomputeAutotileLayers(grid, [objectLayer], [{ x: 0, y: 0 }]);
    expect(result[0]).toBe(objectLayer); // same reference, untouched
  });

  it('should use priority-based mask when materials provided', () => {
    // 3x3 grid: all deep_water, center is water
    const grid: Cell[][] = [
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
    ];

    const materials = new Map<string, MaterialInfo>([
      ['deep_water', makeMaterial('deep_water', { renderPriority: 1 })],
      ['water', makeMaterial('water', { renderPriority: 5 })],
    ]);

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
    };

    const result = recomputeAutotileLayers(
      grid,
      [layer],
      [{ x: 1, y: 1 }],
      materials,
    );

    // water (priority=5) surrounded by deep_water (priority=1)
    // deep_water priority 1 <= 5, so all neighbors match → SOLID frame
    const waterFrame = result[0].frames[1][1];
    // getFrame(255) = SOLID_FRAME (frame index 1)
    expect(waterFrame).toBe(getFrame(255));
  });

  it('should fall back to material-string mask when materials is empty', () => {
    // 3x3 grid: all deep_water, center is water
    const grid: Cell[][] = [
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
    ];

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
    };

    // No materials → falls back to exact string comparison
    const result = recomputeAutotileLayers(grid, [layer], [{ x: 1, y: 1 }]);

    // water !== deep_water → mask=0 → ISOLATED frame
    const waterFrame = result[0].frames[1][1];
    expect(waterFrame).toBe(getFrame(0)); // ISOLATED
  });

  it('should compute frames for all cells in every layer (no fromMaterialKey filter)', () => {
    const grid: Cell[][] = [
      [makeCell('grass'), makeCell('water')],
    ];

    const materials = new Map<string, MaterialInfo>([
      ['grass', makeMaterial('grass', { renderPriority: 10 })],
      ['water', makeMaterial('water', { renderPriority: 5 })],
    ]);

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: [[0, 0]],
    };

    const result = recomputeAutotileLayers(
      grid,
      [layer],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      materials,
    );

    // Both cells should have non-empty frames (no filtering by material)
    expect(result[0].frames[0][0]).not.toBe(EMPTY_FRAME);
    expect(result[0].frames[0][1]).not.toBe(EMPTY_FRAME);
  });
});
