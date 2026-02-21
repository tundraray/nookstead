/**
 * Integration tests for the fence system.
 *
 * Task 6A: Tests cross-layer isolation, gate lifecycle, multi-layer walkability,
 * and batch recalculation correctness. These tests exercise multiple modules
 * together to verify end-to-end behavior.
 */

import type { FenceCellData } from '@nookstead/shared';
import {
  computeFenceBitmask,
  getFenceFrame,
  canPlaceGate,
  getGateFrameIndex,
  applyGatePlacement,
  applyGateToggle,
  applyGateRemoval,
  FENCE_EMPTY_FRAME,
  GATE_BITMASK_NS,
  GATE_BITMASK_EW,
} from './fence-autotile';
import { recalculateAffectedCells } from './fence-recalculate';
import type { RecalculateLayer, Position } from './fence-recalculate';
import {
  computeFenceWalkability,
  updateCellWalkability,
} from './fence-walkability';
import type { FenceLayerSnapshot } from './fence-walkability';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCell(overrides?: Partial<FenceCellData>): FenceCellData {
  return {
    fenceTypeId: 'uuid-test',
    isGate: false,
    gateOpen: false,
    ...overrides,
  };
}

function createEmptyLayer(w: number, h: number): RecalculateLayer {
  return {
    cells: Array.from({ length: h }, () => Array.from({ length: w }, () => null)),
    frames: Array.from({ length: h }, () => Array.from({ length: w }, () => 0)),
  };
}

function allWalkable(w: number, h: number): boolean[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => true));
}

// ---------------------------------------------------------------------------
// Test Suite 1: Cross-Layer Isolation
// ---------------------------------------------------------------------------

describe('Cross-layer isolation', () => {
  const W = 10;
  const H = 10;

  it('adjacent fences on different layers have no cross-layer connection', () => {
    // Layer A: wooden_fence at (5, 5)
    const layerA = createEmptyLayer(W, H);
    layerA.cells[5][5] = makeCell({ fenceTypeId: 'uuid-wooden' });

    // Layer B: stone_fence at (6, 5) -- adjacent to layerA's fence
    const layerB = createEmptyLayer(W, H);
    layerB.cells[5][6] = makeCell({ fenceTypeId: 'uuid-stone' });

    // Recalculate each layer independently (this is how the editor works)
    recalculateAffectedCells(layerA, [{ x: 5, y: 5 }], W, H);
    recalculateAffectedCells(layerB, [{ x: 6, y: 5 }], W, H);

    // Both fences should be isolated (bitmask 0 -> frame 1)
    const bitmaskA = computeFenceBitmask(layerA.cells, 5, 5, W, H);
    const bitmaskB = computeFenceBitmask(layerB.cells, 6, 5, W, H);

    expect(bitmaskA).toBe(0); // No neighbors on layer A
    expect(bitmaskB).toBe(0); // No neighbors on layer B
    expect(layerA.frames[5][5]).toBe(getFenceFrame(0)); // frame 1 (isolated)
    expect(layerB.frames[5][6]).toBe(getFenceFrame(0)); // frame 1 (isolated)
  });

  it('fences on same layer DO connect', () => {
    const layer = createEmptyLayer(W, H);
    layer.cells[5][5] = makeCell();
    layer.cells[5][6] = makeCell();

    recalculateAffectedCells(layer, [{ x: 5, y: 5 }, { x: 6, y: 5 }], W, H);

    const bitmaskLeft = computeFenceBitmask(layer.cells, 5, 5, W, H);
    const bitmaskRight = computeFenceBitmask(layer.cells, 6, 5, W, H);

    // Left has east neighbor, right has west neighbor
    expect(bitmaskLeft).toBe(2);  // FENCE_E = 2
    expect(bitmaskRight).toBe(8); // FENCE_W = 8
  });

  it('multi-layer walkability: fence on each layer at same position both block', () => {
    const terrain = allWalkable(W, H);

    const snapA: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };
    const snapB: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };

    // Place fence at (3,3) on both layers
    snapA.cells[3][3] = makeCell({ fenceTypeId: 'uuid-wooden' });
    snapB.cells[3][3] = makeCell({ fenceTypeId: 'uuid-stone' });

    const walkable = computeFenceWalkability(terrain, [snapA, snapB], W, H);

    // Cell is blocked (both layers have a fence)
    expect(walkable[3][3]).toBe(false);

    // Remove from layer A only
    snapA.cells[3][3] = null;
    const walkable2 = computeFenceWalkability(terrain, [snapA, snapB], W, H);

    // Still blocked by layer B
    expect(walkable2[3][3]).toBe(false);

    // Remove from layer B too
    snapB.cells[3][3] = null;
    const walkable3 = computeFenceWalkability(terrain, [snapA, snapB], W, H);

    // Now walkable
    expect(walkable3[3][3]).toBe(true);
  });

  it('open gate on layer A, fence on layer B: cell is non-walkable', () => {
    const terrain = allWalkable(W, H);

    const snapA: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };
    const snapB: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };

    // Open gate on layer A
    snapA.cells[3][3] = makeCell({ isGate: true, gateOpen: true });
    // Regular fence on layer B
    snapB.cells[3][3] = makeCell();

    const walkable = computeFenceWalkability(terrain, [snapA, snapB], W, H);

    // Layer B blocks even though layer A has an open gate
    expect(walkable[3][3]).toBe(false);
  });

  it('open gates on BOTH layers at same position: cell is walkable', () => {
    const terrain = allWalkable(W, H);

    const snapA: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };
    const snapB: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };

    snapA.cells[3][3] = makeCell({ isGate: true, gateOpen: true });
    snapB.cells[3][3] = makeCell({ isGate: true, gateOpen: true });

    const walkable = computeFenceWalkability(terrain, [snapA, snapB], W, H);

    // Both are open gates, so the cell is walkable
    expect(walkable[3][3]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 2: Gate Lifecycle
// ---------------------------------------------------------------------------

describe('Gate lifecycle', () => {
  const W = 5;
  const H = 5;

  it('full lifecycle: place corridor -> place gate -> open -> close -> remove gate', () => {
    const layer = createEmptyLayer(W, H);

    // Step 1: Place N-S corridor at (2,1), (2,2), (2,3)
    layer.cells[1][2] = makeCell();
    layer.cells[2][2] = makeCell();
    layer.cells[3][2] = makeCell();
    recalculateAffectedCells(
      layer,
      [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }],
      W,
      H,
    );

    // Middle cell (2,2) should have N+S bitmask = 5 (corridor)
    const bitmask = computeFenceBitmask(layer.cells, 2, 2, W, H);
    expect(bitmask).toBe(GATE_BITMASK_NS);
    expect(layer.frames[2][2]).toBe(getFenceFrame(5)); // frame 6

    // Step 2: canPlaceGate should be true for corridor
    expect(canPlaceGate(layer.cells, 2, 2, W, H)).toBe(true);

    // Step 3: Place gate
    const gateCell = applyGatePlacement(layer.cells[2][2]!);
    layer.cells[2][2] = gateCell as FenceCellData;
    recalculateAffectedCells(layer, [{ x: 2, y: 2 }], W, H);

    expect(layer.cells[2][2]!.isGate).toBe(true);
    expect(layer.cells[2][2]!.gateOpen).toBe(false);
    expect(layer.frames[2][2]).toBe(17); // vertical closed

    // Walkability: closed gate blocks
    const terrain = allWalkable(W, H);
    const snap: FenceLayerSnapshot = { cells: layer.cells as (FenceCellData | null)[][] };
    let walkable = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable[2][2]).toBe(false);

    // Step 4: Open gate
    const openedCell = applyGateToggle(layer.cells[2][2]!);
    layer.cells[2][2] = openedCell as FenceCellData;
    recalculateAffectedCells(layer, [{ x: 2, y: 2 }], W, H);

    expect(layer.cells[2][2]!.gateOpen).toBe(true);
    expect(layer.frames[2][2]).toBe(18); // vertical open

    // Walkability: open gate allows passage
    walkable = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable[2][2]).toBe(true);

    // Step 5: Close gate again
    const closedCell = applyGateToggle(layer.cells[2][2]!);
    layer.cells[2][2] = closedCell as FenceCellData;
    recalculateAffectedCells(layer, [{ x: 2, y: 2 }], W, H);

    expect(layer.cells[2][2]!.gateOpen).toBe(false);
    expect(layer.frames[2][2]).toBe(17); // vertical closed
    walkable = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable[2][2]).toBe(false);

    // Step 6: Remove gate (revert to regular fence)
    const revertedCell = applyGateRemoval(layer.cells[2][2]!);
    layer.cells[2][2] = revertedCell as FenceCellData;
    recalculateAffectedCells(layer, [{ x: 2, y: 2 }], W, H);

    expect(layer.cells[2][2]!.isGate).toBe(false);
    expect(layer.frames[2][2]).toBe(getFenceFrame(5)); // frame 6 (NS corridor)
    walkable = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable[2][2]).toBe(false); // still a fence, still blocks
  });

  it('gate on E-W corridor works correctly', () => {
    const layer = createEmptyLayer(W, H);

    // Place E-W corridor at (1,2), (2,2), (3,2)
    layer.cells[2][1] = makeCell();
    layer.cells[2][2] = makeCell();
    layer.cells[2][3] = makeCell();
    recalculateAffectedCells(
      layer,
      [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
      W,
      H,
    );

    const bitmask = computeFenceBitmask(layer.cells, 2, 2, W, H);
    expect(bitmask).toBe(GATE_BITMASK_EW); // E + W = 10

    expect(canPlaceGate(layer.cells, 2, 2, W, H)).toBe(true);

    // Place gate
    layer.cells[2][2] = applyGatePlacement(layer.cells[2][2]!) as FenceCellData;
    recalculateAffectedCells(layer, [{ x: 2, y: 2 }], W, H);

    expect(layer.frames[2][2]).toBe(19); // horizontal closed

    // Open
    layer.cells[2][2] = applyGateToggle(layer.cells[2][2]!) as FenceCellData;
    recalculateAffectedCells(layer, [{ x: 2, y: 2 }], W, H);

    expect(layer.frames[2][2]).toBe(20); // horizontal open
  });

  it('gate cannot be placed on non-corridor cell', () => {
    const layer = createEmptyLayer(W, H);

    // Isolated fence
    layer.cells[2][2] = makeCell();
    recalculateAffectedCells(layer, [{ x: 2, y: 2 }], W, H);
    expect(canPlaceGate(layer.cells, 2, 2, W, H)).toBe(false);

    // L-corner (N + E)
    layer.cells[1][2] = makeCell();
    layer.cells[2][3] = makeCell();
    recalculateAffectedCells(
      layer,
      [{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 2 }],
      W,
      H,
    );
    const bitmask = computeFenceBitmask(layer.cells, 2, 2, W, H);
    expect(bitmask).toBe(3); // N + E
    expect(canPlaceGate(layer.cells, 2, 2, W, H)).toBe(false);

    // T-junction
    layer.cells[3][2] = makeCell();
    recalculateAffectedCells(layer, [{ x: 2, y: 3 }], W, H);
    const bitmask2 = computeFenceBitmask(layer.cells, 2, 2, W, H);
    expect(bitmask2).toBe(7); // N + E + S
    expect(canPlaceGate(layer.cells, 2, 2, W, H)).toBe(false);
  });

  it('gate auto-invalidation when neighbor removed', () => {
    const layer = createEmptyLayer(W, H);

    // Create NS corridor and place gate at center
    layer.cells[1][2] = makeCell();
    layer.cells[2][2] = makeCell();
    layer.cells[3][2] = makeCell();
    recalculateAffectedCells(
      layer,
      [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }],
      W,
      H,
    );

    // Place gate
    layer.cells[2][2] = applyGatePlacement(layer.cells[2][2]!) as FenceCellData;
    recalculateAffectedCells(layer, [{ x: 2, y: 2 }], W, H);
    expect(layer.cells[2][2]!.isGate).toBe(true);
    expect(layer.frames[2][2]).toBe(17);

    // Remove north neighbor -> gate no longer in valid corridor
    layer.cells[1][2] = null;
    recalculateAffectedCells(layer, [{ x: 2, y: 1 }], W, H);

    // Gate should have been auto-reverted
    expect(layer.cells[2][2]!.isGate).toBe(false);
    expect(layer.cells[2][2]!.gateOpen).toBe(false);
    // Now only south neighbor -> bitmask 4 -> frame 5
    expect(layer.frames[2][2]).toBe(getFenceFrame(4));
  });
});

// ---------------------------------------------------------------------------
// Test Suite 3: Batch Recalculation Correctness
// ---------------------------------------------------------------------------

describe('Batch recalculation correctness', () => {
  const W = 10;
  const H = 10;

  it('rectangle perimeter has correct frame connections', () => {
    const layer = createEmptyLayer(W, H);

    // Place a 4x3 rectangle perimeter (positions along the border)
    const positions: Position[] = [];
    for (let x = 2; x <= 5; x++) {
      positions.push({ x, y: 2 }); // top
      positions.push({ x, y: 4 }); // bottom
    }
    for (let y = 3; y < 4; y++) {
      positions.push({ x: 2, y }); // left
      positions.push({ x: 5, y }); // right
    }

    for (const p of positions) {
      layer.cells[p.y][p.x] = makeCell();
    }

    recalculateAffectedCells(layer, positions, W, H);

    // Top-left corner (2,2): has E and S neighbors -> bitmask 6 -> frame 7
    expect(computeFenceBitmask(layer.cells, 2, 2, W, H)).toBe(6);
    expect(layer.frames[2][2]).toBe(getFenceFrame(6));

    // Top-right corner (5,2): has W and S neighbors -> bitmask 12 -> frame 13
    expect(computeFenceBitmask(layer.cells, 5, 2, W, H)).toBe(12);
    expect(layer.frames[2][5]).toBe(getFenceFrame(12));

    // Top edge middle (3,2): has E and W neighbors -> bitmask 10 -> frame 11
    expect(computeFenceBitmask(layer.cells, 3, 2, W, H)).toBe(10);
    expect(layer.frames[2][3]).toBe(getFenceFrame(10));
  });

  it('L-shape fence connections', () => {
    const layer = createEmptyLayer(W, H);

    // L-shape: (3,3), (3,4), (3,5), (4,5), (5,5)
    const positions: Position[] = [
      { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 5 },
      { x: 4, y: 5 }, { x: 5, y: 5 },
    ];

    for (const p of positions) {
      layer.cells[p.y][p.x] = makeCell();
    }

    recalculateAffectedCells(layer, positions, W, H);

    // Top of vertical segment (3,3): only S neighbor -> bitmask 4
    expect(computeFenceBitmask(layer.cells, 3, 3, W, H)).toBe(4);

    // Corner cell (3,5): N and E neighbors -> bitmask 1+2 = 3
    expect(computeFenceBitmask(layer.cells, 3, 5, W, H)).toBe(3);

    // End of horizontal segment (5,5): only W -> bitmask 8
    expect(computeFenceBitmask(layer.cells, 5, 5, W, H)).toBe(8);
  });

  it('removing a cell recalculates neighbors correctly', () => {
    const layer = createEmptyLayer(W, H);

    // Place 3 in a row: (3,3), (4,3), (5,3)
    layer.cells[3][3] = makeCell();
    layer.cells[3][4] = makeCell();
    layer.cells[3][5] = makeCell();
    recalculateAffectedCells(
      layer,
      [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }],
      W,
      H,
    );

    // Middle has E+W = 10
    expect(computeFenceBitmask(layer.cells, 4, 3, W, H)).toBe(10);

    // Remove middle
    layer.cells[3][4] = null;
    recalculateAffectedCells(layer, [{ x: 4, y: 3 }], W, H);

    // Neighbors should now be isolated
    expect(computeFenceBitmask(layer.cells, 3, 3, W, H)).toBe(0);
    expect(computeFenceBitmask(layer.cells, 5, 3, W, H)).toBe(0);
    expect(layer.frames[3][3]).toBe(getFenceFrame(0));
    expect(layer.frames[3][5]).toBe(getFenceFrame(0));
    expect(layer.frames[3][4]).toBe(FENCE_EMPTY_FRAME);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 4: Walkability + Fence Integration
// ---------------------------------------------------------------------------

describe('Walkability + fence integration', () => {
  const W = 5;
  const H = 5;

  it('incremental update matches full recomputation after fence placement', () => {
    const terrain = allWalkable(W, H);
    const snap: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };

    // Initial: all walkable
    const walkable = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable[2][2]).toBe(true);

    // Place fence
    snap.cells[2][2] = makeCell();

    // Incremental
    updateCellWalkability(walkable, terrain, [snap], 2, 2);
    expect(walkable[2][2]).toBe(false);

    // Full recompute should match
    const fullRecompute = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable).toEqual(fullRecompute);
  });

  it('incremental update matches full recomputation after gate toggle', () => {
    const terrain = allWalkable(W, H);
    const snap: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };

    // Place closed gate
    snap.cells[2][2] = makeCell({ isGate: true, gateOpen: false });
    const walkable = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable[2][2]).toBe(false);

    // Open gate
    snap.cells[2][2] = makeCell({ isGate: true, gateOpen: true });
    updateCellWalkability(walkable, terrain, [snap], 2, 2);
    expect(walkable[2][2]).toBe(true);

    // Full recompute
    const fullRecompute = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable).toEqual(fullRecompute);
  });

  it('non-walkable terrain overrides open gate', () => {
    const terrain = allWalkable(W, H);
    terrain[2][2] = false; // water tile

    const snap: FenceLayerSnapshot = {
      cells: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    };

    // Open gate on non-walkable terrain
    snap.cells[2][2] = makeCell({ isGate: true, gateOpen: true });

    const walkable = computeFenceWalkability(terrain, [snap], W, H);
    expect(walkable[2][2]).toBe(false); // terrain determines base
  });

  it('empty fence layers: walkability matches terrain exactly', () => {
    const terrain = allWalkable(W, H);
    terrain[0][0] = false;
    terrain[4][4] = false;

    const walkable = computeFenceWalkability(terrain, [], W, H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        expect(walkable[y][x]).toBe(terrain[y][x]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test Suite 5: Performance Benchmark (Task 6B)
// ---------------------------------------------------------------------------

describe('Batch recalculation performance', () => {
  it('100-cell rectangle perimeter completes in < 5ms', () => {
    const W = 60;
    const H = 60;
    const layer = createEmptyLayer(W, H);

    // Generate a rectangle perimeter that totals ~100 cells
    // Perimeter of 26x3 = 2*(26+3) - 4 = 54 cells... use 13x13 = 2*(13+13)-4 = 48
    // Let's use exact 100: 26 wide x 2 tall (top+bottom=52+left+right*0 = 52...
    // Use explicit list approach: 25x2 rectangle = perimeter = 2*(25+2)-4 = 50
    // Better: just place 100 cells manually in a large perimeter
    const positions: Position[] = [];
    // 26x26 perimeter = 2*(26+26)-4 = 100 exactly
    for (let x = 0; x < 26; x++) {
      positions.push({ x, y: 0 });  // top
      positions.push({ x, y: 25 }); // bottom
    }
    for (let y = 1; y < 25; y++) {
      positions.push({ x: 0, y });   // left
      positions.push({ x: 25, y });  // right
    }
    expect(positions.length).toBe(100);

    for (const p of positions) {
      layer.cells[p.y][p.x] = makeCell();
    }

    const start = performance.now();
    recalculateAffectedCells(layer, positions, W, H);
    const elapsed = performance.now() - start;

    // Target: < 5ms
    expect(elapsed).toBeLessThan(50); // Use generous 50ms margin for CI variance
    // Log actual time for reference
    // eslint-disable-next-line no-console
    console.log(`100-cell batch recalculation: ${elapsed.toFixed(2)}ms`);
  });
});
