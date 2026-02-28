import { findSpawnTile, isValidSpawn } from '@nookstead/shared';
import type { SpawnTile } from '@nookstead/shared';
import { Grid, TerrainCellType } from '../../src/game/mapgen/types';

/**
 * Creates a uniform grid and walkable array for testing.
 * All cells share the same terrain type.
 */
function makeGrid(
  width: number,
  height: number,
  terrain: TerrainCellType = 'grass'
): { walkable: boolean[][]; grid: Grid } {
  const grid: Grid = [];
  const walkable: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    walkable[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = { terrain, elevation: 0, meta: {} };
      walkable[y][x] = terrain !== 'deep_water' && terrain !== 'water';
    }
  }
  return { walkable, grid };
}

/**
 * Sets a single cell to a specific terrain type and updates walkability.
 */
function setCell(
  grid: Grid,
  walkable: boolean[][],
  x: number,
  y: number,
  terrain: TerrainCellType
): void {
  grid[y][x] = { terrain, elevation: 0, meta: {} };
  walkable[y][x] = terrain !== 'deep_water' && terrain !== 'water';
}

describe('spawn system', () => {
  describe('isValidSpawn', () => {
    it('should return true for a walkable grass tile', () => {
      const { walkable, grid } = makeGrid(5, 5, 'grass');
      expect(isValidSpawn(2, 2, walkable, grid)).toBe(true);
    });

    it('should return false for a water tile', () => {
      const { walkable, grid } = makeGrid(5, 5, 'water');
      expect(isValidSpawn(2, 2, walkable, grid)).toBe(false);
    });

    it('should return false for a deep_water tile', () => {
      const { walkable, grid } = makeGrid(5, 5, 'deep_water');
      expect(isValidSpawn(2, 2, walkable, grid)).toBe(false);
    });

    it('should return false for out-of-bounds coordinates', () => {
      const { walkable, grid } = makeGrid(5, 5, 'grass');
      expect(isValidSpawn(-1, 2, walkable, grid)).toBe(false);
      expect(isValidSpawn(2, -1, walkable, grid)).toBe(false);
      expect(isValidSpawn(5, 2, walkable, grid)).toBe(false);
      expect(isValidSpawn(2, 5, walkable, grid)).toBe(false);
    });
  });

  describe('findSpawnTile', () => {
    it('should find grass tile at exact center when center is grass', () => {
      const { walkable, grid } = makeGrid(5, 5, 'grass');
      const result: SpawnTile = findSpawnTile(walkable, grid, 5, 5);
      expect(result).toEqual({ tileX: 2, tileY: 2 });
    });

    it('should find nearest grass tile when center is water', () => {
      const { walkable, grid } = makeGrid(5, 5, 'grass');
      // Set center to water
      setCell(grid, walkable, 2, 2, 'water');
      const result = findSpawnTile(walkable, grid, 5, 5);
      // Should find one of the tiles at radius 1 from center
      const dx = Math.abs(result.tileX - 2);
      const dy = Math.abs(result.tileY - 2);
      expect(Math.max(dx, dy)).toBe(1);
      expect(isValidSpawn(result.tileX, result.tileY, walkable, grid)).toBe(true);
    });

    it('should fall back to any walkable tile when no grass exists', () => {
      // Create a map that is entirely deep_water (not walkable)
      const { walkable, grid } = makeGrid(5, 5, 'deep_water');
      // Place a single walkable non-grass tile (water is not walkable, so we need
      // to manually make one tile walkable but not grass)
      // Actually, we need a terrain that is walkable but not grass.
      // Looking at the terrain types: 'deep_water', 'water', 'grass'
      // Only 'grass' is walkable based on the makeGrid helper.
      // For the fallback test, we need a walkable non-grass tile.
      // We'll manually set walkable to true for a water cell to simulate
      // a walkable non-grass scenario.
      walkable[0][0] = true;
      // grid[0][0] remains water - walkable but not grass
      const result = findSpawnTile(walkable, grid, 5, 5);
      expect(result).toEqual({ tileX: 0, tileY: 0 });
    });

    it('should throw Error when no walkable tiles exist', () => {
      const { walkable, grid } = makeGrid(5, 5, 'deep_water');
      expect(() => findSpawnTile(walkable, grid, 5, 5)).toThrow(
        'No walkable tile found'
      );
    });

    it('should return center for all-grass map', () => {
      const { walkable, grid } = makeGrid(7, 7, 'grass');
      const result = findSpawnTile(walkable, grid, 7, 7);
      expect(result).toEqual({ tileX: 3, tileY: 3 });
    });

    it('should find single walkable tile at corner', () => {
      const { walkable, grid } = makeGrid(5, 5, 'deep_water');
      // Place a single grass tile at corner (4, 4)
      setCell(grid, walkable, 4, 4, 'grass');
      const result = findSpawnTile(walkable, grid, 5, 5);
      expect(result).toEqual({ tileX: 4, tileY: 4 });
    });

    it('should be deterministic for the same map layout', () => {
      const { walkable, grid } = makeGrid(5, 5, 'grass');
      setCell(grid, walkable, 2, 2, 'water');
      const result1 = findSpawnTile(walkable, grid, 5, 5);
      const result2 = findSpawnTile(walkable, grid, 5, 5);
      expect(result1).toEqual(result2);
    });

    it('should handle even-sized maps correctly', () => {
      const { walkable, grid } = makeGrid(6, 6, 'grass');
      const result = findSpawnTile(walkable, grid, 6, 6);
      // Center of 6x6 map: floor(6/2) = 3
      expect(result).toEqual({ tileX: 3, tileY: 3 });
    });

    it('should handle 1x1 grass map', () => {
      const { walkable, grid } = makeGrid(1, 1, 'grass');
      const result = findSpawnTile(walkable, grid, 1, 1);
      expect(result).toEqual({ tileX: 0, tileY: 0 });
    });

    it('should handle 1x1 non-walkable map by throwing', () => {
      const { walkable, grid } = makeGrid(1, 1, 'deep_water');
      expect(() => findSpawnTile(walkable, grid, 1, 1)).toThrow(
        'No walkable tile found'
      );
    });

    it('should find grass at corner (0, 0) when rest is water', () => {
      const { walkable, grid } = makeGrid(5, 5, 'deep_water');
      setCell(grid, walkable, 0, 0, 'grass');
      const result = findSpawnTile(walkable, grid, 5, 5);
      expect(result).toEqual({ tileX: 0, tileY: 0 });
    });

    it('should prefer grass closer to center over grass further away', () => {
      const { walkable, grid } = makeGrid(7, 7, 'deep_water');
      // Place grass at (1, 1) and (5, 5) - both far from center (3, 3)
      // Place grass at (2, 3) - radius 1 from center
      setCell(grid, walkable, 1, 1, 'grass');
      setCell(grid, walkable, 5, 5, 'grass');
      setCell(grid, walkable, 2, 3, 'grass');
      const result = findSpawnTile(walkable, grid, 7, 7);
      // (2, 3) is at radius 1 from center (3, 3), should be found first
      expect(result).toEqual({ tileX: 2, tileY: 3 });
    });
  });
});
