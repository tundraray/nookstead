import { computeBitmask } from '../src/components/transition-test-canvas';
import { getFrame } from '@nookstead/map-lib';

type CellValue = 'A' | 'B';

function createGrid(size: number, fill: CellValue = 'B'): CellValue[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => fill)
  );
}

describe('computeBitmask', () => {
  it('returns 0 for an isolated A cell surrounded by B', () => {
    const grid = createGrid(10);
    grid[5][5] = 'A';

    const mask = computeBitmask(grid, 5, 5);
    expect(mask).toBe(0);

    // getFrame(0) should return the isolated frame (47)
    expect(getFrame(mask)).toBe(47);
  });

  it('returns 255 for center of a 3x3 A block', () => {
    const grid = createGrid(10);
    for (let r = 4; r <= 6; r++) {
      for (let c = 4; c <= 6; c++) {
        grid[r][c] = 'A';
      }
    }

    const mask = computeBitmask(grid, 5, 5);
    expect(mask).toBe(255);

    // getFrame(255) should return the solid/fully-enclosed frame (1)
    expect(getFrame(mask)).toBe(1);
  });

  it('computes correct mask for edge cell in a 3x3 block', () => {
    const grid = createGrid(10);
    for (let r = 4; r <= 6; r++) {
      for (let c = 4; c <= 6; c++) {
        grid[r][c] = 'A';
      }
    }

    // Top-center of the block (row=4, col=5) has neighbors: E, SE, S, SW, W
    // N=0, NE=0, E=4, SE=8, S=16, SW=32, W=64, NW=0
    const mask = computeBitmask(grid, 4, 5);
    // E + SE + S + SW + W = 4 + 8 + 16 + 32 + 64 = 124
    expect(mask).toBe(124);
  });

  it('computes correct mask for corner cell in a 3x3 block', () => {
    const grid = createGrid(10);
    for (let r = 4; r <= 6; r++) {
      for (let c = 4; c <= 6; c++) {
        grid[r][c] = 'A';
      }
    }

    // Top-left corner (row=4, col=4) has neighbors: E, SE, S
    // E=4, SE=8, S=16
    const mask = computeBitmask(grid, 4, 4);
    expect(mask).toBe(4 + 8 + 16); // 28
  });

  it('handles cells at grid boundary (top-left corner)', () => {
    const grid = createGrid(10);
    grid[0][0] = 'A';
    grid[0][1] = 'A';
    grid[1][0] = 'A';
    grid[1][1] = 'A';

    // (0,0): out-of-bounds neighbors treated as absent
    // E=4, SE=8, S=16
    const mask = computeBitmask(grid, 0, 0);
    expect(mask).toBe(4 + 8 + 16); // 28
  });

  it('returns 0 for a B cell (not A)', () => {
    const grid = createGrid(10);
    // All B, asking about a B cell
    const mask = computeBitmask(grid, 5, 5);
    // All neighbors are B, not A, so mask is 0
    expect(mask).toBe(0);
  });

  it('computes vertical corridor correctly', () => {
    const grid = createGrid(10);
    grid[3][5] = 'A';
    grid[4][5] = 'A';
    grid[5][5] = 'A';

    // Middle cell (4,5): N=1, S=16
    const mask = computeBitmask(grid, 4, 5);
    expect(mask).toBe(1 + 16); // 17
    // Frame for vertical corridor
    expect(getFrame(mask)).toBe(33);
  });

  it('computes horizontal corridor correctly', () => {
    const grid = createGrid(10);
    grid[5][3] = 'A';
    grid[5][4] = 'A';
    grid[5][5] = 'A';

    // Middle cell (5,4): E=4, W=64
    const mask = computeBitmask(grid, 5, 4);
    expect(mask).toBe(4 + 64); // 68
    // Frame for horizontal corridor
    expect(getFrame(mask)).toBe(34);
  });
});
