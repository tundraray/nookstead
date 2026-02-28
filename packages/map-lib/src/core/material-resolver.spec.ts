import {
  buildTransitionMap,
  resolvePaint,
} from './material-resolver';
import type { TilesetInfo, MaterialInfo } from '../types/material-types';
import type { Cell } from '@nookstead/shared';

// --- Test fixtures ---

const grassMaterial: MaterialInfo = {
  key: 'grass',
  color: '#2d6a4f',
  walkable: true,
  renderPriority: 0,
};
const sandMaterial: MaterialInfo = {
  key: 'sand',
  color: '#e9c46a',
  walkable: true,
  renderPriority: 1,
};

const materials = new Map<string, MaterialInfo>([
  ['grass', grassMaterial],
  ['sand', sandMaterial],
]);

/** Transition tileset with resolved material keys. */
const transitionTileset: TilesetInfo = {
  key: 'grass-to-sand',
  name: 'Grass to Sand',
  fromMaterialKey: 'grass',
  toMaterialKey: 'sand',
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

  it('should skip tilesets without fromMaterialKey', () => {
    const tilesets: TilesetInfo[] = [
      { key: 'plain', name: 'Plain', toMaterialKey: 'sand' },
    ];
    const map = buildTransitionMap(tilesets, materials);
    expect(map.size).toBe(0);
  });

  it('should skip tilesets without toMaterialKey', () => {
    const tilesets: TilesetInfo[] = [
      { key: 'plain', name: 'Plain', fromMaterialKey: 'grass' },
    ];
    const map = buildTransitionMap(tilesets, materials);
    expect(map.size).toBe(0);
  });

  it('should skip tilesets referencing unknown material keys', () => {
    const tilesets: TilesetInfo[] = [
      {
        key: 'unknown-transition',
        name: 'Unknown',
        fromMaterialKey: 'grass',
        toMaterialKey: 'lava',
      },
    ];
    const map = buildTransitionMap(tilesets, materials);
    expect(map.size).toBe(0);
  });

  it('should handle multiple tilesets', () => {
    const waterMaterial: MaterialInfo = {
      key: 'water',
      color: '#219ebc',
      walkable: false,
      renderPriority: 2,
    };
    const extMaterials = new Map([...materials, ['water', waterMaterial]]);
    const tilesets: TilesetInfo[] = [
      transitionTileset,
      {
        key: 'grass-to-water',
        name: 'Grass to Water',
        fromMaterialKey: 'grass',
        toMaterialKey: 'water',
      },
    ];
    const map = buildTransitionMap(tilesets, extMaterials);
    expect(map.size).toBe(2);
    expect(map.has('grass:sand')).toBe(true);
    expect(map.has('grass:water')).toBe(true);
  });
});

describe('resolvePaint', () => {
  it('should set grid[y][x].terrain to materialKey', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'sand',
      width: 3,
      height: 3,
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
      materials,
    });
    expect(grid[1][1].terrain).toBe('grass');
  });

  it('should include painted cell and all in-bounds neighbors in affectedCells', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'sand',
      width: 3,
      height: 3,
      materials,
    });
    // Center cell + 8 neighbors = 9 cells
    expect(result.affectedCells.length).toBe(9);
    expect(result.affectedCells.some((c) => c.x === 1 && c.y === 1)).toBe(
      true,
    );
  });

  it('should NOT include updatedLayers in result', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'sand',
      width: 3,
      height: 3,
      materials,
    });
    expect('updatedLayers' in result).toBe(false);
  });

  it('should return unchanged state for out-of-bounds coordinates', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 10,
      y: 10,
      materialKey: 'sand',
      width: 3,
      height: 3,
      materials,
    });
    // Grid reference should be the same object (unchanged)
    expect(result.updatedGrid).toBe(grid);
    expect(result.affectedCells).toHaveLength(0);
  });

  it('should return unchanged state for negative coordinates', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: -1,
      y: -1,
      materialKey: 'sand',
      width: 3,
      height: 3,
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
      materials,
    });
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].message).toContain('Unknown material key');
    expect(result.affectedCells).toHaveLength(0);
  });

  it('should return empty warnings for valid paint on homogeneous grid', () => {
    const grid = makeGrid(3, 3, 'grass');
    const result = resolvePaint({
      grid,
      x: 1,
      y: 1,
      materialKey: 'sand',
      width: 3,
      height: 3,
      materials,
    });
    expect(result.warnings).toHaveLength(0);
  });
});
