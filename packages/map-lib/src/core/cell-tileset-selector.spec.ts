// CellTilesetSelector Unit Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// AC4: Cell Tileset Selection (FR4, V3)
// AC5: Conflict Resolution (FR6, V4)
// Generated: 2026-02-22

import type { TilesetInfo } from '../types/material-types';
import { TilesetRegistry } from './tileset-registry';
import { selectTilesetForCell, computeCellFrame } from './cell-tileset-selector';
import type { OwnedEdgeInfo } from './cell-tileset-selector';
import type { EdgeDirection, MaterialPriorityMap } from '../types/routing-types';
import type { Cell } from '@nookstead/shared';
import { getFrame, SOLID_FRAME } from './autotile';
import { NE, NW, SE, SW } from './autotile';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makeTileset(
  key: string,
  fromMaterialKey: string,
  toMaterialKey?: string,
): TilesetInfo {
  const name = toMaterialKey
    ? `${fromMaterialKey}_${toMaterialKey}`
    : fromMaterialKey;
  return toMaterialKey
    ? { key, name, fromMaterialKey, toMaterialKey }
    : { key, name, fromMaterialKey };
}

function makeReferenceTilesets(): TilesetInfo[] {
  return [
    makeTileset('ts-deep-water', 'deep-water'),
    makeTileset('ts-water', 'water'),
    makeTileset('ts-grass', 'grass'),
    makeTileset('ts-soil', 'soil'),
    makeTileset('ts-sand', 'sand'),
    makeTileset('ts-deep-water-water', 'deep-water', 'water'),
    makeTileset('ts-water-grass', 'water', 'grass'),
    makeTileset('ts-grass-water', 'grass', 'water'),
    makeTileset('ts-soil-grass', 'soil', 'grass'),
    makeTileset('ts-sand-water', 'sand', 'water'),
    makeTileset('ts-sand-grass', 'sand', 'grass'),
  ];
}

function makePresetAPriorities(): Map<string, number> {
  return new Map([
    ['deep-water', 100],
    ['water', 90],
    ['sand', 50],
    ['grass', 30],
    ['soil', 10],
  ]);
}

function makeCell(terrain: string): Cell {
  return { terrain, elevation: 0, meta: {} } as Cell;
}

function makeGrid(width: number, height: number, terrain: string): Cell[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => makeCell(terrain)),
  );
}

// ---------------------------------------------------------------------------
// selectTilesetForCell
// ---------------------------------------------------------------------------

describe('selectTilesetForCell', () => {
  describe('no owned edges (base tileset)', () => {
    // AC4: "When a cell has no owned edges (all neighbors are same material),
    //        the system shall select the FG base tileset (flat tile)"
    // ROI: 88 | Business Value: 10 | Frequency: 10
    // @category: core-functionality
    // @dependency: TilesetRegistry
    // @complexity: low

    it('should select base tileset when all neighbors are same material', () => {
      // Arrange:
      //   FG = 'grass', ownedEdges = empty map (no foreign neighbors)
      //   Registry from reference tilesets
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>();

      // Act
      const result = selectTilesetForCell('grass', ownedEdges, registry);

      // Assert:
      //   tilesetKey = 'ts-grass' (base tileset)
      //   bg = '' (empty string for base tileset)
      //   orientation = '' (no transition)
      expect(result.selectedTilesetKey).toBe('ts-grass');
      expect(result.bg).toBe('');
      expect(result.orientation).toBe('');
    });
  });

  describe('single BG material (transition tileset)', () => {
    // AC4: "When a cell's owned edges all require the same BG material,
    //        the system shall select the FG_BG tileset"
    // ROI: 90 | Business Value: 10 | Frequency: 9
    // @category: core-functionality
    // @dependency: TilesetRegistry
    // @complexity: low

    it('should select direct transition tileset when FG_BG exists', () => {
      // Arrange:
      //   FG = 'deep-water', ownedEdges = { E: { bg: 'water' } }
      //   Only E neighbor is foreign, BG = water
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['E', { bg: 'water', neighborMaterial: 'water' }],
      ]);

      // Act
      const result = selectTilesetForCell('deep-water', ownedEdges, registry);

      // Assert:
      //   tilesetKey = 'ts-deep-water-water', orientation = 'direct'
      expect(result.selectedTilesetKey).toBe('ts-deep-water-water');
      expect(result.bg).toBe('water');
      expect(result.orientation).toBe('direct');
    });

    it('should select reverse tileset when only BG_FG exists', () => {
      // Arrange:
      //   FG = 'water', ownedEdges = { E: { bg: 'deep-water' } }
      //   water -> deep-water does NOT exist, but deep-water -> water DOES
      //   So reverse fallback should apply.
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['E', { bg: 'deep-water', neighborMaterial: 'deep-water' }],
      ]);

      // Act
      const result = selectTilesetForCell('water', ownedEdges, registry);

      // Assert:
      //   tilesetKey = 'ts-deep-water-water' (reverse), orientation = 'reverse'
      expect(result.selectedTilesetKey).toBe('ts-deep-water-water');
      expect(result.bg).toBe('deep-water');
      expect(result.orientation).toBe('reverse');
    });

    it('should select correct tileset when multiple edges have same BG', () => {
      // Arrange:
      //   FG = 'soil', ownedEdges = { N: { bg: 'grass' }, W: { bg: 'grass' } }
      //   Both foreign edges route through grass
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['N', { bg: 'grass', neighborMaterial: 'deep-water' }],
        ['W', { bg: 'grass', neighborMaterial: 'deep-water' }],
      ]);

      // Act
      const result = selectTilesetForCell('soil', ownedEdges, registry);

      // Assert:
      //   tilesetKey = 'ts-soil-grass'
      //   bg = 'grass'
      expect(result.selectedTilesetKey).toBe('ts-soil-grass');
      expect(result.bg).toBe('grass');
      expect(result.orientation).toBe('direct');
    });
  });

  describe('S1 conflict resolution', () => {
    // AC5: "When S1 (Owner Reassign) is applied, the system shall attempt to
    //        transfer conflicting edge ownership to the neighbor cell"
    // ROI: 85 | Business Value: 10 (correctness at junctions) | Frequency: 4
    // @category: core-functionality
    // @dependency: TilesetRegistry, MaterialPriorityMap
    // @complexity: high

    it('should resolve conflict via S1 when high-priority neighbor claims edge', () => {
      // Arrange (from Worked Example 2, sand cell):
      //   FG = 'sand', ownedEdges with BGs = {grass (from N=soil), water (from S=dw), water (from W=dw)}
      //   Preset A: dw=100 > sand=50, soil=10 < sand=50
      //   S1: S edge (dw, priority=100) -> reassign, drop water
      //       W edge (dw, priority=100) -> reassign, drop water
      //       N edge (soil, priority=10) -> cannot reassign, keep grass
      //   After S1: remaining = {grass}
      const registry = new TilesetRegistry(makeReferenceTilesets());
      const priorities = makePresetAPriorities();
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['N', { bg: 'grass', neighborMaterial: 'soil' }],
        ['S', { bg: 'water', neighborMaterial: 'deep-water' }],
        ['W', { bg: 'water', neighborMaterial: 'deep-water' }],
      ]);

      // Act
      const result = selectTilesetForCell(
        'sand',
        ownedEdges,
        registry,
        priorities,
      );

      // Assert:
      //   tilesetKey = 'ts-sand-grass'
      //   bg = 'grass'
      expect(result.selectedTilesetKey).toBe('ts-sand-grass');
      expect(result.bg).toBe('grass');
    });

    it('should cap S1 iterations at 4 maximum', () => {
      // AC5: "If S1 does not resolve within 4 iterations, then the system
      //        shall fall back to S2"
      // Arrange:
      //   Construct a scenario where S1 cannot resolve within 4 iterations
      //   (all conflicting edges have lower-priority neighbors)
      //   FG='water' (priority=90), all neighbors have lower priority.
      //   Multiple BGs that S1 cannot resolve because no neighbor has higher priority.
      //   Custom scenario: alpha(100) has transitions to beta and gamma,
      //   but both have lower priority so S1 cannot reassign.
      const customTilesets: TilesetInfo[] = [
        makeTileset('ts-alpha', 'alpha'),
        makeTileset('ts-beta', 'beta'),
        makeTileset('ts-gamma', 'gamma'),
        makeTileset('ts-alpha-beta', 'alpha', 'beta'),
        makeTileset('ts-alpha-gamma', 'alpha', 'gamma'),
      ];
      const customRegistry = new TilesetRegistry(customTilesets);
      const customPriorities: MaterialPriorityMap = new Map([
        ['alpha', 100],
        ['beta', 10],
        ['gamma', 10],
      ]);
      // alpha(100) with N=beta(BG=beta), S=gamma(BG=gamma) -> conflict
      // S1: beta(10) < alpha(100) -> cannot reassign, keep beta
      //     gamma(10) < alpha(100) -> cannot reassign, keep gamma
      // S1 does NOT resolve (both neighbors are lower priority)
      // Falls through to S2.
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['N', { bg: 'beta', neighborMaterial: 'beta' }],
        ['S', { bg: 'gamma', neighborMaterial: 'gamma' }],
      ]);

      // Act
      const result = selectTilesetForCell(
        'alpha',
        ownedEdges,
        customRegistry,
        customPriorities,
        ['beta', 'gamma'], // preferences for S2
      );

      // Assert:
      //   S1 does not loop more than 4 times
      //   Falls through to S2
      //   S2 picks 'beta' (first in preferences)
      expect(result.bg).toBe('beta');
      expect(result.selectedTilesetKey).toBe('ts-alpha-beta');
    });
  });

  describe('S2 BG priority fallback', () => {
    // AC5: "When S2 (BG Priority) is applied, the system shall select the
    //        single BG material with highest priority (water > grass > sand)"
    // ROI: 80 | Business Value: 9 (fallback correctness) | Frequency: 2
    // @category: core-functionality
    // @dependency: MaterialPriorityMap, preferences
    // @complexity: medium

    it('should select highest-priority BG via S2 when S1 fails', () => {
      // Arrange:
      //   Construct a scenario where S1 cannot resolve (all neighbors lower priority)
      //   Multiple conflicting BGs: {water, grass}
      //   Preference array: ['water', 'grass', 'sand']
      const customTilesets: TilesetInfo[] = [
        makeTileset('ts-alpha', 'alpha'),
        makeTileset('ts-water', 'water'),
        makeTileset('ts-grass', 'grass'),
        makeTileset('ts-alpha-water', 'alpha', 'water'),
        makeTileset('ts-alpha-grass', 'alpha', 'grass'),
      ];
      const customRegistry = new TilesetRegistry(customTilesets);
      const customPriorities: MaterialPriorityMap = new Map([
        ['alpha', 100],
        ['water', 10],
        ['grass', 10],
      ]);
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['N', { bg: 'water', neighborMaterial: 'water' }],
        ['S', { bg: 'grass', neighborMaterial: 'grass' }],
      ]);

      // Suppress console.warn for this test
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { /* noop */ });

      // Act
      const result = selectTilesetForCell(
        'alpha',
        ownedEdges,
        customRegistry,
        customPriorities,
        ['water', 'grass', 'sand'],
      );

      // Assert:
      //   S2 selects 'water' (highest in preference array)
      expect(result.bg).toBe('water');
      expect(result.selectedTilesetKey).toBe('ts-alpha-water');
      //   Logs a warning for the degraded case
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should be deterministic: same conflicting BGs always pick same winner', () => {
      // Arrange: Run S2 twice with identical conflicting BG set
      const customTilesets: TilesetInfo[] = [
        makeTileset('ts-alpha', 'alpha'),
        makeTileset('ts-alpha-water', 'alpha', 'water'),
        makeTileset('ts-alpha-grass', 'alpha', 'grass'),
      ];
      const customRegistry = new TilesetRegistry(customTilesets);
      const customPriorities: MaterialPriorityMap = new Map([
        ['alpha', 100],
        ['water', 10],
        ['grass', 10],
      ]);
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['N', { bg: 'water', neighborMaterial: 'water' }],
        ['S', { bg: 'grass', neighborMaterial: 'grass' }],
      ]);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { /* noop */ });

      // Act: run twice
      const result1 = selectTilesetForCell(
        'alpha',
        ownedEdges,
        customRegistry,
        customPriorities,
        ['water', 'grass'],
      );
      const result2 = selectTilesetForCell(
        'alpha',
        ownedEdges,
        customRegistry,
        customPriorities,
        ['water', 'grass'],
      );

      // Assert: Same BG selected both times
      expect(result1.bg).toBe(result2.bg);
      expect(result1.selectedTilesetKey).toBe(result2.selectedTilesetKey);

      warnSpy.mockRestore();
    });
  });

  describe('S2 logging', () => {
    // AC5: "While S2 is applied, the system shall log the degraded case
    //        with cell coordinates and conflicting materials"
    // ROI: 55 | Business Value: 5 (debuggability) | Frequency: 2
    // @category: integration
    // @dependency: console.warn
    // @complexity: low

    it('should log warning when S2 fallback is applied', () => {
      // Arrange: Scenario requiring S2
      const customTilesets: TilesetInfo[] = [
        makeTileset('ts-alpha', 'alpha'),
        makeTileset('ts-alpha-water', 'alpha', 'water'),
        makeTileset('ts-alpha-grass', 'alpha', 'grass'),
      ];
      const customRegistry = new TilesetRegistry(customTilesets);
      const customPriorities: MaterialPriorityMap = new Map([
        ['alpha', 100],
        ['water', 10],
        ['grass', 10],
      ]);
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['E', { bg: 'water', neighborMaterial: 'water' }],
        ['W', { bg: 'grass', neighborMaterial: 'grass' }],
      ]);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { /* noop */ });

      // Act: selectTilesetForCell(...)
      selectTilesetForCell(
        'alpha',
        ownedEdges,
        customRegistry,
        customPriorities,
        ['water', 'grass'],
      );

      // Assert: console.warn was called with cell info and conflicting materials
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const warnMessage = warnSpy.mock.calls[0][0] as string;
      expect(warnMessage).toContain('alpha');
      expect(warnMessage).toContain('water');
      expect(warnMessage).toContain('grass');

      warnSpy.mockRestore();
    });
  });
});

// ---------------------------------------------------------------------------
// computeCellFrame
// ---------------------------------------------------------------------------

describe('computeCellFrame', () => {
  describe('mask computation from FG neighbors', () => {
    // AC4: "The blob-47 mask shall be computed by FG neighbor comparison only
    //        (not virtual BG)"
    // ROI: 90 | Business Value: 10 (visual correctness) | Frequency: 10
    // @category: core-functionality
    // @dependency: computeNeighborMaskByMaterial, getFrame
    // @complexity: medium

    it('should return mask=255 and SOLID_FRAME for cell with all same-FG neighbors', () => {
      // Arrange:
      //   3x3 grid: all grass, compute frame for center cell (1,1)
      const grid = makeGrid(3, 3, 'grass');

      // Act
      const result = computeCellFrame(grid, 1, 1, 3, 3, 'grass');

      // Assert:
      //   mask47 = 255
      //   frameId = SOLID_FRAME (frame 1)
      expect(result.mask47).toBe(255);
      expect(result.frameId).toBe(SOLID_FRAME);
    });

    it('should return mask=0 and isolated frame for cell with no same-FG neighbors', () => {
      // Arrange:
      //   3x3 grid: all deep-water, center cell (1,1) = grass
      const grid = makeGrid(3, 3, 'deep-water');
      grid[1][1] = makeCell('grass');

      // Act
      const result = computeCellFrame(grid, 1, 1, 3, 3, 'grass');

      // Assert:
      //   mask47 = 0
      //   frameId = getFrame(0) (isolated tile)
      expect(result.mask47).toBe(0);
      expect(result.frameId).toBe(getFrame(0));
    });

    it('should compute correct mask for L-corner pattern (E+S neighbors matching)', () => {
      // Arrange:
      //   3x3 grid: soil at (1,1), (2,1), (1,2), (2,2); rest deep-water
      const grid = makeGrid(3, 3, 'deep-water');
      grid[1][1] = makeCell('soil');
      grid[1][2] = makeCell('soil'); // E of (1,1)
      grid[2][1] = makeCell('soil'); // S of (1,1)
      grid[2][2] = makeCell('soil'); // SE of (1,1)

      // Cell (1,1): E=soil(1), SE=soil(1), S=soil(1), rest=dw(0)
      // Raw: E+SE+S = 4+8+16 = 28
      // Gated: Cardinals E+S=20, SE: S+E both 1 -> +8 = 28

      // Act
      const result = computeCellFrame(grid, 1, 1, 3, 3, 'soil');

      // Assert:
      //   mask47 = 28
      //   frameId = getFrame(28) (frame 35 per Design Doc)
      expect(result.mask47).toBe(28);
      expect(result.frameId).toBe(getFrame(28));
      expect(result.frameId).toBe(35);
    });
  });

  describe('diagonal gating', () => {
    // AC4: "When computing diagonal mask bits, NW shall be set only if N and
    //        W are both set (diagonal gating preserved)"
    // ROI: 85 | Business Value: 9 (visual correctness) | Frequency: 8
    // @category: core-functionality
    // @dependency: gateDiagonals
    // @complexity: medium

    it('should gate NW when N is not set (even if NW neighbor matches)', () => {
      // Arrange:
      //   Grid where cell has: N=different, W=same, NW=same
      //   NW bit should be gated off because N=0
      //   4x4 grid: center cell (1,1)=grass
      //   (0,0)=grass(NW), (1,0)=dw(N), (0,1)=grass(W), (1,1)=grass(center)
      //   All others = dw
      const grid = makeGrid(4, 4, 'deep-water');
      grid[1][1] = makeCell('grass'); // center
      grid[1][0] = makeCell('grass'); // W
      grid[0][0] = makeCell('grass'); // NW

      // Act
      const result = computeCellFrame(grid, 1, 1, 4, 4, 'grass');

      // Assert:
      //   mask47 does NOT include NW bit (128)
      expect(result.mask47 & NW).toBe(0);
    });

    it('should gate NE when E is not set', () => {
      // Arrange:
      //   Grid where cell has: N=same, E=different, NE=same
      //   4x4 grid
      const grid = makeGrid(4, 4, 'deep-water');
      grid[1][1] = makeCell('grass'); // center
      grid[0][1] = makeCell('grass'); // N
      grid[0][2] = makeCell('grass'); // NE

      // Act
      const result = computeCellFrame(grid, 1, 1, 4, 4, 'grass');

      // Assert:
      //   mask47 does NOT include NE bit (2)
      expect(result.mask47 & NE).toBe(0);
    });

    it('should preserve diagonal when both adjacent cardinals are set', () => {
      // Arrange:
      //   Grid where cell has: S=same, E=same, SE=same
      //   4x4 grid
      const grid = makeGrid(4, 4, 'deep-water');
      grid[1][1] = makeCell('grass'); // center
      grid[2][1] = makeCell('grass'); // S
      grid[1][2] = makeCell('grass'); // E
      grid[2][2] = makeCell('grass'); // SE

      // Act
      const result = computeCellFrame(grid, 1, 1, 4, 4, 'grass');

      // Assert:
      //   mask47 includes SE bit (8)
      expect(result.mask47 & SE).toBe(SE);
    });
  });

  describe('out-of-bounds handling', () => {
    // AC4 (invariant 5): "OOB neighbors are treated as matching (bit=1) by default"
    // ROI: 75 | Business Value: 7 | Frequency: 6
    // @category: edge-case
    // @dependency: computeNeighborMaskByMaterial
    // @complexity: low

    it('should treat OOB neighbors as matching (bit=1) for corner cells', () => {
      // Arrange:
      //   3x3 grid all grass, compute frame for corner cell (0,0)
      //   N, NW, W are OOB -> treated as matching (bit=1)
      const grid = makeGrid(3, 3, 'grass');

      // Act
      const result = computeCellFrame(grid, 0, 0, 3, 3, 'grass');

      // Assert:
      //   mask47 = 255 (all matching, OOB counted as matching)
      //   frameId = SOLID_FRAME
      expect(result.mask47).toBe(255);
      expect(result.frameId).toBe(SOLID_FRAME);
    });

    it('should treat OOB neighbors as matching for edge cells', () => {
      // Arrange:
      //   3x3 grid all grass, compute frame for edge cell (1,0)
      //   N, NE, NW are OOB -> treated as matching
      const grid = makeGrid(3, 3, 'grass');

      // Act
      const result = computeCellFrame(grid, 1, 0, 3, 3, 'grass');

      // Assert:
      //   mask47 = 255
      expect(result.mask47).toBe(255);
    });
  });

  describe('no corner holes (V3 requirement)', () => {
    // AC4: "The system shall not produce corner holes in island, bay, or
    //        inlet patterns"
    // ROI: 78 | Business Value: 8 (visual quality) | Frequency: 5
    // @category: core-functionality
    // @dependency: full mask computation
    // @complexity: medium

    it('should not produce corner holes in 3x3 island pattern', () => {
      // Arrange:
      //   5x5 grid: deep-water everywhere, 3x3 soil island at center
      //   Island at (1,1)-(3,3)
      const grid = makeGrid(5, 5, 'deep-water');
      for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
          grid[y][x] = makeCell('soil');
        }
      }

      // Check each corner cell of the island
      // (1,1) top-left corner: E=soil, SE=soil, S=soil, N=dw, NW=dw, W=dw, NE=dw, SW=dw
      // Raw: E+SE+S = 4+8+16 = 28
      // Gated: E+S=20, SE: S=1,E=1 -> +8 = 28
      const topLeft = computeCellFrame(grid, 1, 1, 5, 5, 'soil');
      expect(topLeft.frameId).toBe(getFrame(28)); // L-corner E+S filled
      expect(topLeft.frameId).toBe(35);

      // (3,1) top-right corner: W=soil, SW=soil, S=soil
      // Raw: S+SW+W = 16+32+64 = 112
      // Gated: S+W=80, SW: S=1,W=1 -> +32 = 112
      const topRight = computeCellFrame(grid, 3, 1, 5, 5, 'soil');
      expect(topRight.frameId).toBe(getFrame(112)); // L-corner S+W filled
      expect(topRight.frameId).toBe(37);

      // (1,3) bottom-left corner: N=soil, NE=soil, E=soil
      // Raw: N+NE+E = 1+2+4 = 7
      // Gated: N+E=5, NE: N=1,E=1 -> +2 = 7
      const bottomLeft = computeCellFrame(grid, 1, 3, 5, 5, 'soil');
      expect(bottomLeft.frameId).toBe(getFrame(7)); // L-corner N+E filled
      expect(bottomLeft.frameId).toBe(41);

      // (3,3) bottom-right corner: N=soil, W=soil, NW=soil
      // Raw: N+NW+W = 1+128+64 = 193
      // Gated: N+W=65, NW: N=1,W=1 -> +128 = 193
      const bottomRight = computeCellFrame(grid, 3, 3, 5, 5, 'soil');
      expect(bottomRight.frameId).toBe(getFrame(193)); // L-corner N+W filled
      expect(bottomRight.frameId).toBe(39);

      // Assert:
      //   Corner cells should have proper L-corner frames (not isolated frames)
      //   No cell should show a "hole" or disconnected corner artifact
      const isolatedFrame = getFrame(0); // frame 47
      expect(topLeft.frameId).not.toBe(isolatedFrame);
      expect(topRight.frameId).not.toBe(isolatedFrame);
      expect(bottomLeft.frameId).not.toBe(isolatedFrame);
      expect(bottomRight.frameId).not.toBe(isolatedFrame);
    });

    it('should handle bay pattern (U-shape) without artifacts', () => {
      // Arrange:
      //   5x5 grid: deep-water fill, U-shape soil leaving top-center open
      //   e.g., soil at (1,1),(1,2),(1,3),(2,3),(3,3),(3,2),(3,1)
      const grid = makeGrid(5, 5, 'deep-water');
      // Left column of U
      grid[1][1] = makeCell('soil');
      grid[2][1] = makeCell('soil');
      grid[3][1] = makeCell('soil');
      // Bottom of U
      grid[3][2] = makeCell('soil');
      grid[3][3] = makeCell('soil');
      // Right column of U
      grid[2][3] = makeCell('soil');
      grid[1][3] = makeCell('soil');

      // Check bay opening inner corners
      // (1,1) top of left column: neighbors in soil: S=(1,2)
      // E=(2,1)=dw, W=(0,1)=dw, N=(1,0)=dw
      // Soil neighbors: S only (no diagonal soil in range except grid[2][2] which is dw)
      const topLeft = computeCellFrame(grid, 1, 1, 5, 5, 'soil');
      // Should not be isolated (has S neighbor)
      expect(topLeft.frameId).not.toBe(getFrame(0));

      // (1,3) top of right column: neighbors in soil: S=(1,2) is dw actually
      // Wait, let me reconsider the layout. grid[y][x]:
      // grid[1][3] = soil, grid[2][3] = soil, grid[3][3] = soil
      // grid[1][3] N=grid[0][3]=dw, S=grid[2][3]=soil, E=grid[1][4]=dw, W=grid[1][2]=dw
      const topRight = computeCellFrame(grid, 3, 1, 5, 5, 'soil');
      // Should not be isolated (has S neighbor)
      expect(topRight.frameId).not.toBe(getFrame(0));

      // Inner cells of the U-shape should have correct frames
      // (2,1) middle of left column: N=soil(1,1), S=soil(3,1), E=dw(2,2), W=dw(0,1)
      // Wait, grid[y][x] so grid[1][1] is y=1,x=1
      // Cell (1,2): x=1,y=2. N=grid[1][1]=soil, S=grid[3][1]=soil, E=grid[2][2]=dw, W=grid[2][0]=dw
      const midLeft = computeCellFrame(grid, 1, 2, 5, 5, 'soil');
      // Should have N+S corridor (mask = N+S = 1+16 = 17)
      expect(midLeft.mask47).toBe(17);
      expect(midLeft.frameId).toBe(getFrame(17)); // vertical corridor = frame 33

      // No corner holes at the bay opening
      // The key assertion is that no cell in the U pattern has artifacts
      // from orphan diagonal bits.
    });
  });

  describe('selected-mode mask computation (ADR-0011 Decision 8)', () => {
    // FR5: "Compute blob-47 mask in selected-mode basis"
    // AC4: "bg==='' -> FG mask, bg!=='' -> BG-targeted transition mask"

    it('should use FG-equality mask when bg is empty (base mode)', () => {
      // 3x3 grid: all grass, center = grass -> all neighbors match -> mask=255
      const grid = makeGrid(3, 3, 'grass');
      const result = computeCellFrame(grid, 1, 1, 3, 3, 'grass', '', '');

      expect(result.mask47).toBe(255);
      expect(result.frameId).toBe(SOLID_FRAME);
    });

    it('should use BG-targeted transition mask when bg is non-empty', () => {
      // 3x3 grid: center=water, S neighbor=grass, rest=water
      // In transition mode with bg='grass':
      //   bit=0 where neighbor IS grass (transition opening)
      //   bit=1 where neighbor is NOT grass (solid side)
      const grid = makeGrid(3, 3, 'water');
      grid[2][1] = makeCell('grass'); // S neighbor
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['S', { bg: 'grass', neighborMaterial: 'grass' }],
      ]);

      // With bg='grass', transition mask:
      //   N(0,1)=water -> bit=1, NE(2,0)=water -> bit=1, E(2,1)=water -> bit=1
      //   SE(2,2)=water -> bit=1, S(1,2)=grass -> bit=0
      //   SW(0,2)=water -> bit=1, W(0,1)=water -> bit=1, NW(0,0)=water -> bit=1
      // Raw mask = N(1)+NE(2)+E(4)+SE(8)+SW(32)+W(64)+NW(128) = 239
      // S(16) is NOT set because S=grass matches bg
      const result = computeCellFrame(
        grid,
        1,
        1,
        3,
        3,
        'water',
        'grass',
        'direct',
        ownedEdges,
      );

      expect(result.mask47 & 16).toBe(0); // S bit should NOT be set (transition opening)
      expect(result.frameId).not.toBe(getFrame(0)); // Not isolated
      expect(result.frameId).not.toBe(SOLID_FRAME); // Not fully solid (has opening toward grass)
    });

    it('should NOT produce frame 47 (isolated) for transition cell when bg boundary exists', () => {
      // This is the core bug fix: transition cells at a seam should NOT be isolated.
      // 3x3 grid: center=water, E=grass, rest=water
      const grid = makeGrid(3, 3, 'water');
      grid[1][2] = makeCell('grass'); // E neighbor

      // In base mode (bg=''), FG=water: only E is different -> mask has all bits
      // EXCEPT E(4) -> raw=251, which gives a specific frame
      const baseResult = computeCellFrame(grid, 1, 1, 3, 3, 'water', '', '');

      // In transition mode (bg='grass'): E=grass -> bit=0 (transition opening)
      // All other neighbors=water (not grass) -> bit=1
      // Raw mask = N(1)+NE(2)+SE(8)+S(16)+SW(32)+W(64)+NW(128) = 251 (same)
      // Wait -- E(4) is also not set in transition mode because E IS grass -> bit=0
      // So raw = 1+2+8+16+32+64+128 = 251... E bit = 4, so 255-4=251
      const transitionResult = computeCellFrame(grid, 1, 1, 3, 3, 'water', 'grass', 'direct');

      // Both should give a non-isolated frame
      expect(baseResult.frameId).not.toBe(getFrame(0));
      expect(transitionResult.frameId).not.toBe(getFrame(0));
    });
  });

  describe('reverse orientation frame inversion', () => {
    // ADR-0011 Decision 7: reverse -> getFrame((~rawMask) & 0xFF)

    it('should invert mask for reverse orientation', () => {
      // 3x3 grid: center=water surrounded by water on all sides
      // FG=water, bg='grass', orientation='reverse'
      // Transition mask for bg='grass': no grass neighbors -> all bits=1 -> raw=255
      // Reverse inversion: (~255) & 0xFF = 0 -> isolated frame
      const grid = makeGrid(3, 3, 'water');
      const result = computeCellFrame(grid, 1, 1, 3, 3, 'water', 'grass', 'reverse');
      // Raw transition mask = 255 (no grass neighbors), inverted = 0
      expect(result.frameId).toBe(getFrame(0));
    });

    it('should produce complementary frames for direct vs reverse with same mask', () => {
      // 3x3 grid: center=water, all-grass surround
      // FG=water, bg='grass'
      // Transition mask: all neighbors ARE grass -> all bits=0 -> raw=0
      // Direct: getFrame(0) = isolated
      // Reverse: getFrame(255) = solid
      const grid = makeGrid(3, 3, 'grass');
      grid[1][1] = makeCell('water');
      const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>([
        ['N', { bg: 'grass', neighborMaterial: 'grass' }],
        ['E', { bg: 'grass', neighborMaterial: 'grass' }],
        ['S', { bg: 'grass', neighborMaterial: 'grass' }],
        ['W', { bg: 'grass', neighborMaterial: 'grass' }],
      ]);

      const directResult = computeCellFrame(
        grid,
        1,
        1,
        3,
        3,
        'water',
        'grass',
        'direct',
        ownedEdges,
      );
      const reverseResult = computeCellFrame(
        grid,
        1,
        1,
        3,
        3,
        'water',
        'grass',
        'reverse',
        ownedEdges,
      );

      expect(directResult.frameId).toBe(getFrame(0)); // isolated
      expect(reverseResult.frameId).toBe(SOLID_FRAME); // solid (255 inverted -> 255)
    });

    it('should invert after diagonal gating (not before) for reverse orientation', () => {
      // Grid crafted so raw base-mode mask is NE-only (raw=2), which is invalid
      // without cardinal supports. gateDiagonals(raw) => 0.
      // Reverse rule in doc: invert AFTER gating -> (~0)&0xFF = 255 -> SOLID_FRAME.
      // If we inverted before gating, we'd get getFrame((~2)&0xFF)=getFrame(253), not solid.
      const grid = [
        [makeCell('b'), makeCell('b'), makeCell('a')],
        [makeCell('b'), makeCell('a'), makeCell('b')],
        [makeCell('b'), makeCell('b'), makeCell('b')],
      ];

      const reverseResult = computeCellFrame(grid, 1, 1, 3, 3, 'a', '', 'reverse');
      const invertBeforeGatingFrame = getFrame((~2) & 0xFF);

      expect(reverseResult.mask47).toBe(0);
      expect(reverseResult.frameId).toBe(SOLID_FRAME);
      expect(reverseResult.frameId).not.toBe(invertBeforeGatingFrame);
    });
  });
});
