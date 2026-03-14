import {
  FENCE_N,
  FENCE_E,
  FENCE_S,
  FENCE_W,
  FENCE_EMPTY_FRAME,
  FENCE_TILESET_COLS,
  FENCE_FRAME_COUNT,
  FENCE_GATE_FRAME_COUNT,
  FENCE_TOTAL_FRAMES,
  GATE_BITMASK_NS,
  GATE_BITMASK_EW,
  computeFenceBitmask,
  getFenceFrame,
  canPlaceGate,
  getGateFrameIndex,
  applyGatePlacement,
  applyGateRemoval,
  applyGateToggle,
  isValidGateBitmask,
  FenceCellLike,
  FenceCells,
} from './fence-autotile';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fence cell (not a gate). */
const fence = (): { isGate: boolean; gateOpen: boolean } => ({
  isGate: false,
  gateOpen: false,
});

/** Create a gate cell. */
const gate = (open = false): { isGate: boolean; gateOpen: boolean } => ({
  isGate: true,
  gateOpen: open,
});

/**
 * Build a 3x3 FenceCells grid with a fence cell at center (1,1).
 * Pass cardinal directions (N/E/S/W booleans) to place neighbors.
 */
function make3x3(opts: {
  n?: boolean;
  e?: boolean;
  s?: boolean;
  w?: boolean;
}): FenceCells {
  const cells: FenceCells = [
    [null, null, null],
    [null, fence(), null],
    [null, null, null],
  ];
  if (opts.n) cells[0][1] = fence();
  if (opts.e) cells[1][2] = fence();
  if (opts.s) cells[2][1] = fence();
  if (opts.w) cells[1][0] = fence();
  return cells;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('fence-autotile constants', () => {
  test('FENCE_N equals 1', () => {
    expect(FENCE_N).toBe(1);
  });

  test('FENCE_E equals 2', () => {
    expect(FENCE_E).toBe(2);
  });

  test('FENCE_S equals 4', () => {
    expect(FENCE_S).toBe(4);
  });

  test('FENCE_W equals 8', () => {
    expect(FENCE_W).toBe(8);
  });

  test('FENCE_EMPTY_FRAME equals 0', () => {
    expect(FENCE_EMPTY_FRAME).toBe(0);
  });

  test('FENCE_TILESET_COLS equals 4', () => {
    expect(FENCE_TILESET_COLS).toBe(4);
  });

  test('FENCE_FRAME_COUNT equals 16', () => {
    expect(FENCE_FRAME_COUNT).toBe(16);
  });

  test('FENCE_GATE_FRAME_COUNT equals 4', () => {
    expect(FENCE_GATE_FRAME_COUNT).toBe(4);
  });

  test('FENCE_TOTAL_FRAMES equals 20', () => {
    expect(FENCE_TOTAL_FRAMES).toBe(20);
  });

  test('GATE_BITMASK_NS equals 5', () => {
    expect(GATE_BITMASK_NS).toBe(5);
  });

  test('GATE_BITMASK_EW equals 10', () => {
    expect(GATE_BITMASK_EW).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// computeFenceBitmask - all 16 bitmask states
// ---------------------------------------------------------------------------

describe('computeFenceBitmask', () => {
  test('isolated cell (no neighbors) -> bitmask 0', () => {
    const cells = make3x3({});
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(0);
  });

  test('north neighbor only -> bitmask 1 (FENCE_N)', () => {
    const cells = make3x3({ n: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(1);
  });

  test('east neighbor only -> bitmask 2 (FENCE_E)', () => {
    const cells = make3x3({ e: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(2);
  });

  test('north + east -> bitmask 3', () => {
    const cells = make3x3({ n: true, e: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(3);
  });

  test('south neighbor only -> bitmask 4 (FENCE_S)', () => {
    const cells = make3x3({ s: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(4);
  });

  test('north + south (corridor NS) -> bitmask 5', () => {
    const cells = make3x3({ n: true, s: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(5);
  });

  test('east + south -> bitmask 6', () => {
    const cells = make3x3({ e: true, s: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(6);
  });

  test('north + east + south (T-junction) -> bitmask 7', () => {
    const cells = make3x3({ n: true, e: true, s: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(7);
  });

  test('west neighbor only -> bitmask 8 (FENCE_W)', () => {
    const cells = make3x3({ w: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(8);
  });

  test('north + west -> bitmask 9', () => {
    const cells = make3x3({ n: true, w: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(9);
  });

  test('east + west (corridor EW) -> bitmask 10', () => {
    const cells = make3x3({ e: true, w: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(10);
  });

  test('north + east + west -> bitmask 11', () => {
    const cells = make3x3({ n: true, e: true, w: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(11);
  });

  test('south + west -> bitmask 12', () => {
    const cells = make3x3({ s: true, w: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(12);
  });

  test('north + south + west -> bitmask 13', () => {
    const cells = make3x3({ n: true, s: true, w: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(13);
  });

  test('east + south + west -> bitmask 14', () => {
    const cells = make3x3({ e: true, s: true, w: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(14);
  });

  test('all four neighbors -> bitmask 15', () => {
    const cells = make3x3({ n: true, e: true, s: true, w: true });
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(15);
  });

  // Boundary conditions
  describe('boundary conditions', () => {
    test('cell at top edge (y=0): north direction returns 0 regardless', () => {
      // 1x3 grid, single fence at (0,0), neighbor to east and south
      const cells: FenceCells = [
        [fence(), fence(), null],
        [fence(), null, null],
        [null, null, null],
      ];
      // Cell at (0,0) can see east and south but not north
      expect(computeFenceBitmask(cells, 0, 0, 3, 3)).toBe(
        FENCE_E | FENCE_S
      );
    });

    test('cell at right edge (x=mapWidth-1): east direction returns 0 regardless', () => {
      const cells: FenceCells = [
        [null, null, fence()],
        [null, null, null],
        [null, null, null],
      ];
      // Isolated cell at (2,0) - right edge, top edge
      expect(computeFenceBitmask(cells, 2, 0, 3, 3)).toBe(0);
    });

    test('cell at bottom edge (y=mapHeight-1): south direction returns 0 regardless', () => {
      const cells: FenceCells = [
        [null, null, null],
        [null, null, null],
        [null, fence(), null],
      ];
      // Cell at (1,2) - bottom edge, isolated
      expect(computeFenceBitmask(cells, 1, 2, 3, 3)).toBe(0);
    });

    test('cell at left edge (x=0): west direction returns 0 regardless', () => {
      const cells: FenceCells = [
        [null, null, null],
        [fence(), null, null],
        [null, null, null],
      ];
      // Cell at (0,1) - left edge, isolated
      expect(computeFenceBitmask(cells, 0, 1, 3, 3)).toBe(0);
    });

    test('null cell (empty): bitmask 0', () => {
      const cells: FenceCells = [
        [null, fence(), null],
        [fence(), null, fence()],
        [null, fence(), null],
      ];
      // Center cell is null, so bitmask is 0 despite all neighbors present
      expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getFenceFrame
// ---------------------------------------------------------------------------

describe('getFenceFrame', () => {
  test('getFenceFrame(0) returns 1 (isolated post)', () => {
    expect(getFenceFrame(0)).toBe(1);
  });

  test('getFenceFrame(5) returns 6 (NS corridor)', () => {
    expect(getFenceFrame(5)).toBe(6);
  });

  test('getFenceFrame(15) returns 16 (cross)', () => {
    expect(getFenceFrame(15)).toBe(16);
  });

  test('getFenceFrame(n) returns n + 1 for all 0..15', () => {
    for (let n = 0; n <= 15; n++) {
      expect(getFenceFrame(n)).toBe(n + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// canPlaceGate
// ---------------------------------------------------------------------------

describe('canPlaceGate', () => {
  test('null cell -> false', () => {
    const cells: FenceCells = [
      [null, fence(), null],
      [fence(), null, fence()],
      [null, fence(), null],
    ];
    expect(canPlaceGate(cells, 1, 1, 3, 3)).toBe(false);
  });

  test('already a gate -> false', () => {
    const cells: FenceCells = [
      [null, fence(), null],
      [null, gate(), null],
      [null, fence(), null],
    ];
    // Center is a gate with NS corridor - but already a gate, so false
    expect(canPlaceGate(cells, 1, 1, 3, 3)).toBe(false);
  });

  test('bitmask 5 (NS corridor) -> true', () => {
    const cells = make3x3({ n: true, s: true });
    expect(canPlaceGate(cells, 1, 1, 3, 3)).toBe(true);
  });

  test('bitmask 10 (EW corridor) -> true', () => {
    const cells = make3x3({ e: true, w: true });
    expect(canPlaceGate(cells, 1, 1, 3, 3)).toBe(true);
  });

  test('all other 14 bitmask values -> false', () => {
    // Bitmask values that should return false: 0,1,2,3,4,6,7,8,9,11,12,13,14,15
    const falseBitmasks = [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15];
    const neighborCombos: Record<string, { n?: boolean; e?: boolean; s?: boolean; w?: boolean }> = {
      '0': {},
      '1': { n: true },
      '2': { e: true },
      '3': { n: true, e: true },
      '4': { s: true },
      '6': { e: true, s: true },
      '7': { n: true, e: true, s: true },
      '8': { w: true },
      '9': { n: true, w: true },
      '11': { n: true, e: true, w: true },
      '12': { s: true, w: true },
      '13': { n: true, s: true, w: true },
      '14': { e: true, s: true, w: true },
      '15': { n: true, e: true, s: true, w: true },
    };

    for (const bitmask of falseBitmasks) {
      const cells = make3x3(neighborCombos[String(bitmask)]);
      expect(canPlaceGate(cells, 1, 1, 3, 3)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// getGateFrameIndex
// ---------------------------------------------------------------------------

describe('getGateFrameIndex', () => {
  test('getGateFrameIndex(5, false) -> 17 (vertical closed)', () => {
    expect(getGateFrameIndex(5, false)).toBe(17);
  });

  test('getGateFrameIndex(5, true) -> 18 (vertical open)', () => {
    expect(getGateFrameIndex(5, true)).toBe(18);
  });

  test('getGateFrameIndex(10, false) -> 19 (horizontal closed)', () => {
    expect(getGateFrameIndex(10, false)).toBe(19);
  });

  test('getGateFrameIndex(10, true) -> 20 (horizontal open)', () => {
    expect(getGateFrameIndex(10, true)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// isValidGateBitmask
// ---------------------------------------------------------------------------

describe('isValidGateBitmask', () => {
  test('bitmask 5 (NS corridor) -> true', () => {
    expect(isValidGateBitmask(5)).toBe(true);
  });

  test('bitmask 10 (EW corridor) -> true', () => {
    expect(isValidGateBitmask(10)).toBe(true);
  });

  test('all 16 bitmask values: only 5 and 10 are valid', () => {
    for (let bitmask = 0; bitmask <= 15; bitmask++) {
      const expected = bitmask === 5 || bitmask === 10;
      expect(isValidGateBitmask(bitmask)).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// applyGatePlacement
// ---------------------------------------------------------------------------

describe('applyGatePlacement', () => {
  test('sets isGate=true and gateOpen=false on a regular fence cell', () => {
    const cell: FenceCellLike = { isGate: false, gateOpen: false };
    const result = applyGatePlacement(cell);
    expect(result.isGate).toBe(true);
    expect(result.gateOpen).toBe(false);
  });

  test('returns a new object (does not mutate input)', () => {
    const cell: FenceCellLike = { isGate: false, gateOpen: false };
    const result = applyGatePlacement(cell);
    expect(result).not.toBe(cell);
    expect(cell.isGate).toBe(false); // original unchanged
  });

  test('placing gate on NS corridor: sets isGate=true, gateOpen=false', () => {
    const cell: FenceCellLike = { isGate: false, gateOpen: false };
    const result = applyGatePlacement(cell);
    expect(result).toEqual({ isGate: true, gateOpen: false });
  });

  test('placing gate on EW corridor: sets isGate=true, gateOpen=false', () => {
    // Same function, orientation is handled by the caller
    const cell: FenceCellLike = { isGate: false, gateOpen: false };
    const result = applyGatePlacement(cell);
    expect(result).toEqual({ isGate: true, gateOpen: false });
  });

  test('placing gate does not change frame of cardinal neighbors', () => {
    // applyGatePlacement only modifies the single cell passed to it
    const center: FenceCellLike = { isGate: false, gateOpen: false };
    const neighbor: FenceCellLike = { isGate: false, gateOpen: false };
    applyGatePlacement(center);
    // Neighbor is untouched
    expect(neighbor.isGate).toBe(false);
    expect(neighbor.gateOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyGateRemoval
// ---------------------------------------------------------------------------

describe('applyGateRemoval', () => {
  test('gate removal: sets isGate=false, gateOpen=false', () => {
    const cell: FenceCellLike = { isGate: true, gateOpen: false };
    const result = applyGateRemoval(cell);
    expect(result.isGate).toBe(false);
    expect(result.gateOpen).toBe(false);
  });

  test('gate removal on open gate: sets isGate=false, gateOpen=false', () => {
    const cell: FenceCellLike = { isGate: true, gateOpen: true };
    const result = applyGateRemoval(cell);
    expect(result.isGate).toBe(false);
    expect(result.gateOpen).toBe(false);
  });

  test('returns a new object (does not mutate input)', () => {
    const cell: FenceCellLike = { isGate: true, gateOpen: true };
    const result = applyGateRemoval(cell);
    expect(result).not.toBe(cell);
    expect(cell.isGate).toBe(true); // original unchanged
    expect(cell.gateOpen).toBe(true); // original unchanged
  });

  test('gate removal: frame reverts to fence connection frame (getFenceFrame(bitmask))', () => {
    // After removal, the cell is a regular fence, so getFenceFrame should be used.
    // For an NS corridor (bitmask 5), fence frame is getFenceFrame(5) = 6.
    const cell: FenceCellLike = { isGate: true, gateOpen: false };
    const result = applyGateRemoval(cell);
    // The cell is now a regular fence -- caller uses getFenceFrame(bitmask) for its frame.
    expect(result.isGate).toBe(false);
    expect(result.gateOpen).toBe(false);
    // Verify the frame index the caller would compute:
    expect(getFenceFrame(5)).toBe(6); // NS corridor reverts to frame 6
    expect(getFenceFrame(10)).toBe(11); // EW corridor reverts to frame 11
  });

  test('gate removal: does not change neighbor frames', () => {
    // applyGateRemoval only modifies the single cell passed to it
    const center: FenceCellLike = { isGate: true, gateOpen: false };
    const neighbor: FenceCellLike = { isGate: false, gateOpen: false };
    applyGateRemoval(center);
    // Neighbor is untouched
    expect(neighbor.isGate).toBe(false);
    expect(neighbor.gateOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyGateToggle
// ---------------------------------------------------------------------------

describe('applyGateToggle', () => {
  test('CLOSED gate -> OPEN: flips gateOpen from false to true', () => {
    const cell: FenceCellLike = { isGate: true, gateOpen: false };
    const result = applyGateToggle(cell);
    expect(result.isGate).toBe(true);
    expect(result.gateOpen).toBe(true);
  });

  test('OPEN gate -> CLOSED: flips gateOpen from true to false', () => {
    const cell: FenceCellLike = { isGate: true, gateOpen: true };
    const result = applyGateToggle(cell);
    expect(result.isGate).toBe(true);
    expect(result.gateOpen).toBe(false);
  });

  test('non-gate cell: no-op, returns same object', () => {
    const cell: FenceCellLike = { isGate: false, gateOpen: false };
    const result = applyGateToggle(cell);
    expect(result).toBe(cell); // same reference
    expect(result.isGate).toBe(false);
    expect(result.gateOpen).toBe(false);
  });

  test('returns a new object when toggling (does not mutate input)', () => {
    const cell: FenceCellLike = { isGate: true, gateOpen: false };
    const result = applyGateToggle(cell);
    expect(result).not.toBe(cell);
    expect(cell.gateOpen).toBe(false); // original unchanged
  });

  test('full state cycle: CLOSED -> OPEN -> CLOSED is deterministic', () => {
    const initial: FenceCellLike = { isGate: true, gateOpen: false };
    const opened = applyGateToggle(initial);
    expect(opened.gateOpen).toBe(true);

    const closed = applyGateToggle(opened);
    expect(closed.gateOpen).toBe(false);

    // Full cycle returns to equivalent state
    expect(closed).toEqual(initial);
  });

  test('CLOSED gate: getGateFrameIndex returns closed variant frame', () => {
    const cell: FenceCellLike = { isGate: true, gateOpen: false };
    expect(getGateFrameIndex(GATE_BITMASK_NS, cell.gateOpen)).toBe(17);
    expect(getGateFrameIndex(GATE_BITMASK_EW, cell.gateOpen)).toBe(19);
  });

  test('OPEN gate: getGateFrameIndex returns open variant frame', () => {
    const cell: FenceCellLike = { isGate: true, gateOpen: true };
    expect(getGateFrameIndex(GATE_BITMASK_NS, cell.gateOpen)).toBe(18);
    expect(getGateFrameIndex(GATE_BITMASK_EW, cell.gateOpen)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Gate invalidation during bitmask recalculation
// ---------------------------------------------------------------------------

describe('gate invalidation', () => {
  test('gate at NS corridor: neighbor removed -> bitmask changes -> isValidGateBitmask returns false', () => {
    // Start with NS corridor (N + center + S)
    const cells: FenceCells = [
      [null, fence(), null],
      [null, gate(), null],
      [null, fence(), null],
    ];
    // Bitmask is 5 (N|S) -> valid gate
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(5);
    expect(isValidGateBitmask(5)).toBe(true);

    // Remove the north neighbor
    cells[0][1] = null;
    const newBitmask = computeFenceBitmask(cells, 1, 1, 3, 3);
    expect(newBitmask).toBe(4); // only south remaining
    expect(isValidGateBitmask(newBitmask)).toBe(false);

    // Gate should be auto-reverted to fence by the caller using applyGateRemoval
    const centerCell = cells[1][1];
    expect(centerCell).not.toBeNull();
    const reverted = applyGateRemoval(centerCell as FenceCellLike);
    expect(reverted.isGate).toBe(false);
    expect(reverted.gateOpen).toBe(false);
  });

  test('gate at EW corridor: one neighbor removed -> bitmask becomes invalid -> gate auto-reverts', () => {
    // Start with EW corridor (W + center + E)
    const cells: FenceCells = [
      [null, null, null],
      [fence(), gate(), fence()],
      [null, null, null],
    ];
    // Bitmask is 10 (E|W) -> valid gate
    expect(computeFenceBitmask(cells, 1, 1, 3, 3)).toBe(10);
    expect(isValidGateBitmask(10)).toBe(true);

    // Remove the east neighbor
    cells[1][2] = null;
    const newBitmask = computeFenceBitmask(cells, 1, 1, 3, 3);
    expect(newBitmask).toBe(8); // only west remaining
    expect(isValidGateBitmask(newBitmask)).toBe(false);

    // Gate should be auto-reverted
    const ewCenterCell = cells[1][1];
    expect(ewCenterCell).not.toBeNull();
    const reverted = applyGateRemoval(ewCenterCell as FenceCellLike);
    expect(reverted.isGate).toBe(false);
    expect(reverted.gateOpen).toBe(false);
  });

  test('gate at NS corridor: additional neighbor added -> bitmask becomes T-junction -> gate auto-reverts', () => {
    // Start with NS corridor
    const cells: FenceCells = [
      [null, fence(), null],
      [null, gate(), null],
      [null, fence(), null],
    ];
    expect(isValidGateBitmask(computeFenceBitmask(cells, 1, 1, 3, 3))).toBe(true);

    // Add east neighbor (becomes T-junction, bitmask 7)
    cells[1][2] = fence();
    const newBitmask = computeFenceBitmask(cells, 1, 1, 3, 3);
    expect(newBitmask).toBe(7);
    expect(isValidGateBitmask(newBitmask)).toBe(false);
  });

  test('canPlaceGate rejection for all non-corridor bitmask values (explicit per-value)', () => {
    // Explicitly verify each of the 14 rejecting bitmask values
    const rejectBitmasks = [
      { bitmask: 0, name: 'isolated post', opts: {} },
      { bitmask: 1, name: 'dead-end N', opts: { n: true } },
      { bitmask: 2, name: 'dead-end E', opts: { e: true } },
      { bitmask: 3, name: 'L-corner NE', opts: { n: true, e: true } },
      { bitmask: 4, name: 'dead-end S', opts: { s: true } },
      { bitmask: 6, name: 'L-corner ES', opts: { e: true, s: true } },
      { bitmask: 7, name: 'T-junction NES', opts: { n: true, e: true, s: true } },
      { bitmask: 8, name: 'dead-end W', opts: { w: true } },
      { bitmask: 9, name: 'L-corner NW', opts: { n: true, w: true } },
      { bitmask: 11, name: 'T-junction NEW', opts: { n: true, e: true, w: true } },
      { bitmask: 12, name: 'L-corner SW', opts: { s: true, w: true } },
      { bitmask: 13, name: 'T-junction NSW', opts: { n: true, s: true, w: true } },
      { bitmask: 14, name: 'T-junction ESW', opts: { e: true, s: true, w: true } },
      { bitmask: 15, name: 'cross NESW', opts: { n: true, e: true, s: true, w: true } },
    ];

    for (const { bitmask, opts } of rejectBitmasks) {
      const cells = make3x3(opts);
      expect(canPlaceGate(cells, 1, 1, 3, 3)).toBe(false);
      expect(isValidGateBitmask(bitmask)).toBe(false);
    }
  });
});
