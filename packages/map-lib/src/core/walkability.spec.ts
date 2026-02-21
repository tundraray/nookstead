import { recomputeWalkability } from './walkability';
import type { MaterialInfo } from '../types/material-types';
import type { Cell } from '@nookstead/shared';

/**
 * Helper to create a Cell with the given terrain.
 */
function makeCell(terrain: string): Cell {
  return { terrain, elevation: 0, meta: {} } as Cell;
}

const grassMaterial: MaterialInfo = { key: 'grass', walkable: true, renderPriority: 0 };
const waterMaterial: MaterialInfo = { key: 'water', walkable: false, renderPriority: 1 };

describe('recomputeWalkability', () => {
  it('should return true for walkable terrain', () => {
    const grid: Cell[][] = [[makeCell('grass')]];
    const materials = new Map([['grass', grassMaterial]]);
    const result = recomputeWalkability(grid, 1, 1, materials);
    expect(result[0][0]).toBe(true);
  });

  it('should return false for non-walkable terrain', () => {
    const grid: Cell[][] = [[makeCell('water')]];
    const materials = new Map([['water', waterMaterial]]);
    const result = recomputeWalkability(grid, 1, 1, materials);
    expect(result[0][0]).toBe(false);
  });

  it('should default to walkable (true) for unknown terrain', () => {
    const grid: Cell[][] = [[makeCell('unknown_terrain' as Cell['terrain'])]];
    const materials = new Map<string, MaterialInfo>();
    const result = recomputeWalkability(grid, 1, 1, materials);
    expect(result[0][0]).toBe(true);
  });

  it('should handle mixed terrain correctly', () => {
    const grid: Cell[][] = [[makeCell('grass'), makeCell('water')]];
    const materials = new Map<string, MaterialInfo>([
      ['grass', grassMaterial],
      ['water', waterMaterial],
    ]);
    const result = recomputeWalkability(grid, 2, 1, materials);
    expect(result[0][0]).toBe(true);
    expect(result[0][1]).toBe(false);
  });

  it('should handle multi-row grids', () => {
    const grid: Cell[][] = [
      [makeCell('grass'), makeCell('grass')],
      [makeCell('water'), makeCell('grass')],
    ];
    const materials = new Map<string, MaterialInfo>([
      ['grass', grassMaterial],
      ['water', waterMaterial],
    ]);
    const result = recomputeWalkability(grid, 2, 2, materials);
    expect(result[0][0]).toBe(true);
    expect(result[0][1]).toBe(true);
    expect(result[1][0]).toBe(false);
    expect(result[1][1]).toBe(true);
  });
});
