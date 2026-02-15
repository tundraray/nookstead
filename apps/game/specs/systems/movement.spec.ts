import {
  calculateMovement,
  getTerrainSpeedModifier,
  type MovementInput,
} from '../../src/game/systems/movement';
import type { Grid, Cell } from '../../src/game/mapgen/types';

/**
 * Helper: create a Cell with the given terrain type.
 */
function makeCell(terrain: 'grass' | 'water' | 'deep_water'): Cell {
  return { terrain, elevation: 0, meta: {} };
}

/**
 * Helper: build a uniform grid filled with a single terrain type.
 * Grid uses row-major [y][x] indexing.
 */
function makeGrid(
  width: number,
  height: number,
  terrain: 'grass' | 'water' | 'deep_water' = 'grass'
): Grid {
  const grid: Grid = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(makeCell(terrain));
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Helper: build a uniform walkable grid.
 * Uses row-major [y][x] indexing.
 */
function makeWalkable(
  width: number,
  height: number,
  value = true
): boolean[][] {
  const walkable: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(value);
    }
    walkable.push(row);
  }
  return walkable;
}

/**
 * Helper: create a default MovementInput for a 4x4 tile map
 * with all-grass, all-walkable terrain and tileSize 16.
 */
function defaultInput(overrides?: Partial<MovementInput>): MovementInput {
  const mapWidth = 4;
  const mapHeight = 4;
  const tileSize = 16;
  return {
    position: { x: 32, y: 32 },
    direction: { x: 0, y: 0 },
    speed: 100,
    delta: 16,
    walkable: makeWalkable(mapWidth, mapHeight),
    grid: makeGrid(mapWidth, mapHeight),
    mapWidth,
    mapHeight,
    tileSize,
    ...overrides,
  };
}

describe('calculateMovement', () => {
  describe('cardinal movement at correct speed', () => {
    it('should move right at 100px/sec * 1.0 terrain * 16ms delta', () => {
      const input = defaultInput({
        direction: { x: 1, y: 0 },
      });
      const result = calculateMovement(input);
      // displacement = 1 * 100 * 1.0 * (16/1000) = 1.6
      expect(result.x).toBeCloseTo(32 + 1.6, 5);
      expect(result.y).toBeCloseTo(32, 5);
      expect(result.blocked.x).toBe(false);
      expect(result.blocked.y).toBe(false);
    });

    it('should move left at correct speed', () => {
      const input = defaultInput({
        direction: { x: -1, y: 0 },
      });
      const result = calculateMovement(input);
      expect(result.x).toBeCloseTo(32 - 1.6, 5);
      expect(result.y).toBeCloseTo(32, 5);
    });

    it('should move down at correct speed', () => {
      const input = defaultInput({
        direction: { x: 0, y: 1 },
      });
      const result = calculateMovement(input);
      expect(result.x).toBeCloseTo(32, 5);
      expect(result.y).toBeCloseTo(32 + 1.6, 5);
    });

    it('should move up at correct speed', () => {
      const input = defaultInput({
        direction: { x: 0, y: -1 },
      });
      const result = calculateMovement(input);
      expect(result.x).toBeCloseTo(32, 5);
      expect(result.y).toBeCloseTo(32 - 1.6, 5);
    });
  });

  describe('zero direction input', () => {
    it('should not move when direction is {0, 0}', () => {
      const input = defaultInput({
        direction: { x: 0, y: 0 },
      });
      const result = calculateMovement(input);
      expect(result.x).toBe(32);
      expect(result.y).toBe(32);
      expect(result.blocked.x).toBe(false);
      expect(result.blocked.y).toBe(false);
    });
  });

  describe('diagonal movement', () => {
    it('should apply direction components independently (caller normalizes)', () => {
      // Caller provides normalized diagonal direction:
      // direction = (1/sqrt(2), 1/sqrt(2)) approx (0.7071, 0.7071)
      const norm = 1 / Math.sqrt(2);
      const input = defaultInput({
        direction: { x: norm, y: norm },
      });
      const result = calculateMovement(input);
      // dx = 0.7071 * 100 * 1.0 * (16/1000) = ~1.1314
      const expectedDisplacement = norm * 100 * 1.0 * (16 / 1000);
      expect(result.x).toBeCloseTo(32 + expectedDisplacement, 4);
      expect(result.y).toBeCloseTo(32 + expectedDisplacement, 4);
    });

    it('should handle unnormalized diagonal (caller responsibility)', () => {
      // If caller passes {1, 1} unnormalized, movement is faster (by design - caller normalizes)
      const input = defaultInput({
        direction: { x: 1, y: 1 },
      });
      const result = calculateMovement(input);
      // dx = 1 * 100 * 1.0 * (16/1000) = 1.6
      expect(result.x).toBeCloseTo(32 + 1.6, 5);
      expect(result.y).toBeCloseTo(32 + 1.6, 5);
    });
  });

  describe('terrain speed modifier application', () => {
    it('should apply 0.5 speed modifier from water terrain', () => {
      // Create a grid with water terrain (speedModifier = 0.5)
      const grid = makeGrid(4, 4, 'water');
      const walkable = makeWalkable(4, 4); // Force walkable for test
      const input = defaultInput({
        direction: { x: 1, y: 0 },
        grid,
        walkable,
      });
      const result = calculateMovement(input);
      // displacement = 1 * 100 * 0.5 * (16/1000) = 0.8
      expect(result.x).toBeCloseTo(32 + 0.8, 5);
      expect(result.y).toBeCloseTo(32, 5);
    });

    it('should apply 1.0 speed modifier from grass terrain', () => {
      const input = defaultInput({
        direction: { x: 1, y: 0 },
      });
      const result = calculateMovement(input);
      // displacement = 1 * 100 * 1.0 * (16/1000) = 1.6
      expect(result.x).toBeCloseTo(32 + 1.6, 5);
    });
  });

  describe('collision prevents entering unwalkable tile', () => {
    it('should block X movement into unwalkable tile', () => {
      // Position at (47, 32) = tile (2, 2). Tile (3, 2) is unwalkable.
      // Use moderate speed so displacement only crosses one tile boundary.
      const walkable = makeWalkable(8, 8);
      const grid = makeGrid(8, 8);
      walkable[2][3] = false; // [y][x] row-major
      const input = defaultInput({
        position: { x: 47, y: 32 }, // Near right edge of tile 2
        direction: { x: 1, y: 0 },
        speed: 100, // displacement = 100 * 1.0 * 0.05 = 5px -> lands on tile 3
        delta: 50,
        walkable,
        grid,
        mapWidth: 8,
        mapHeight: 8,
      });
      const result = calculateMovement(input);
      // candidateX = 47+5 = 52, floor(52/16) = 3 (unwalkable), so blocked
      expect(result.blocked.x).toBe(true);
      // Position should stay at 47
      expect(result.x).toBe(47);
    });

    it('should block Y movement into unwalkable tile', () => {
      const walkable = makeWalkable(8, 8);
      const grid = makeGrid(8, 8);
      walkable[3][2] = false; // [y][x] row-major - tile below (2,2) is unwalkable
      const input = defaultInput({
        position: { x: 32, y: 47 }, // Near bottom edge of tile 2
        direction: { x: 0, y: 1 },
        speed: 100, // displacement = 100 * 1.0 * 0.05 = 5px -> lands on tile 3
        delta: 50,
        walkable,
        grid,
        mapWidth: 8,
        mapHeight: 8,
      });
      const result = calculateMovement(input);
      // candidateY = 47+5 = 52, floor(52/16) = 3 (unwalkable), so blocked
      expect(result.blocked.y).toBe(true);
      // Position should stay at 47
      expect(result.y).toBe(47);
    });
  });

  describe('wall-sliding', () => {
    it('should slide along Y when X is blocked (diagonal into wall)', () => {
      // Use 8x8 map so Y movement stays in bounds
      const walkable = makeWalkable(8, 8);
      const grid = makeGrid(8, 8);
      walkable[2][3] = false; // Block tile to the right [y][x]
      const input = defaultInput({
        position: { x: 47, y: 32 }, // Near right edge of tile 2
        direction: { x: 1, y: 1 }, // Moving diagonally right-down
        speed: 100,
        delta: 50,
        walkable,
        grid,
        mapWidth: 8,
        mapHeight: 8,
      });
      const result = calculateMovement(input);
      // X should be blocked (can't enter tile 3)
      expect(result.blocked.x).toBe(true);
      // Y should NOT be blocked (tile below is walkable)
      expect(result.blocked.y).toBe(false);
      // Y should have moved
      expect(result.y).toBeGreaterThan(32);
    });

    it('should slide along X when Y is blocked (diagonal into wall)', () => {
      const walkable = makeWalkable(8, 8);
      const grid = makeGrid(8, 8);
      walkable[3][2] = false; // Block tile below [y][x]
      const input = defaultInput({
        position: { x: 32, y: 47 }, // Near bottom edge of tile 2
        direction: { x: 1, y: 1 }, // Moving diagonally right-down
        speed: 100,
        delta: 50,
        walkable,
        grid,
        mapWidth: 8,
        mapHeight: 8,
      });
      const result = calculateMovement(input);
      // X should NOT be blocked
      expect(result.blocked.x).toBe(false);
      // Y should be blocked
      expect(result.blocked.y).toBe(true);
      // X should have moved
      expect(result.x).toBeGreaterThan(32);
    });

    it('should block both axes when moving diagonally into corner', () => {
      const walkable = makeWalkable(8, 8);
      const grid = makeGrid(8, 8);
      walkable[2][3] = false; // Block right [y][x]
      walkable[3][2] = false; // Block below [y][x]
      walkable[3][3] = false; // Block diagonal [y][x]
      const input = defaultInput({
        position: { x: 47, y: 47 }, // Near corner
        direction: { x: 1, y: 1 },
        speed: 100,
        delta: 50,
        walkable,
        grid,
        mapWidth: 8,
        mapHeight: 8,
      });
      const result = calculateMovement(input);
      expect(result.blocked.x).toBe(true);
      expect(result.blocked.y).toBe(true);
    });
  });

  describe('map boundary clamping', () => {
    it('should clamp X to 0 when moving left past map boundary', () => {
      const input = defaultInput({
        position: { x: 0.5, y: 32 },
        direction: { x: -1, y: 0 },
        speed: 100,
        delta: 50,
      });
      const result = calculateMovement(input);
      expect(result.x).toBeGreaterThanOrEqual(0);
    });

    it('should clamp X to mapWidth*tileSize-1 when moving right past boundary', () => {
      const input = defaultInput({
        position: { x: 62, y: 32 }, // Near right edge of 4*16=64
        direction: { x: 1, y: 0 },
        speed: 10000,
        delta: 50,
      });
      const result = calculateMovement(input);
      expect(result.x).toBeLessThanOrEqual(4 * 16 - 1);
    });

    it('should clamp Y to 0 when moving up past map boundary', () => {
      const input = defaultInput({
        position: { x: 32, y: 0.5 },
        direction: { x: 0, y: -1 },
        speed: 100,
        delta: 50,
      });
      const result = calculateMovement(input);
      expect(result.y).toBeGreaterThanOrEqual(0);
    });

    it('should clamp Y to mapHeight*tileSize-1 when moving down past boundary', () => {
      const input = defaultInput({
        position: { x: 32, y: 62 }, // Near bottom edge
        direction: { x: 0, y: 1 },
        speed: 10000,
        delta: 50,
      });
      const result = calculateMovement(input);
      expect(result.y).toBeLessThanOrEqual(4 * 16 - 1);
    });
  });

  describe('delta clamping to 50ms', () => {
    it('should clamp delta=200ms to 50ms, limiting movement distance', () => {
      const input = defaultInput({
        direction: { x: 1, y: 0 },
        delta: 200,
      });
      const result = calculateMovement(input);
      // If clamped to 50ms: displacement = 1 * 100 * 1.0 * (50/1000) = 5.0
      // If NOT clamped (200ms): displacement = 1 * 100 * 1.0 * (200/1000) = 20.0
      const expectedClamped = 32 + 5.0;
      expect(result.x).toBeCloseTo(expectedClamped, 5);
    });

    it('should not clamp delta when delta <= 50ms', () => {
      const input = defaultInput({
        direction: { x: 1, y: 0 },
        delta: 30,
      });
      const result = calculateMovement(input);
      // displacement = 1 * 100 * 1.0 * (30/1000) = 3.0
      expect(result.x).toBeCloseTo(32 + 3.0, 5);
    });

    it('should use exactly 50ms when delta is 50ms', () => {
      const input = defaultInput({
        direction: { x: 1, y: 0 },
        delta: 50,
      });
      const result = calculateMovement(input);
      // displacement = 1 * 100 * 1.0 * (50/1000) = 5.0
      expect(result.x).toBeCloseTo(32 + 5.0, 5);
    });
  });
});

describe('getTerrainSpeedModifier', () => {
  it('should return 1.0 for grass terrain', () => {
    const grid = makeGrid(4, 4, 'grass');
    const result = getTerrainSpeedModifier(32, 32, grid, 16);
    expect(result).toBe(1.0);
  });

  it('should return 0.5 for water terrain', () => {
    const grid = makeGrid(4, 4, 'water');
    const result = getTerrainSpeedModifier(32, 32, grid, 16);
    expect(result).toBe(0.5);
  });

  it('should return 0 for deep_water terrain', () => {
    const grid = makeGrid(4, 4, 'deep_water');
    const result = getTerrainSpeedModifier(32, 32, grid, 16);
    expect(result).toBe(0);
  });

  it('should convert pixel coords to tile coords correctly', () => {
    // Position (24, 40) should be tile (1, 2) with tileSize 16
    const grid = makeGrid(4, 4, 'grass');
    grid[2][1] = makeCell('water'); // [y][x] row-major
    const result = getTerrainSpeedModifier(24, 40, grid, 16);
    expect(result).toBe(0.5);
  });

  it('should handle position at tile origin (0, 0)', () => {
    const grid = makeGrid(4, 4, 'grass');
    const result = getTerrainSpeedModifier(0, 0, grid, 16);
    expect(result).toBe(1.0);
  });
});
