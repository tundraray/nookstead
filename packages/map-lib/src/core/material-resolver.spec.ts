import {
  buildTransitionMap,
  resolvePaint,
  createTransitionLayer,
} from './material-resolver';
import type { TilesetInfo, MaterialInfo } from '../types/material-types';
import type { EditorLayer } from '../types/editor-types';
import type { Cell } from '@nookstead/shared';

// --- Test fixtures ---

const grassMaterial: MaterialInfo = {
  key: 'grass',
  walkable: true,
  renderPriority: 0,
};
const sandMaterial: MaterialInfo = {
  key: 'sand',
  walkable: true,
  renderPriority: 1,
};

const materials = new Map<string, MaterialInfo>([
  ['grass', grassMaterial],
  ['sand', sandMaterial],
]);

/**
 * Transition tileset: fromMaterialId and toMaterialId are material keys
 * (caller must pre-resolve UUIDs to keys before calling buildTransitionMap).
 */
const transitionTileset: TilesetInfo = {
  key: 'grass-to-sand',
  name: 'Grass to Sand',
  fromMaterialId: 'grass',
  toMaterialId: 'sand',
};

// --- Helpers ---

function makeGrid(w: number, h: number, terrain: string): Cell[][] {
  return Array.from({ length: h }, () =>
    Array.from(
      { length: w },
      () => ({ terrain, elevation: 0, meta: {} } as Cell),
    ),
  );
}

function makeLayer(terrainKey: string, w: number, h: number): EditorLayer {
  return {
    id: 'l1',
    name: 'Layer',
    terrainKey,
    visible: true,
    opacity: 1,
    frames: Array.from({ length: h }, () => Array(w).fill(0)),
  };
}

// --- Tests ---

describe('buildTransitionMap', () => {
  it('should build a map keyed by "fromKey:toKey"', () => {
    const tilesets: TilesetInfo[] = [transitionTileset];
    const map = buildTransitionMap(tilesets, materials);
    expect(map.has('grass:sand')).toBe(true);

    const entry = map.get('grass:sand')!;
    expect(entry.fromMaterialKey).toBe('grass');
    expect(entry.toMaterialKey).toBe('sand');
    expect(entry.tilesetKey).toBe('grass-to-sand');
    expect(entry.tilesetName).toBe('Grass to Sand');
  });

  it('should skip tilesets without fromMaterialId', () => {
    const tilesets: TilesetInfo[] = [
      { key: 'plain', name: 'Plain', toMaterialId: 'sand' },
    ];
    const map = buildTransitionMap(tilesets, materials);
    expect(map.size).toBe(0);
  });

  it('should skip tilesets without toMaterialId', () => {
    const tilesets: TilesetInfo[] = [
      { key: 'plain', name: 'Plain', fromMaterialId: 'grass' },
    ];
    const map = buildTransitionMap(tilesets, materials);
    expect(map.size).toBe(0);
  });

  it('should skip tilesets referencing unknown material keys', () => {
    const tilesets: TilesetInfo[] = [
      {
        key: 'unknown-transition',
        name: 'Unknown',
        fromMaterialId: 'grass',
        toMaterialId: 'lava',
      },
    ];
    const map = buildTransitionMap(tilesets, materials);
    expect(map.size).toBe(0);
  });

  it('should handle multiple tilesets', () => {
    const waterMaterial: MaterialInfo = {
      key: 'water',
      walkable: false,
      renderPriority: 2,
    };
    const extMaterials = new Map([...materials, ['water', waterMaterial]]);
    const tilesets: TilesetInfo[] = [
      transitionTileset,
      {
        key: 'grass-to-water',
        name: 'Grass to Water',
        fromMaterialId: 'grass',
        toMaterialId: 'water',
      },
    ];
    const map = buildTransitionMap(tilesets, extMaterials);
    expect(map.size).toBe(2);
    expect(map.has('grass:sand')).toBe(true);
    expect(map.has('grass:water')).toBe(true);
  });
});

describe('resolvePaint', () => {
  const transitionMap = buildTransitionMap([transitionTileset], materials);

  it('should set grid[y][x].terrain to materialKey (AC3)', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'sand',
      width: 3,
      height: 3,
      layers: [makeLayer('grass', 3, 3)],
      transitionMap,
      materials,
    });
    expect(result.updatedGrid[1][1].terrain).toBe('sand');
  });

  it('should not mutate the original grid', () => {
    const grid = makeGrid(3, 3, 'grass');
    resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'sand',
      width: 3,
      height: 3,
      layers: [makeLayer('grass', 3, 3)],
      transitionMap,
      materials,
    });
    expect(grid[1][1].terrain).toBe('grass');
  });

  it('should include painted cell and all in-bounds neighbors in affectedCells (AC3)', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'sand',
      width: 3,
      height: 3,
      layers: [makeLayer('grass', 3, 3)],
      transitionMap,
      materials,
    });
    // Center cell + 8 neighbors = 9 cells
    expect(result.affectedCells.length).toBe(9);
    expect(result.affectedCells.some((c) => c.x === 1 && c.y === 1)).toBe(
      true,
    );
  });

  it('should return warning for missing transition (AC3)', () => {
    const grid = makeGrid(3, 3, 'grass');
    // Place a 'water' neighbor that has no transition tileset
    grid[1][0] = { terrain: 'water', elevation: 0, meta: {} } as Cell;
    const waterMaterials = new Map<string, MaterialInfo>([
      ...materials,
      [
        'water',
        { key: 'water', walkable: false, renderPriority: 2 },
      ],
    ]);
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'sand',
      width: 3,
      height: 3,
      layers: [makeLayer('grass', 3, 3)],
      transitionMap,
      materials: waterMaterials,
    });
    // 'sand' + 'water' has no transition tileset, should produce a warning
    expect(result.warnings.length).toBeGreaterThan(0);
    const waterWarning = result.warnings.find(
      (w) => w.toMaterial === 'water' || w.fromMaterial === 'water',
    );
    expect(waterWarning).toBeDefined();
  });

  it('should return unchanged state for out-of-bounds coordinates', () => {
    const grid = makeGrid(3, 3, 'grass');
    const layers = [makeLayer('grass', 3, 3)];
    const result = resolvePaint({
      grid,
      x: 10,
      y: 10,
      materialKey: 'sand',
      width: 3,
      height: 3,
      layers,
      transitionMap,
      materials,
    });
    // Grid reference should be the same object (unchanged)
    expect(result.updatedGrid).toBe(grid);
    expect(result.affectedCells).toHaveLength(0);
  });

  it('should return unchanged state for negative coordinates', () => {
    const grid = makeGrid(3, 3, 'grass');
    const layers = [makeLayer('grass', 3, 3)];
    const result = resolvePaint({
      grid,
      x: -1,
      y: -1,
      materialKey: 'sand',
      width: 3,
      height: 3,
      layers,
      transitionMap,
      materials,
    });
    expect(result.updatedGrid).toBe(grid);
    expect(result.affectedCells).toHaveLength(0);
  });

  it('should handle edge cell with fewer than 8 in-bounds neighbors', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 0,
      y: 0,
      materialKey: 'sand',
      width: 3,
      height: 3,
      layers: [makeLayer('grass', 3, 3)],
      transitionMap,
      materials,
    });
    // Corner cell (0,0): self + 3 in-bounds neighbors = 4 affected cells
    expect(result.affectedCells.length).toBe(4);
  });

  it('should return warning for unknown materialKey', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'lava',
      width: 3,
      height: 3,
      layers: [makeLayer('grass', 3, 3)],
      transitionMap,
      materials,
    });
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].message).toContain('Unknown material key');
    expect(result.affectedCells).toHaveLength(0);
  });

  it('should create a transition layer when painting a neighbor with a known transition', () => {
    // Fill grid with grass, but put sand at (0,1) so painting (1,1) as grass
    // has a sand neighbor. The transition grass:sand or sand:grass should be found.
    const grid = makeGrid(3, 3, 'sand');
    grid[1][1] = { terrain: 'grass', elevation: 0, meta: {} } as Cell;
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'grass',
      width: 3,
      height: 3,
      layers: [makeLayer('grass', 3, 3)],
      transitionMap,
      materials,
    });
    // Should have created a transition layer for grass-to-sand
    const transLayer = result.updatedLayers.find(
      (l) => l.terrainKey === 'grass-to-sand',
    );
    expect(transLayer).toBeDefined();
    expect(transLayer!.frames.length).toBe(3);
    expect(transLayer!.frames[0].length).toBe(3);
  });

  it('should not duplicate transition layer if it already exists', () => {
    const grid = makeGrid(3, 3, 'sand');
    grid[1][1] = { terrain: 'grass', elevation: 0, meta: {} } as Cell;
    const existingTransLayer = createTransitionLayer(
      'grass-to-sand',
      'Grass to Sand',
      3,
      3,
    );
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'grass',
      width: 3,
      height: 3,
      layers: [makeLayer('grass', 3, 3), existingTransLayer],
      transitionMap,
      materials,
    });
    const transLayers = result.updatedLayers.filter(
      (l) => l.terrainKey === 'grass-to-sand',
    );
    expect(transLayers.length).toBe(1);
  });
});

describe('createTransitionLayer', () => {
  it('should create an EditorLayer with all frames initialized to 0', () => {
    const layer = createTransitionLayer('grass-sand', 'Grass to Sand', 3, 2);
    expect(layer.terrainKey).toBe('grass-sand');
    expect(layer.name).toBe('Grass to Sand');
    expect(layer.frames).toHaveLength(2); // height = 2 rows
    expect(layer.frames[0]).toHaveLength(3); // width = 3 cols
    expect(layer.frames[0][0]).toBe(0);
    expect(layer.frames[1][2]).toBe(0);
    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
  });

  it('should set id to "transition-{tilesetKey}"', () => {
    const layer = createTransitionLayer('water-grass', 'Water Grass', 2, 2);
    expect(layer.id).toBe('transition-water-grass');
  });
});
