import type { FenceCellData } from '@nookstead/shared';
import {
  computeFenceWalkability,
  updateCellWalkability,
  FenceLayerSnapshot,
} from './fence-walkability';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a FenceCellData representing a fence segment (not a gate). */
const fence = (fenceTypeId = 'type-a'): FenceCellData => ({
  fenceTypeId,
  isGate: false,
  gateOpen: false,
});

/** Create a FenceCellData representing a gate (open or closed). */
const gate = (open: boolean, fenceTypeId = 'type-a'): FenceCellData => ({
  fenceTypeId,
  isGate: true,
  gateOpen: open,
});

/** Create a uniform terrain walkability grid. */
function makeTerrainGrid(
  width: number,
  height: number,
  walkable: boolean,
): boolean[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => walkable),
  );
}

/** Create a fence layer with all-null cells. */
function emptyLayer(width: number, height: number): FenceLayerSnapshot {
  return {
    cells: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => null),
    ),
  };
}

// ---------------------------------------------------------------------------
// computeFenceWalkability - full recomputation
// ---------------------------------------------------------------------------

describe('computeFenceWalkability', () => {
  describe('basic fence interactions', () => {
    test('empty fence layers: walkability matches terrain walkability exactly', () => {
      const terrain = [
        [true, true, false],
        [false, true, true],
      ];
      const layers: FenceLayerSnapshot[] = [emptyLayer(3, 2)];

      const result = computeFenceWalkability(terrain, layers, 3, 2);

      expect(result).toEqual([
        [true, true, false],
        [false, true, true],
      ]);
    });

    test('fence placed on walkable terrain: cell becomes non-walkable', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layer = emptyLayer(3, 3);
      layer.cells[1][1] = fence();

      const result = computeFenceWalkability(terrain, [layer], 3, 3);

      expect(result[1][1]).toBe(false);
      // Other cells remain walkable
      expect(result[0][0]).toBe(true);
      expect(result[2][2]).toBe(true);
    });

    test('fence placed on non-walkable terrain: cell remains non-walkable', () => {
      const terrain = makeTerrainGrid(3, 3, false);
      const layer = emptyLayer(3, 3);
      layer.cells[1][1] = fence();

      const result = computeFenceWalkability(terrain, [layer], 3, 3);

      expect(result[1][1]).toBe(false);
    });

    test('fence removed from walkable terrain: cell returns to walkable', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layer = emptyLayer(3, 3);
      // No fence at (1,1) -- null cell

      const result = computeFenceWalkability(terrain, [layer], 3, 3);

      expect(result[1][1]).toBe(true);
    });
  });

  describe('gate effects', () => {
    test('closed gate on walkable terrain: cell is non-walkable', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layer = emptyLayer(3, 3);
      layer.cells[1][1] = gate(false);

      const result = computeFenceWalkability(terrain, [layer], 3, 3);

      expect(result[1][1]).toBe(false);
    });

    test('open gate on walkable terrain: cell is walkable', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layer = emptyLayer(3, 3);
      layer.cells[1][1] = gate(true);

      const result = computeFenceWalkability(terrain, [layer], 3, 3);

      expect(result[1][1]).toBe(true);
    });

    test('open gate on non-walkable terrain: cell is non-walkable (terrain determines base)', () => {
      const terrain = makeTerrainGrid(3, 3, false);
      const layer = emptyLayer(3, 3);
      layer.cells[1][1] = gate(true);

      const result = computeFenceWalkability(terrain, [layer], 3, 3);

      expect(result[1][1]).toBe(false);
    });
  });

  describe('multi-layer scenarios', () => {
    test('fence on layer A, same position on layer B: cell is non-walkable', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layerA = emptyLayer(3, 3);
      const layerB = emptyLayer(3, 3);
      layerA.cells[1][1] = fence('type-a');
      layerB.cells[1][1] = fence('type-b');

      const result = computeFenceWalkability(terrain, [layerA, layerB], 3, 3);

      expect(result[1][1]).toBe(false);
    });

    test('fence on layer A, open gate on layer B (same position): cell is non-walkable (layer A blocks)', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layerA = emptyLayer(3, 3);
      const layerB = emptyLayer(3, 3);
      layerA.cells[1][1] = fence('type-a');
      layerB.cells[1][1] = gate(true, 'type-b');

      const result = computeFenceWalkability(terrain, [layerA, layerB], 3, 3);

      expect(result[1][1]).toBe(false);
    });

    test('fence removed from layer A, fence still on layer B: cell remains non-walkable', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layerA = emptyLayer(3, 3);
      const layerB = emptyLayer(3, 3);
      // Layer A: no fence at (1,1) (removed / null)
      layerB.cells[1][1] = fence('type-b');

      const result = computeFenceWalkability(terrain, [layerA, layerB], 3, 3);

      expect(result[1][1]).toBe(false);
    });

    test('open gate on layer A, open gate on layer B: cell is walkable (if terrain walkable)', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layerA = emptyLayer(3, 3);
      const layerB = emptyLayer(3, 3);
      layerA.cells[1][1] = gate(true, 'type-a');
      layerB.cells[1][1] = gate(true, 'type-b');

      const result = computeFenceWalkability(terrain, [layerA, layerB], 3, 3);

      expect(result[1][1]).toBe(true);
    });
  });

  describe('boundary conditions', () => {
    test('walkability computed correctly for all 4 map edge cells', () => {
      // 3x3 map, fences on all 4 edge midpoints
      const terrain = makeTerrainGrid(3, 3, true);
      const layer = emptyLayer(3, 3);
      layer.cells[0][1] = fence(); // top edge
      layer.cells[2][1] = fence(); // bottom edge
      layer.cells[1][0] = fence(); // left edge
      layer.cells[1][2] = fence(); // right edge

      const result = computeFenceWalkability(terrain, [layer], 3, 3);

      expect(result[0][1]).toBe(false); // top
      expect(result[2][1]).toBe(false); // bottom
      expect(result[1][0]).toBe(false); // left
      expect(result[1][2]).toBe(false); // right
      // Center and corners remain walkable
      expect(result[1][1]).toBe(true);
    });

    test('walkability computed correctly for corner cells', () => {
      const terrain = makeTerrainGrid(3, 3, true);
      const layer = emptyLayer(3, 3);
      layer.cells[0][0] = fence(); // top-left
      layer.cells[0][2] = fence(); // top-right
      layer.cells[2][0] = fence(); // bottom-left
      layer.cells[2][2] = fence(); // bottom-right

      const result = computeFenceWalkability(terrain, [layer], 3, 3);

      expect(result[0][0]).toBe(false);
      expect(result[0][2]).toBe(false);
      expect(result[2][0]).toBe(false);
      expect(result[2][2]).toBe(false);
      // Center remains walkable
      expect(result[1][1]).toBe(true);
    });

    test('empty map (all null fences): returns terrain walkability unchanged', () => {
      const terrain = [
        [true, false],
        [false, true],
      ];

      const result = computeFenceWalkability(terrain, [], 2, 2);

      expect(result).toEqual(terrain);
    });

    test('returns a new array (does not mutate terrainWalkable)', () => {
      const terrain = makeTerrainGrid(2, 2, true);
      const original = terrain.map((row) => [...row]);

      const result = computeFenceWalkability(terrain, [], 2, 2);

      expect(result).not.toBe(terrain);
      expect(result[0]).not.toBe(terrain[0]);
      expect(terrain).toEqual(original);
    });
  });
});

// ---------------------------------------------------------------------------
// updateCellWalkability - incremental update
// ---------------------------------------------------------------------------

describe('updateCellWalkability', () => {
  test('incremental update matches full recomputation result after single fence placement', () => {
    const terrain = makeTerrainGrid(3, 3, true);
    const layer = emptyLayer(3, 3);
    layer.cells[1][1] = fence();

    // Full recomputation
    const full = computeFenceWalkability(terrain, [layer], 3, 3);

    // Incremental: start with all-walkable, then update cell (1,1)
    const incremental = makeTerrainGrid(3, 3, true);
    updateCellWalkability(incremental, terrain, [layer], 1, 1);

    expect(incremental[1][1]).toBe(full[1][1]);
    expect(incremental[1][1]).toBe(false);
  });

  test('incremental update matches full recomputation result after fence removal', () => {
    const terrain = makeTerrainGrid(3, 3, true);
    const layer = emptyLayer(3, 3);
    // No fence at (1,1) -- simulating removal

    // Full recomputation
    const full = computeFenceWalkability(terrain, [layer], 3, 3);

    // Incremental: start with blocked cell, then update
    const incremental = makeTerrainGrid(3, 3, true);
    incremental[1][1] = false; // Was blocked by fence
    updateCellWalkability(incremental, terrain, [layer], 1, 1);

    expect(incremental[1][1]).toBe(full[1][1]);
    expect(incremental[1][1]).toBe(true);
  });

  test('incremental update matches full recomputation result after gate toggle', () => {
    const terrain = makeTerrainGrid(3, 3, true);
    const layer = emptyLayer(3, 3);
    layer.cells[1][1] = gate(true); // Open gate

    // Full recomputation
    const full = computeFenceWalkability(terrain, [layer], 3, 3);

    // Incremental: start with blocked (gate was closed), then toggle to open and update
    const incremental = makeTerrainGrid(3, 3, true);
    incremental[1][1] = false;
    updateCellWalkability(incremental, terrain, [layer], 1, 1);

    expect(incremental[1][1]).toBe(full[1][1]);
    expect(incremental[1][1]).toBe(true);
  });

  test('incremental update checks all fence layers (multi-layer correctness)', () => {
    const terrain = makeTerrainGrid(3, 3, true);
    const layerA = emptyLayer(3, 3);
    const layerB = emptyLayer(3, 3);
    // Remove from A (null), but B still has fence
    layerB.cells[1][1] = fence('type-b');

    const full = computeFenceWalkability(terrain, [layerA, layerB], 3, 3);

    const incremental = makeTerrainGrid(3, 3, true);
    updateCellWalkability(incremental, terrain, [layerA, layerB], 1, 1);

    expect(incremental[1][1]).toBe(full[1][1]);
    expect(incremental[1][1]).toBe(false);
  });

  test('mutates walkable array in place', () => {
    const terrain = makeTerrainGrid(3, 3, true);
    const layer = emptyLayer(3, 3);
    layer.cells[1][1] = fence();

    const walkable = makeTerrainGrid(3, 3, true);
    const originalRef = walkable;

    updateCellWalkability(walkable, terrain, [layer], 1, 1);

    expect(walkable).toBe(originalRef); // Same reference
    expect(walkable[1][1]).toBe(false);
  });
});
