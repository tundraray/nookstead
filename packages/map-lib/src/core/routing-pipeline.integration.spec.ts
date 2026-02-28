// Autotile Routing System - Routing Pipeline Integration Tests
// Design Doc: docs/design/design-015-autotile-routing-system.md
// Generated: 2026-02-22 | Budget Used: 2/3 integration, 0/2 E2E
//
// These tests verify the full routing pipeline (TilesetRegistry -> buildGraphs ->
// computeRoutingTable -> resolveEdge -> selectTilesetForCell -> computeCellFrame)
// using the Design Doc worked examples. Each test constructs the full pipeline
// from tilesets and verifies cell-level tileset selection and frame computation.

import type { TilesetInfo } from '../types/material-types';
import { TilesetRegistry } from './tileset-registry';
import { buildGraphs } from './graph-builder';
import { computeRoutingTable } from './router';
import { resolveEdge } from './edge-resolver';
import { selectTilesetForCell, computeCellFrame, type OwnedEdgeInfo } from './cell-tileset-selector';
import type { RoutingTable, MaterialPriorityMap, EdgeDirection } from '../types/routing-types';
import type { Cell } from '@nookstead/shared';

// ---------------------------------------------------------------------------
// Shared Test Data Factories
// ---------------------------------------------------------------------------

/**
 * Reference tileset set from Design Doc (11 tilesets).
 */
function makeReferenceTilesets(): TilesetInfo[] {
  return [
    { key: 'ts-deep-water', name: 'Deep Water', fromMaterialKey: 'deep-water' },
    { key: 'ts-water', name: 'Water', fromMaterialKey: 'water' },
    { key: 'ts-grass', name: 'Grass', fromMaterialKey: 'grass' },
    { key: 'ts-soil', name: 'Soil', fromMaterialKey: 'soil' },
    { key: 'ts-sand', name: 'Sand', fromMaterialKey: 'sand' },
    { key: 'ts-deep-water-water', name: 'deep-water_water', fromMaterialKey: 'deep-water', toMaterialKey: 'water' },
    { key: 'ts-water-grass', name: 'water_grass', fromMaterialKey: 'water', toMaterialKey: 'grass' },
    { key: 'ts-grass-water', name: 'grass_water', fromMaterialKey: 'grass', toMaterialKey: 'water' },
    { key: 'ts-soil-grass', name: 'soil_grass', fromMaterialKey: 'soil', toMaterialKey: 'grass' },
    { key: 'ts-sand-water', name: 'sand_water', fromMaterialKey: 'sand', toMaterialKey: 'water' },
    { key: 'ts-sand-grass', name: 'sand_grass', fromMaterialKey: 'sand', toMaterialKey: 'grass' },
  ];
}

/**
 * Preset A material priorities: water-side owns shore.
 */
function makePresetAPriorities(): Map<string, number> {
  return new Map([
    ['deep-water', 100],
    ['water', 90],
    ['sand', 50],
    ['grass', 30],
    ['soil', 10],
  ]);
}

function makeDefaultPreferences(): string[] {
  return ['water', 'grass', 'sand', 'soil', 'deep-water'];
}

function makeCell(terrain: string): Cell {
  return { terrain, elevation: 0, meta: {} } as Cell;
}

/**
 * Build the full pipeline and return { registry, router, priorities, preferences }.
 */
function buildPipeline() {
  const tilesets = makeReferenceTilesets();
  const registry = new TilesetRegistry(tilesets);
  const { compatGraph } = buildGraphs(registry);
  const preferences = makeDefaultPreferences();
  const router = computeRoutingTable(compatGraph, preferences);
  const priorities = makePresetAPriorities();
  return { registry, router, priorities, preferences };
}

/**
 * Cardinal direction offsets: [dx, dy, EdgeDirection].
 */
const CARDINAL_OFFSETS: ReadonlyArray<readonly [number, number, EdgeDirection]> = [
  [0, -1, 'N'],
  [1, 0, 'E'],
  [0, 1, 'S'],
  [-1, 0, 'W'],
];

/**
 * Compute owned edges for a cell using the same logic as RetileEngine.rebuildCells.
 */
function computeOwnedEdges(
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  router: RoutingTable,
  registry: TilesetRegistry,
): Map<EdgeDirection, OwnedEdgeInfo> {
  const fg = grid[y][x].terrain;
  const ownedEdges = new Map<EdgeDirection, OwnedEdgeInfo>();

  for (const [dx, dy, dir] of CARDINAL_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      continue; // OOB neighbor -- no edge
    }

    const neighborFg = grid[ny][nx].terrain;
    if (neighborFg === fg) {
      continue; // Same material -- no transition needed
    }

    const virtualBG = router.nextHop(fg, neighborFg);
    if (virtualBG !== null && registry.hasPairOrReverse(fg, virtualBG)) {
      ownedEdges.set(dir, {
        bg: virtualBG,
        neighborMaterial: neighborFg,
      });
    }
  }

  return ownedEdges;
}

// ---------------------------------------------------------------------------
// Worked Example 1: deep_water | soil (Simple Edge, 3x3 grid)
// ---------------------------------------------------------------------------

describe('Worked Example 1: deep_water | soil (3x3 grid)', () => {
  // AC1+AC2+AC3+AC4: Full pipeline from graph build through cell tileset selection
  // ROI: 88 | Business Value: 10 (core algorithm) | Frequency: 10 (every paint)
  // Behavior: Build pipeline -> resolve edges for 3x3 grid -> verify tilesets and frames
  // @category: core-functionality
  // @dependency: TilesetRegistry, GraphBuilder, Router, EdgeResolver, CellTilesetSelector
  // @complexity: high

  // Grid layout (from Design Doc Worked Example 1):
  //   (0,0) dw   (1,0) dw   (2,0) dw
  //   (0,1) dw   (1,1) dw   (2,1) soil
  //   (0,2) dw   (1,2) dw   (2,2) soil

  function makeExample1Grid(): Cell[][] {
    return [
      [makeCell('deep-water'), makeCell('deep-water'), makeCell('deep-water')],
      [makeCell('deep-water'), makeCell('deep-water'), makeCell('soil')],
      [makeCell('deep-water'), makeCell('deep-water'), makeCell('soil')],
    ];
  }

  it('should select deep-water_water for dw cell (1,1) bordering soil at E', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeExample1Grid();
    const ownedEdges = computeOwnedEdges(grid, 1, 1, 3, 3, router, registry);

    // Act
    const result = selectTilesetForCell('deep-water', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-deep-water-water');
    expect(result.bg).toBe('water');
  });

  it('should compute frame 25 (gated mask 241) for dw cell (1,1)', () => {
    // Arrange
    const grid = makeExample1Grid();

    // Act
    const { mask47, frameId } = computeCellFrame(grid, 1, 1, 3, 3, 'deep-water');

    // Assert
    expect(mask47).toBe(241);
    expect(frameId).toBe(25);
  });

  it('should select soil_grass for soil cell (2,1) bordering dw at N and W', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeExample1Grid();
    const ownedEdges = computeOwnedEdges(grid, 2, 1, 3, 3, router, registry);

    // Act
    const result = selectTilesetForCell('soil', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-soil-grass');
    expect(result.bg).toBe('grass');
  });

  it('should compute frame 35 (gated mask 28) for soil cell (2,1)', () => {
    // Arrange
    const grid = makeExample1Grid();

    // Act
    const { mask47, frameId } = computeCellFrame(grid, 2, 1, 3, 3, 'soil');

    // Assert
    expect(mask47).toBe(28);
    expect(frameId).toBe(35);
  });
});

// ---------------------------------------------------------------------------
// Worked Example 2: deep_water | soil | sand (6x4 grid, Three Materials)
// ---------------------------------------------------------------------------

describe('Worked Example 2: deep_water | soil | sand (6x4 grid)', () => {
  // AC2+AC3+AC5: Three-material scenario with S1 conflict resolution
  // ROI: 85 | Business Value: 10 (conflict resolution) | Frequency: 6
  // Behavior: Build pipeline -> resolve 6x4 grid with dw/soil/sand -> verify S1 resolves sand
  // @category: core-functionality
  // @dependency: full pipeline + S1 conflict resolution
  // @complexity: high

  // Grid layout (from Design Doc Worked Example 2):
  //   Row 0: dw  dw  dw  dw  dw  dw
  //   Row 1: dw  dw  so  so  so  dw
  //   Row 2: dw  dw  sa  sa  sa  dw
  //   Row 3: dw  dw  dw  dw  dw  dw

  function makeExample2Grid(): Cell[][] {
    const dw = 'deep-water';
    const so = 'soil';
    const sa = 'sand';
    return [
      [makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw)],
      [makeCell(dw), makeCell(dw), makeCell(so), makeCell(so), makeCell(so), makeCell(dw)],
      [makeCell(dw), makeCell(dw), makeCell(sa), makeCell(sa), makeCell(sa), makeCell(dw)],
      [makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw)],
    ];
  }

  it('should resolve sand(2,2) to sand_grass via S1 under Preset A', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeExample2Grid();
    const ownedEdges = computeOwnedEdges(grid, 2, 2, 6, 4, router, registry);

    // Act
    const result = selectTilesetForCell('sand', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-sand-grass');
    expect(result.bg).toBe('grass');
  });

  it('should select soil_grass for soil(2,1) with no conflict', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeExample2Grid();
    const ownedEdges = computeOwnedEdges(grid, 2, 1, 6, 4, router, registry);

    // Act
    const result = selectTilesetForCell('soil', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-soil-grass');
  });

  it('should select deep-water_water for dw(1,1) bordering soil', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeExample2Grid();
    const ownedEdges = computeOwnedEdges(grid, 1, 1, 6, 4, router, registry);

    // Act
    const result = selectTilesetForCell('deep-water', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-deep-water-water');
  });

  it('should compute correct frames per Worked Example 2 mask calculations', () => {
    // Arrange
    const grid = makeExample2Grid();

    // Act
    const soilResult = computeCellFrame(grid, 2, 1, 6, 4, 'soil');
    const sandResult = computeCellFrame(grid, 2, 2, 6, 4, 'sand');

    // Assert
    // soil(2,1): neighbors - N=dw(0), NE=dw(0), E=so(1), SE=sa(0), S=sa(0), SW=dw(0), W=dw(0), NW=dw(0)
    // Raw mask = E=4, gated=4
    expect(soilResult.mask47).toBe(4);
    expect(soilResult.frameId).toBe(44);

    // sand(2,2): neighbors - N=so(0), NE=so(0), E=sa(1), SE=dw(0), S=dw(0), SW=dw(0), W=dw(0), NW=dw(0)
    // Raw mask = E=4, gated=4
    expect(sandResult.mask47).toBe(4);
    expect(sandResult.frameId).toBe(44);
  });
});

// ---------------------------------------------------------------------------
// Worked Example 3: deep_water | soil | water (Routing Through Actual Water)
// ---------------------------------------------------------------------------

describe('Worked Example 3: deep_water | soil | water (6x4 grid)', () => {
  // AC2+AC4: Routing through an actual water material (render graph directionality)
  // ROI: 80 | Business Value: 8 (edge case) | Frequency: 5
  // Behavior: Water cell cannot transition to dw (no water_deep-water tileset)
  // @category: edge-case
  // @dependency: full pipeline, render graph direction
  // @complexity: high

  // Grid layout (from Design Doc Worked Example 3):
  //   Row 0: dw  dw   dw    dw    dw   dw
  //   Row 1: dw  dw   soil  soil  soil dw
  //   Row 2: dw  dw   water water water dw
  //   Row 3: dw  dw   dw    dw    dw   dw

  function makeExample3Grid(): Cell[][] {
    const dw = 'deep-water';
    const so = 'soil';
    const wa = 'water';
    return [
      [makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw)],
      [makeCell(dw), makeCell(dw), makeCell(so), makeCell(so), makeCell(so), makeCell(dw)],
      [makeCell(dw), makeCell(dw), makeCell(wa), makeCell(wa), makeCell(wa), makeCell(dw)],
      [makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw), makeCell(dw)],
    ];
  }

  it('should select water_grass for water(2,2) even though dw neighbors exist', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeExample3Grid();
    const ownedEdges = computeOwnedEdges(grid, 2, 2, 6, 4, router, registry);

    // Act
    const result = selectTilesetForCell('water', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-water-grass');
    expect(result.bg).toBe('grass');
  });

  it('should select deep-water_water for dw(1,2) bordering water', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeExample3Grid();
    const ownedEdges = computeOwnedEdges(grid, 1, 2, 6, 4, router, registry);

    // Act
    const result = selectTilesetForCell('deep-water', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-deep-water-water');
    expect(result.bg).toBe('water');
  });

  it('should compute frame 44 (E-only dead end) for water(2,2)', () => {
    // Arrange
    const grid = makeExample3Grid();

    // Act
    const { mask47, frameId } = computeCellFrame(grid, 2, 2, 6, 4, 'water');

    // Assert
    expect(mask47).toBe(4);
    expect(frameId).toBe(44);
  });
});

// ---------------------------------------------------------------------------
// T-Junction: Three Materials Meeting at a Corner
// ---------------------------------------------------------------------------

describe('T-junction: three materials meeting at a corner', () => {
  // AC3+AC5: Edge ownership and S1 conflict resolution at a T-junction
  // ROI: 78 | Business Value: 8 (visual correctness) | Frequency: 4
  // Behavior: dw, soil, sand converge -> each cell independently resolves tileset
  // @category: edge-case
  // @dependency: full pipeline + S1 conflict resolution
  // @complexity: high

  // Grid layout (from Design Doc T-Junction Example):
  //   (0,0) dw    (1,0) dw
  //   (0,1) dw    (1,1) soil
  //   (0,2) dw    (1,2) sand

  function makeTJunctionGrid(): Cell[][] {
    return [
      [makeCell('deep-water'), makeCell('deep-water')],
      [makeCell('deep-water'), makeCell('soil')],
      [makeCell('deep-water'), makeCell('sand')],
    ];
  }

  it('should resolve sand(1,2) to sand_grass via S1 at T-junction (Preset A)', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeTJunctionGrid();
    const ownedEdges = computeOwnedEdges(grid, 1, 2, 2, 3, router, registry);

    // Act
    const result = selectTilesetForCell('sand', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-sand-grass');
  });

  it('should select soil_grass for soil(1,1) at T-junction', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeTJunctionGrid();
    const ownedEdges = computeOwnedEdges(grid, 1, 1, 2, 3, router, registry);

    // Act
    const result = selectTilesetForCell('soil', ownedEdges, registry, priorities, preferences);

    // Assert
    expect(result.selectedTilesetKey).toBe('ts-soil-grass');
  });

  it('should select deep-water_water for both dw cells at T-junction', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeTJunctionGrid();
    const ownedEdges_01 = computeOwnedEdges(grid, 0, 1, 2, 3, router, registry);
    const ownedEdges_02 = computeOwnedEdges(grid, 0, 2, 2, 3, router, registry);

    // Act
    const result_01 = selectTilesetForCell('deep-water', ownedEdges_01, registry, priorities, preferences);
    const result_02 = selectTilesetForCell('deep-water', ownedEdges_02, registry, priorities, preferences);

    // Assert
    expect(result_01.selectedTilesetKey).toBe('ts-deep-water-water');
    expect(result_02.selectedTilesetKey).toBe('ts-deep-water-water');
  });

  it('should produce consistent BG materials at all cell boundaries', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeTJunctionGrid();

    // Act -- compute BGs for each cell
    const ownedEdges_dw01 = computeOwnedEdges(grid, 0, 1, 2, 3, router, registry);
    const ownedEdges_soil = computeOwnedEdges(grid, 1, 1, 2, 3, router, registry);
    const ownedEdges_dw02 = computeOwnedEdges(grid, 0, 2, 2, 3, router, registry);
    const ownedEdges_sand = computeOwnedEdges(grid, 1, 2, 2, 3, router, registry);

    const result_dw01 = selectTilesetForCell('deep-water', ownedEdges_dw01, registry, priorities, preferences);
    const result_soil = selectTilesetForCell('soil', ownedEdges_soil, registry, priorities, preferences);
    const result_dw02 = selectTilesetForCell('deep-water', ownedEdges_dw02, registry, priorities, preferences);
    const result_sand = selectTilesetForCell('sand', ownedEdges_sand, registry, priorities, preferences);

    // Assert: boundary consistency
    // dw(0,1) | soil(1,1): water | grass -- both have compatible tilesets
    expect(result_dw01.bg).toBe('water');
    expect(result_soil.bg).toBe('grass');
    // Both compatible via grass_water tileset existence
    expect(registry.hasTileset('grass', 'water')).toBe(true);

    // dw(0,2) | sand(1,2): water | grass
    expect(result_dw02.bg).toBe('water');
    expect(result_sand.bg).toBe('grass');

    // soil(1,1) | sand(1,2) vertical: both use grass BG -> seamless
    expect(result_soil.bg).toBe('grass');
    expect(result_sand.bg).toBe('grass');
  });
});

// ---------------------------------------------------------------------------
// L-Corner: Diagonal Material Meeting
// ---------------------------------------------------------------------------

describe('L-corner: diagonal material meeting', () => {
  // AC4: Diagonal neighbors do not create BG requirements, only affect FG mask
  // ROI: 72 | Business Value: 7 (visual correctness) | Frequency: 5
  // Behavior: Diagonal-only foreign neighbor -> base tileset, not transition
  // @category: edge-case
  // @dependency: CellTilesetSelector, computeCellFrame
  // @complexity: medium

  function makeLCornerGrid(): Cell[][] {
    // 3x3 grid: all deep-water except (2,2)=soil
    return [
      [makeCell('deep-water'), makeCell('deep-water'), makeCell('deep-water')],
      [makeCell('deep-water'), makeCell('deep-water'), makeCell('deep-water')],
      [makeCell('deep-water'), makeCell('deep-water'), makeCell('soil')],
    ];
  }

  it('should use base tileset when only diagonal neighbor is foreign', () => {
    // Arrange
    const { registry, router, priorities, preferences } = buildPipeline();
    const grid = makeLCornerGrid();
    // Cell (1,1): all 4 cardinal neighbors are dw, only SE(2,2)=soil
    const ownedEdges = computeOwnedEdges(grid, 1, 1, 3, 3, router, registry);

    // Act
    const result = selectTilesetForCell('deep-water', ownedEdges, registry, priorities, preferences);

    // Assert: no cardinal foreign neighbors -> base tileset
    expect(result.selectedTilesetKey).toBe('ts-deep-water');
    expect(result.bg).toBe('');
  });

  it('should show corner indent in FG mask for diagonal foreign neighbor', () => {
    // Arrange
    const grid = makeLCornerGrid();

    // Act
    const { mask47, frameId } = computeCellFrame(grid, 1, 1, 3, 3, 'deep-water');

    // Assert
    // Raw = N|NE|E|S|SW|W|NW = 1+2+4+16+32+64+128 = 247 (SE=8 is missing)
    // Gated: NE(N+E=both set)->keep, SE(S+E=both set but SE raw=0)->stays 0, SW(S+W)->keep, NW(N+W)->keep
    // Gated = 247
    expect(mask47).toBe(247);
    expect(frameId).toBe(5); // FRAME_TABLE[247] = 5 (missing SE corner)
  });
});

// ---------------------------------------------------------------------------
// Edge Ownership Symmetry
// ---------------------------------------------------------------------------

describe('Edge ownership symmetry', () => {
  // AC3: "resolveEdge(A,B,N) and resolveEdge(B,A,S) consistency"
  // ROI: 75 | Business Value: 8 (correctness) | Frequency: 10 (every edge)
  // Behavior: Same edge resolved from both sides must give consistent owner
  // @category: core-functionality
  // @dependency: EdgeResolver, Router, TilesetRegistry
  // @complexity: medium

  it('should produce consistent ownership when resolving edge from A->B and B->A', () => {
    // Arrange
    const { registry, router, priorities } = buildPipeline();

    // Act
    const fromA = resolveEdge('deep-water', 'soil', 'E', router, registry, priorities);
    const fromB = resolveEdge('soil', 'deep-water', 'W', router, registry, priorities);

    // Assert: both calls produce a valid EdgeOwner
    expect(fromA).not.toBeNull();
    expect(fromB).not.toBeNull();
    // The owner material should be consistent
    expect(fromA!.owner).toBe(fromB!.owner);
  });

  it('should produce symmetric results for water-grass edge pair', () => {
    // Arrange
    const { registry, router, priorities } = buildPipeline();

    // Act
    const fromWater = resolveEdge('water', 'grass', 'S', router, registry, priorities);
    const fromGrass = resolveEdge('grass', 'water', 'N', router, registry, priorities);

    // Assert
    expect(fromWater).not.toBeNull();
    expect(fromGrass).not.toBeNull();
    // Under Preset A: water(90) > grass(30), so water should own
    expect(fromWater!.owner).toBe(fromGrass!.owner);
    expect(fromWater!.owner).toBe('water');
  });

  it('should produce symmetric results for sand-soil edge pair', () => {
    // Arrange
    const { registry, router, priorities } = buildPipeline();

    // Act
    const fromSand = resolveEdge('sand', 'soil', 'E', router, registry, priorities);
    const fromSoil = resolveEdge('soil', 'sand', 'W', router, registry, priorities);

    // Assert
    expect(fromSand).not.toBeNull();
    expect(fromSoil).not.toBeNull();
    // Under Preset A: sand(50) > soil(10), so sand should own
    expect(fromSand!.owner).toBe(fromSoil!.owner);
    expect(fromSand!.owner).toBe('sand');
  });
});
