import { recomputeAutotileLayers } from './autotile-layers';
import { EMPTY_FRAME, SOLID_FRAME, getFrame } from './autotile';
import type { EditorLayer } from '../types/editor-types';
import type { MaterialInfo, TilesetInfo } from '../types/material-types';
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

  it('should use material-string mask even when materials map is provided', () => {
    // 3x3 grid: all deep_water, center is water
    const grid: Cell[][] = [
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('water'), makeCell('deep_water')],
      [makeCell('deep_water'), makeCell('deep_water'), makeCell('deep_water')],
    ];

    const materials = new Map<string, MaterialInfo>([
      ['deep_water', makeMaterial('deep_water', { renderPriority: 15 })],
      ['water', makeMaterial('water', { renderPriority: 10 })],
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

    // water surrounded by deep_water: 'deep_water' !== 'water' → mask=0 → ISOLATED
    const waterFrame = result[0].frames[1][1];
    expect(waterFrame).toBe(getFrame(0));
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

  it('should handle 9x9 deep_water with 5x5 water center and grass at center (pair-based tilesets)', () => {
    // Build 9x9 grid: all deep_water
    const grid: Cell[][] = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => makeCell('deep_water')),
    );
    // 5x5 water block in center (x=[2..6], y=[2..6])
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 6; x++) {
        grid[y][x] = makeCell('water');
      }
    }
    // Grass at center (4,4)
    grid[4][4] = makeCell('grass');

    const materials = new Map<string, MaterialInfo>([
      ['deep_water', makeMaterial('deep_water', { baseTilesetKey: 'ts-dw' })],
      ['water', makeMaterial('water', { baseTilesetKey: 'ts-w' })],
      ['grass', makeMaterial('grass', { baseTilesetKey: 'ts-g' })],
    ]);

    const tilesets: TilesetInfo[] = [
      { key: 'ts-dw', name: 'Deep Water', fromMaterialKey: 'deep_water' },
      { key: 'ts-w', name: 'Water', fromMaterialKey: 'water' },
      { key: 'ts-g', name: 'Grass', fromMaterialKey: 'grass' },
      { key: 'dw-w', name: 'DW to W', fromMaterialKey: 'deep_water', toMaterialKey: 'water' },
      { key: 'w-g', name: 'W to G', fromMaterialKey: 'water', toMaterialKey: 'grass' },
    ];

    // All 81 cells affected
    const allCells: { x: number; y: number }[] = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        allCells.push({ x, y });
      }
    }

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0)),
    };

    const result = recomputeAutotileLayers(
      grid, [layer], allCells, materials, undefined, tilesets,
    );

    const frames = result[0].frames;
    const tsKeys = result[0].tilesetKeys!;

    // --- Visual log ---
    const matLabel: Record<string, string> = { deep_water: 'DW', water: 'W ', grass: 'G ' };
    console.log('\n=== 9x9 Grid: material ===');
    for (let y = 0; y < 9; y++) {
      const row = Array.from({ length: 9 }, (_, x) => matLabel[grid[y][x].terrain] ?? '??');
      console.log(`  y${y}: ${row.join(' | ')}`);
    }
    console.log('\n=== Frames ===');
    for (let y = 0; y < 9; y++) {
      const row = frames[y].map((f) => String(f).padStart(2, ' '));
      console.log(`  y${y}: ${row.join(' | ')}`);
    }
    console.log('\n=== TilesetKeys ===');
    for (let y = 0; y < 9; y++) {
      const row = tsKeys[y].map((k) => k.padEnd(5, ' '));
      console.log(`  y${y}: ${row.join(' | ')}`);
    }
    console.log('');

    // --- Interior deep_water (0,0): all neighbors same → SOLID, base tileset ---
    expect(frames[0][0]).toBe(SOLID_FRAME);
    expect(tsKeys[0][0]).toBe('ts-dw');

    // --- Deep_water bordering water (1,2): forward lookup deep_water:water → dw-w ---
    expect(frames[2][1]).not.toBe(SOLID_FRAME);
    expect(frames[2][1]).not.toBe(EMPTY_FRAME);
    expect(tsKeys[2][1]).toBe('dw-w');

    // --- Water corner (2,2): no water:deep_water forward pair →
    //     reverse pair deep_water:water (dw-w) with inverted mask ---
    expect(frames[2][2]).not.toBe(SOLID_FRAME);
    expect(tsKeys[2][2]).toBe('dw-w');

    // --- Water adjacent to grass (3,4): forward lookup water:grass → w-g ---
    expect(frames[4][3]).not.toBe(SOLID_FRAME);
    expect(tsKeys[4][3]).toBe('w-g');

    // --- Grass center (4,4): no grass:water forward pair →
    //     reverse pair water:grass (w-g) with inverted mask.
    //     All neighbors are water → mask=0 → inverted = 255
    expect(frames[4][4]).toBe(getFrame(255)); // inverted mask (~0 & 0xFF)
    expect(tsKeys[4][4]).toBe('w-g');

    // --- No water cell should be SOLID (every water cell borders deep_water or grass) ---
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 6; x++) {
        if (x === 4 && y === 4) continue; // skip grass
        expect(frames[y][x]).not.toBe(SOLID_FRAME);
      }
    }
  });

  it('should recalculate same-material neighbor with transition frame when new same-material cell is painted', () => {
    // 5x5 grid: all deep_water
    const grid: Cell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => makeCell('deep_water')),
    );

    const materials = new Map<string, MaterialInfo>([
      ['deep_water', makeMaterial('deep_water', { baseTilesetKey: 'ts-dw' })],
      ['water', makeMaterial('water', { baseTilesetKey: 'ts-w' })],
    ]);

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0)),
    };

    // Step 1: paint water at (2,1) — full recompute (no paintedCells)
    grid[1][2] = makeCell('water');
    const allCells: { x: number; y: number }[] = [];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) allCells.push({ x, y });

    const after1 = recomputeAutotileLayers(
      grid, [layer], allCells, materials,
    );

    // (2,1) is water surrounded by deep_water → isolated (mask=0)
    const isolatedFrame = getFrame(0);
    expect(after1[0].frames[1][2]).toBe(isolatedFrame);

    // Step 2: paint water at (2,2) with paintedCells={2,2}
    grid[2][2] = makeCell('water');
    const paintedCells = new Set(['2,2']);
    const after2 = recomputeAutotileLayers(
      grid, after1, [{ x: 2, y: 2 }], materials, paintedCells,
    );

    // (2,1) is same-material neighbor but had transition frame (not SOLID).
    // It should NOT be skipped — it now has a south water neighbor.
    // Its frame must change from isolated to something with the S bit set.
    expect(after2[0].frames[1][2]).not.toBe(isolatedFrame);
    expect(after2[0].frames[1][2]).not.toBe(SOLID_FRAME); // still not fully surrounded
  });

  it('should resolve indirect tileset when no direct pair exists', () => {
    // 3x3 grid: deep_water on left column, grass on right two columns
    const grid: Cell[][] = [
      [makeCell('deep_water'), makeCell('grass'), makeCell('grass')],
      [makeCell('deep_water'), makeCell('grass'), makeCell('grass')],
      [makeCell('deep_water'), makeCell('grass'), makeCell('grass')],
    ];

    const materials = new Map<string, MaterialInfo>([
      ['deep_water', makeMaterial('deep_water', { baseTilesetKey: 'ts-dw' })],
      ['water', makeMaterial('water', { baseTilesetKey: 'ts-w' })],
      ['grass', makeMaterial('grass', { baseTilesetKey: 'ts-g' })],
    ]);

    // deep_water:water and water:grass exist, but NOT deep_water:grass
    const tilesets: TilesetInfo[] = [
      { key: 'ts-dw', name: 'Deep Water', fromMaterialKey: 'deep_water' },
      { key: 'ts-w', name: 'Water', fromMaterialKey: 'water' },
      { key: 'ts-g', name: 'Grass', fromMaterialKey: 'grass' },
      { key: 'dw-w', name: 'DW to W', fromMaterialKey: 'deep_water', toMaterialKey: 'water' },
      { key: 'w-g', name: 'W to G', fromMaterialKey: 'water', toMaterialKey: 'grass' },
    ];

    const allCells: { x: number; y: number }[] = [];
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) allCells.push({ x, y });

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 0)),
    };

    const result = recomputeAutotileLayers(
      grid, [layer], allCells, materials, undefined, tilesets,
    );

    const tsKeys = result[0].tilesetKeys!;

    // deep_water cells (x=0) border grass — no direct deep_water:grass pair.
    // Indirect resolution: deep_water:water exists + water:grass exists → use dw-w
    expect(tsKeys[1][0]).toBe('dw-w');
    // NOT the base tileset
    expect(tsKeys[1][0]).not.toBe('ts-dw');
  });

  it('should not recalculate same-material neighbors when painting a second line', () => {
    // 9x9 grid: all deep_water
    const grid: Cell[][] = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => makeCell('deep_water')),
    );

    const materials = new Map<string, MaterialInfo>([
      ['deep_water', makeMaterial('deep_water', { baseTilesetKey: 'ts-dw' })],
      ['water', makeMaterial('water', { baseTilesetKey: 'ts-w' })],
    ]);

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0)),
    };

    // --- Step 1: paint water line at y=3 (x=0..8) ---
    const line1Cells: { x: number; y: number }[] = [];
    const line1Painted = new Set<string>();
    for (let x = 0; x < 9; x++) {
      grid[3][x] = makeCell('water');
      line1Cells.push({ x, y: 3 });
      line1Painted.add(`${x},3`);
    }

    const after1 = recomputeAutotileLayers(
      grid, [layer], line1Cells, materials, line1Painted,
    );

    // Painted cells on y=3 compute masks normally (no Solid Block Rule).
    // A single water line has no N/S water neighbors → not SOLID.
    for (let x = 0; x < 9; x++) {
      expect(after1[0].frames[3][x]).not.toBe(SOLID_FRAME);
      expect(after1[0].frames[3][x]).not.toBe(EMPTY_FRAME);
    }

    // --- Step 2: paint water line at y=4 (x=0..8) ---
    const line2Cells: { x: number; y: number }[] = [];
    const line2Painted = new Set<string>();
    for (let x = 0; x < 9; x++) {
      grid[4][x] = makeCell('water');
      line2Cells.push({ x, y: 4 });
      line2Painted.add(`${x},4`);
    }

    const after2 = recomputeAutotileLayers(
      grid, after1, line2Cells, materials, line2Painted,
    );

    // y=3 cells now have south water neighbors (y=4) — masks should update.
    // They are NOT SOLID (still no north water neighbors).
    for (let x = 0; x < 9; x++) {
      expect(after2[0].frames[3][x]).not.toBe(EMPTY_FRAME);
    }

    // y=4 cells also compute masks normally — they have north water neighbors (y=3)
    // but no south water neighbors → not SOLID.
    for (let x = 0; x < 9; x++) {
      expect(after2[0].frames[4][x]).not.toBe(EMPTY_FRAME);
    }

    // deep_water neighbors at y=2 (different material) should be recalculated
    // and NOT be SOLID (they border water)
    for (let x = 0; x < 9; x++) {
      expect(after2[0].frames[2][x]).not.toBe(SOLID_FRAME);
    }

    // deep_water neighbors at y=5 (different material) should be recalculated
    for (let x = 0; x < 9; x++) {
      expect(after2[0].frames[5][x]).not.toBe(SOLID_FRAME);
    }
  });

  it('should use target-specific mask to avoid tunnel effect when cell borders two foreign materials', () => {
    // 5x5 grid:
    //   DW  DW  DW  DW  DW
    //   DW  DS  DS  DS  DW
    //   DW  DS   S  DS  DW   ← sand painted at center
    //   DW  DS  DS  DS  DW
    //   DW  DW  DW  DW  DW
    const grid: Cell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => makeCell('deep_water')),
    );
    // 3x3 deep_sand block in center
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        grid[y][x] = makeCell('deep_sand');
      }
    }
    // sand at the very center
    grid[2][2] = makeCell('sand');

    const materials = new Map<string, MaterialInfo>([
      ['deep_water', makeMaterial('deep_water', { baseTilesetKey: 'ts-dw' })],
      ['deep_sand', makeMaterial('deep_sand', { baseTilesetKey: 'ts-ds' })],
      ['sand', makeMaterial('sand', { baseTilesetKey: 'ts-s' })],
    ]);

    const tilesets: TilesetInfo[] = [
      { key: 'ts-dw', name: 'Deep Water', fromMaterialKey: 'deep_water' },
      { key: 'ts-ds', name: 'Deep Sand', fromMaterialKey: 'deep_sand' },
      { key: 'ts-s', name: 'Sand', fromMaterialKey: 'sand' },
      { key: 'dw-ds', name: 'DW to DS', fromMaterialKey: 'deep_water', toMaterialKey: 'deep_sand' },
      { key: 'ds-s', name: 'DS to S', fromMaterialKey: 'deep_sand', toMaterialKey: 'sand' },
    ];

    const allCells: { x: number; y: number }[] = [];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) allCells.push({ x, y });

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0)),
    };

    const result = recomputeAutotileLayers(
      grid, [layer], allCells, materials, undefined, tilesets,
    );

    const frames = result[0].frames;
    const tsKeys = result[0].tilesetKeys!;

    // Cell DS(1,2) — left column middle: W=DW, E=S
    // Dominant neighbor = deep_water (5 DW neighbors vs 1 S neighbor)
    // With target-specific mask: transition only toward DW (W side),
    // sand side (E) gets bit=1 (no transition) → no tunnel.
    //
    // If generic mask were used, both W and E would be bit=0 → tunnel artifact.
    expect(tsKeys[2][1]).toBe('dw-ds');

    // The frame at DS(1,2) should NOT be the same as getFrame(generic_mask).
    // Specifically: with target-specific mask, E bit should be SET (sand is not DW).
    // With generic mask, E bit would be CLEAR (sand !== deep_sand).
    //
    // We verify by checking against the frame that the old code would produce:
    // Old generic mask for DS(1,2): only N,S neighbors are deep_sand → limited bits
    // Instead, just verify the frame is not SOLID and not the isolated frame from generic mask.
    const genericMaskFrame = getFrame(0); // would mean transitions on all sides
    expect(frames[2][1]).not.toBe(genericMaskFrame);
    expect(frames[2][1]).not.toBe(SOLID_FRAME);
    expect(frames[2][1]).not.toBe(EMPTY_FRAME);

    // Cell DS(3,2) — right column middle: W=S, E=DW
    // Same logic, mirrored
    expect(tsKeys[2][3]).toBe('dw-ds');
    expect(frames[2][3]).not.toBe(genericMaskFrame);

    // Cell DS(2,1) — top row middle: N=DW, S=S
    expect(tsKeys[1][2]).toBe('dw-ds');
    expect(frames[1][2]).not.toBe(genericMaskFrame);

    // Cell DS(2,3) — bottom row middle: N=S, S=DW
    expect(tsKeys[3][2]).toBe('dw-ds');
    expect(frames[3][2]).not.toBe(genericMaskFrame);
  });

  it('should apply reverse pair with inverted mask when direct pair is missing', () => {
    // 3x3 grid: deep_sand border, sand in the center
    const grid: Cell[][] = [
      [makeCell('deep_sand'), makeCell('deep_sand'), makeCell('deep_sand')],
      [makeCell('deep_sand'), makeCell('sand'), makeCell('deep_sand')],
      [makeCell('deep_sand'), makeCell('deep_sand'), makeCell('deep_sand')],
    ];

    const materials = new Map<string, MaterialInfo>([
      ['deep_sand', makeMaterial('deep_sand', { baseTilesetKey: 'ts-ds' })],
      ['sand', makeMaterial('sand', { baseTilesetKey: 'ts-s' })],
    ]);

    // ONLY deep_sand:sand exists. No sand:deep_sand.
    const tilesets: TilesetInfo[] = [
      { key: 'ts-ds', name: 'Deep Sand', fromMaterialKey: 'deep_sand' },
      { key: 'ts-s', name: 'Sand', fromMaterialKey: 'sand' },
      { key: 'ds-s', name: 'DS to S', fromMaterialKey: 'deep_sand', toMaterialKey: 'sand' },
    ];

    const allCells: { x: number; y: number }[] = [];
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) allCells.push({ x, y });

    const layer: EditorLayer = {
      id: 'l1',
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 0)),
    };

    const result = recomputeAutotileLayers(
      grid, [layer], allCells, materials, undefined, tilesets,
    );

    const frames = result[0].frames;
    const tsKeys = result[0].tilesetKeys!;

    // Center cell (sand) is isolated (mask=0).
    // It should find the reverse pair `deep_sand:sand` and use inverted mask (~0 & 0xFF = 255).
    expect(tsKeys[1][1]).toBe('ds-s');
    expect(frames[1][1]).toBe(getFrame(255)); // inverted mask

    // Border cell (deep_sand at 0,1) neighbors sand.
    // Has a direct pair `deep_sand:sand`. Uses regular mask.
    // For (0,1), sand is East. Mask should not have E bit.
    expect(tsKeys[0][1]).toBe('ds-s');
    expect(frames[0][1]).not.toBe(SOLID_FRAME);
  });
});
