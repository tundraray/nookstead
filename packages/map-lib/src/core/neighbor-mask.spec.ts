import { computeNeighborMask, computeNeighborMaskByMaterial, checkTerrainPresence } from './neighbor-mask';
import type { TilesetInfo } from '../types/material-types';
import type { Cell } from '@nookstead/shared';
import { N, S, E, W, NE, NW, SE, SW } from './autotile';

/**
 * Helper to create a uniform grid of cells with the given terrain name.
 * Cell requires terrain, elevation, and meta fields.
 */
function makeGrid(width: number, height: number, terrain: string): Cell[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ terrain, elevation: 0, meta: {} }) as Cell),
  );
}

/**
 * Tileset lookup: checkTerrainPresence compares the cell's terrain string
 * against the tileset entry's `fromMaterialKey` field (falling back to `name`).
 * So for a cell with terrain "grass", the tileset entry must have fromMaterialKey: "grass".
 */
const tilesets: TilesetInfo[] = [{ key: 'terrain-01', name: 'Grass', fromMaterialKey: 'grass' }];

describe('computeNeighborMask', () => {
  it('should set all bits for center cell with all same-terrain neighbors (OOB=true default)', () => {
    const grid = makeGrid(3, 3, 'grass');
    const mask = computeNeighborMask(grid, 1, 1, 3, 3, 'terrain-01', tilesets);
    expect(mask).toBe(N | NE | E | SE | S | SW | W | NW);
  });

  it('should set OOB neighbor bits when outOfBoundsMatches is true (top-left corner)', () => {
    const grid = makeGrid(3, 3, 'grass');
    // corner cell (0,0): N, NW, W are OOB -- with OOB=true these bits should be set
    const mask = computeNeighborMask(grid, 0, 0, 3, 3, 'terrain-01', tilesets, {
      outOfBoundsMatches: true,
    });
    expect(mask & N).toBe(N); // N is OOB, should be set
    expect(mask & NW).toBe(NW); // NW is OOB, should be set
    expect(mask & W).toBe(W); // W is OOB, should be set
  });

  it('should clear OOB neighbor bits when outOfBoundsMatches is false (top-left corner)', () => {
    const grid = makeGrid(3, 3, 'grass');
    const mask = computeNeighborMask(grid, 0, 0, 3, 3, 'terrain-01', tilesets, {
      outOfBoundsMatches: false,
    });
    expect(mask & N).toBe(0); // N is OOB, should be clear
    expect(mask & NW).toBe(0); // NW is OOB, should be clear
    expect(mask & W).toBe(0); // W is OOB, should be clear
  });

  it('should return 0 for center cell surrounded by different terrain', () => {
    // Build a 3x3 grid where only center is grass, all others are sand
    const grid = makeGrid(3, 3, 'sand');
    grid[1][1] = { terrain: 'grass', elevation: 0, meta: {} } as Cell;
    // All 8 neighbors are "sand", not matching terrain-01 (name: "grass")
    const mask = computeNeighborMask(grid, 1, 1, 3, 3, 'terrain-01', tilesets);
    expect(mask).toBe(0);
  });

  it('should return 255 for a center cell on a 5x5 uniform-terrain grid', () => {
    const grid = makeGrid(5, 5, 'grass');
    const mask = computeNeighborMask(grid, 2, 2, 5, 5, 'terrain-01', tilesets);
    expect(mask).toBe(255); // all 8 directions match
  });

  it('should handle bottom-right corner with OOB=false', () => {
    const grid = makeGrid(3, 3, 'grass');
    // corner cell (2,2): S, SE, E are OOB
    const mask = computeNeighborMask(grid, 2, 2, 3, 3, 'terrain-01', tilesets, {
      outOfBoundsMatches: false,
    });
    expect(mask & S).toBe(0);
    expect(mask & SE).toBe(0);
    expect(mask & E).toBe(0);
    // N, NW, W should still be set (in-bounds grass neighbors)
    expect(mask & N).toBe(N);
    expect(mask & W).toBe(W);
    expect(mask & NW).toBe(NW);
  });

  it('should handle bottom-right corner with OOB=true (default)', () => {
    const grid = makeGrid(3, 3, 'grass');
    // corner cell (2,2): S, SE, E are OOB -- with OOB=true these should be set
    const mask = computeNeighborMask(grid, 2, 2, 3, 3, 'terrain-01', tilesets);
    expect(mask).toBe(255); // all neighbors match (in-bounds = grass, OOB = true)
  });
});

describe('checkTerrainPresence', () => {
  it('should return true when terrain matches the tileset name', () => {
    expect(checkTerrainPresence('grass', 'terrain-01', tilesets)).toBe(true);
  });

  it('should return false when terrain does not match the tileset name', () => {
    expect(checkTerrainPresence('sand', 'terrain-01', tilesets)).toBe(false);
  });

  it('should return false when terrainKey is not found in tilesets', () => {
    expect(checkTerrainPresence('grass', 'terrain-99', tilesets)).toBe(false);
  });

  it('should handle empty tilesets array', () => {
    expect(checkTerrainPresence('grass', 'terrain-01', [])).toBe(false);
  });
});

describe('computeNeighborMaskByMaterial', () => {
  it('should set all bits for center cell with all same-material neighbors', () => {
    const grid = makeGrid(3, 3, 'grass');
    const mask = computeNeighborMaskByMaterial(grid, 1, 1, 3, 3, 'grass');
    expect(mask).toBe(N | NE | E | SE | S | SW | W | NW);
  });

  it('should return 0 for center cell surrounded by different material', () => {
    const grid = makeGrid(3, 3, 'sand');
    grid[1][1] = { terrain: 'grass', elevation: 0, meta: {} } as Cell;
    const mask = computeNeighborMaskByMaterial(grid, 1, 1, 3, 3, 'grass');
    expect(mask).toBe(0);
  });

  it('should set OOB bits when outOfBoundsMatches is true (top-left corner)', () => {
    const grid = makeGrid(3, 3, 'grass');
    const mask = computeNeighborMaskByMaterial(grid, 0, 0, 3, 3, 'grass', {
      outOfBoundsMatches: true,
    });
    expect(mask & N).toBe(N);
    expect(mask & NW).toBe(NW);
    expect(mask & W).toBe(W);
  });

  it('should clear OOB bits when outOfBoundsMatches is false (top-left corner)', () => {
    const grid = makeGrid(3, 3, 'grass');
    const mask = computeNeighborMaskByMaterial(grid, 0, 0, 3, 3, 'grass', {
      outOfBoundsMatches: false,
    });
    expect(mask & N).toBe(0);
    expect(mask & NW).toBe(0);
    expect(mask & W).toBe(0);
  });

  it('should handle bottom-right corner with OOB=false', () => {
    const grid = makeGrid(3, 3, 'grass');
    const mask = computeNeighborMaskByMaterial(grid, 2, 2, 3, 3, 'grass', {
      outOfBoundsMatches: false,
    });
    expect(mask & S).toBe(0);
    expect(mask & SE).toBe(0);
    expect(mask & E).toBe(0);
    expect(mask & N).toBe(N);
    expect(mask & W).toBe(W);
    expect(mask & NW).toBe(NW);
  });

  it('should handle edge cell (top edge, non-corner)', () => {
    const grid = makeGrid(3, 3, 'grass');
    const mask = computeNeighborMaskByMaterial(grid, 1, 0, 3, 3, 'grass');
    // N, NE, NW are OOB (default true), rest are in-bounds grass
    expect(mask).toBe(255);
  });

  it('should return 255 for center cell on a 5x5 uniform grid', () => {
    const grid = makeGrid(5, 5, 'grass');
    const mask = computeNeighborMaskByMaterial(grid, 2, 2, 5, 5, 'grass');
    expect(mask).toBe(255);
  });

  it('should only match exact material strings', () => {
    const grid = makeGrid(3, 3, 'grass_sand');
    grid[1][1] = { terrain: 'grass', elevation: 0, meta: {} } as Cell;
    // 'grass' !== 'grass_sand' — no neighbor should match
    const mask = computeNeighborMaskByMaterial(grid, 1, 1, 3, 3, 'grass');
    expect(mask).toBe(0);
  });
});


