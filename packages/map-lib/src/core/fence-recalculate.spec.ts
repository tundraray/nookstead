import {
  recalculateAffectedCells,
  RecalculateLayer,
  RecalculateCell,
  Position,
} from './fence-recalculate';
import {
  FENCE_EMPTY_FRAME,
  getFenceFrame,
  getGateFrameIndex,
} from './fence-autotile';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a regular fence cell. */
const fence = (): RecalculateCell => ({ isGate: false, gateOpen: false });

/** Create a gate cell. */
const gate = (open = false): RecalculateCell => ({ isGate: true, gateOpen: open });

/**
 * Build a layer of the given dimensions filled with null cells and frame 0.
 */
function makeLayer(width: number, height: number): RecalculateLayer {
  const cells: (RecalculateCell | null)[][] = [];
  const frames: number[][] = [];
  for (let y = 0; y < height; y++) {
    cells.push(new Array(width).fill(null));
    frames.push(new Array(width).fill(FENCE_EMPTY_FRAME));
  }
  return { cells, frames };
}

/**
 * Place a fence cell at (x, y) in the layer.
 */
function placeAt(layer: RecalculateLayer, x: number, y: number, cell?: RecalculateCell): void {
  layer.cells[y][x] = cell ?? fence();
}

// ---------------------------------------------------------------------------
// Single cell changes
// ---------------------------------------------------------------------------

describe('recalculateAffectedCells', () => {
  describe('single cell changes', () => {
    test('placing isolated fence: affected set = placed cell only (no neighbors); frame = 1 (isolated post)', () => {
      const layer = makeLayer(5, 5);
      placeAt(layer, 2, 2);

      recalculateAffectedCells(layer, [{ x: 2, y: 2 }], 5, 5);

      // Isolated fence: bitmask 0 -> frame 1
      expect(layer.frames[2][2]).toBe(getFenceFrame(0)); // 1
      // All other frames remain 0
      expect(layer.frames[0][0]).toBe(FENCE_EMPTY_FRAME);
      expect(layer.frames[1][1]).toBe(FENCE_EMPTY_FRAME);
    });

    test('placing fence adjacent to existing fence: affected set = placed cell + existing neighbor; both frames updated', () => {
      const layer = makeLayer(5, 5);
      // Existing fence at (2, 2)
      placeAt(layer, 2, 2);
      layer.frames[2][2] = getFenceFrame(0); // currently isolated

      // Place new fence to the east at (3, 2)
      placeAt(layer, 3, 2);
      recalculateAffectedCells(layer, [{ x: 3, y: 2 }], 5, 5);

      // (x=2,y=2) now has east neighbor -> bitmask 2 (E) -> frame 3
      expect(layer.frames[2][2]).toBe(getFenceFrame(2)); // 3
      // (x=3,y=2) now has west neighbor -> bitmask 8 (W) -> frame 9
      expect(layer.frames[2][3]).toBe(getFenceFrame(8)); // 9
    });

    test('removing fence with neighbors: affected set = removed cell + its neighbors; neighbor frames updated', () => {
      const layer = makeLayer(5, 5);
      // Place 3-cell horizontal line: (1,2), (2,2), (3,2)
      placeAt(layer, 1, 2);
      placeAt(layer, 2, 2);
      placeAt(layer, 3, 2);
      recalculateAffectedCells(layer, [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }], 5, 5);

      // Verify initial state: corridor (frames[y][x])
      expect(layer.frames[2][1]).toBe(getFenceFrame(2));  // (x=1,y=2) E only -> frame 3
      expect(layer.frames[2][2]).toBe(getFenceFrame(10)); // (x=2,y=2) E|W -> frame 11
      expect(layer.frames[2][3]).toBe(getFenceFrame(8));  // (x=3,y=2) W only -> frame 9

      // Now remove center cell (x=2,y=2)
      layer.cells[2][2] = null;
      recalculateAffectedCells(layer, [{ x: 2, y: 2 }], 5, 5);

      // (x=2,y=2) is null -> frame = FENCE_EMPTY_FRAME
      expect(layer.frames[2][2]).toBe(FENCE_EMPTY_FRAME);
      // (x=1,y=2) lost its east neighbor -> now isolated -> bitmask 0 -> frame 1
      expect(layer.frames[2][1]).toBe(getFenceFrame(0)); // 1
      // (x=3,y=2) lost its west neighbor -> now isolated -> bitmask 0 -> frame 1
      expect(layer.frames[2][3]).toBe(getFenceFrame(0)); // 1
    });
  });

  // ---------------------------------------------------------------------------
  // Rectangle perimeter recalculation
  // ---------------------------------------------------------------------------

  describe('rectangle perimeter recalculation', () => {
    test('placing 4-cell 2x2 perimeter: all 4 cells updated with correct L-corner frames', () => {
      const layer = makeLayer(4, 4);
      // Place 2x2 square: (1,1), (2,1), (1,2), (2,2)
      placeAt(layer, 1, 1);
      placeAt(layer, 2, 1);
      placeAt(layer, 1, 2);
      placeAt(layer, 2, 2);

      const changed: Position[] = [
        { x: 1, y: 1 }, { x: 2, y: 1 },
        { x: 1, y: 2 }, { x: 2, y: 2 },
      ];
      recalculateAffectedCells(layer, changed, 4, 4);

      // (1,1): E+S neighbors -> bitmask 6 (E|S) -> frame 7
      expect(layer.frames[1][1]).toBe(getFenceFrame(6)); // 7
      // (2,1): S+W neighbors -> bitmask 12 (S|W) -> frame 13
      expect(layer.frames[1][2]).toBe(getFenceFrame(12)); // 13
      // (1,2): N+E neighbors -> bitmask 3 (N|E) -> frame 4
      expect(layer.frames[2][1]).toBe(getFenceFrame(3)); // 4
      // (2,2): N+W neighbors -> bitmask 9 (N|W) -> frame 10
      expect(layer.frames[2][2]).toBe(getFenceFrame(9)); // 10
    });

    test('placing 4-cell horizontal line: endpoints get dead-end frames, middle cells get corridor frames', () => {
      const layer = makeLayer(6, 3);
      // Place horizontal line: (1,1), (2,1), (3,1), (4,1)
      placeAt(layer, 1, 1);
      placeAt(layer, 2, 1);
      placeAt(layer, 3, 1);
      placeAt(layer, 4, 1);

      const changed: Position[] = [
        { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
      ];
      recalculateAffectedCells(layer, changed, 6, 3);

      // (1,1): E only -> bitmask 2 -> frame 3 (dead-end east)
      expect(layer.frames[1][1]).toBe(getFenceFrame(2)); // 3
      // (2,1): E|W -> bitmask 10 -> frame 11 (EW corridor)
      expect(layer.frames[1][2]).toBe(getFenceFrame(10)); // 11
      // (3,1): E|W -> bitmask 10 -> frame 11 (EW corridor)
      expect(layer.frames[1][3]).toBe(getFenceFrame(10)); // 11
      // (4,1): W only -> bitmask 8 -> frame 9 (dead-end west)
      expect(layer.frames[1][4]).toBe(getFenceFrame(8)); // 9
    });

    test('placing 4-cell vertical line: endpoints get dead-end frames, middle cells get corridor frames', () => {
      const layer = makeLayer(3, 6);
      // Place vertical line: (1,1), (1,2), (1,3), (1,4)
      placeAt(layer, 1, 1);
      placeAt(layer, 1, 2);
      placeAt(layer, 1, 3);
      placeAt(layer, 1, 4);

      const changed: Position[] = [
        { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 },
      ];
      recalculateAffectedCells(layer, changed, 3, 6);

      // (1,1): S only -> bitmask 4 -> frame 5 (dead-end south)
      expect(layer.frames[1][1]).toBe(getFenceFrame(4)); // 5
      // (1,2): N|S -> bitmask 5 -> frame 6 (NS corridor)
      expect(layer.frames[2][1]).toBe(getFenceFrame(5)); // 6
      // (1,3): N|S -> bitmask 5 -> frame 6 (NS corridor)
      expect(layer.frames[3][1]).toBe(getFenceFrame(5)); // 6
      // (1,4): N only -> bitmask 1 -> frame 2 (dead-end north)
      expect(layer.frames[4][1]).toBe(getFenceFrame(1)); // 2
    });
  });

  // ---------------------------------------------------------------------------
  // Gate interactions
  // ---------------------------------------------------------------------------

  describe('gate interactions', () => {
    test('gate auto-invalidation: gate at NS corridor, north neighbor removed -> gate reverts to fence', () => {
      const layer = makeLayer(3, 3);
      // N-S corridor with gate at center
      placeAt(layer, 1, 0); // north
      placeAt(layer, 1, 1, gate(false)); // center gate
      placeAt(layer, 1, 2); // south

      // First recalculate to set correct frames
      recalculateAffectedCells(
        layer,
        [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
        3, 3
      );

      // Verify gate is valid (frame = 17 for NS closed gate)
      expect(layer.frames[1][1]).toBe(getGateFrameIndex(5, false)); // 17
      expect(layer.cells[1][1]!.isGate).toBe(true);

      // Remove north neighbor
      layer.cells[0][1] = null;
      recalculateAffectedCells(layer, [{ x: 1, y: 0 }], 3, 3);

      // Gate should be auto-invalidated: bitmask is now 4 (S only), not 5 or 10
      expect(layer.cells[1][1]!.isGate).toBe(false);
      expect(layer.cells[1][1]!.gateOpen).toBe(false);
      // Frame should now be a regular fence frame for bitmask 4 (S only) -> frame 5
      expect(layer.frames[1][1]).toBe(getFenceFrame(4)); // 5
    });

    test('gate auto-invalidation: gate at EW corridor, east neighbor removed -> gate reverts to fence', () => {
      const layer = makeLayer(3, 3);
      // E-W corridor with gate at center
      placeAt(layer, 0, 1); // west
      placeAt(layer, 1, 1, gate(false)); // center gate
      placeAt(layer, 2, 1); // east

      // First recalculate to set correct frames
      recalculateAffectedCells(
        layer,
        [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        3, 3
      );

      // Verify gate is valid (frame = 19 for EW closed gate)
      expect(layer.frames[1][1]).toBe(getGateFrameIndex(10, false)); // 19
      expect(layer.cells[1][1]!.isGate).toBe(true);

      // Remove east neighbor
      layer.cells[1][2] = null;
      recalculateAffectedCells(layer, [{ x: 2, y: 1 }], 3, 3);

      // Gate should be auto-invalidated: bitmask is now 8 (W only), not 5 or 10
      expect(layer.cells[1][1]!.isGate).toBe(false);
      expect(layer.cells[1][1]!.gateOpen).toBe(false);
      // Frame should now be a regular fence frame for bitmask 8 (W only) -> frame 9
      expect(layer.frames[1][1]).toBe(getFenceFrame(8)); // 9
    });

    test('valid gate after recalculation: gate at NS corridor, south neighbor added -> bitmask still 5 -> gate frame preserved', () => {
      const layer = makeLayer(3, 4);
      // N-S corridor with gate at center: north at (1,0), gate at (1,1), south at (1,2)
      placeAt(layer, 1, 0); // north
      placeAt(layer, 1, 1, gate(false)); // center gate
      placeAt(layer, 1, 2); // south

      recalculateAffectedCells(
        layer,
        [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
        3, 4
      );

      // Verify gate is valid
      expect(layer.frames[1][1]).toBe(getGateFrameIndex(5, false)); // 17

      // Add another fence south of the corridor at (1,3)
      placeAt(layer, 1, 3);
      recalculateAffectedCells(layer, [{ x: 1, y: 3 }], 3, 4);

      // Gate should still be valid: bitmask at (1,1) is still 5 (N|S)
      expect(layer.cells[1][1]!.isGate).toBe(true);
      expect(layer.frames[1][1]).toBe(getGateFrameIndex(5, false)); // 17
    });
  });

  // ---------------------------------------------------------------------------
  // Performance characteristic
  // ---------------------------------------------------------------------------

  describe('determinism', () => {
    test('recalculating 100 cells with 4 neighbors each: result is deterministic (order of iteration does not matter)', () => {
      // Create a 12x12 grid and place a 10x10 block of fences (100 cells)
      const width = 12;
      const height = 12;

      const buildLayer = (): RecalculateLayer => {
        const layer = makeLayer(width, height);
        for (let y = 1; y <= 10; y++) {
          for (let x = 1; x <= 10; x++) {
            placeAt(layer, x, y);
          }
        }
        return layer;
      };

      // Build changed positions in forward order
      const forwardPositions: Position[] = [];
      for (let y = 1; y <= 10; y++) {
        for (let x = 1; x <= 10; x++) {
          forwardPositions.push({ x, y });
        }
      }

      // Build changed positions in reverse order
      const reversePositions = [...forwardPositions].reverse();

      // Build changed positions in random-like order (interleaved)
      const shuffledPositions = [...forwardPositions].sort(
        (a, b) => ((a.x * 7 + a.y * 13) % 17) - ((b.x * 7 + b.y * 13) % 17)
      );

      const layer1 = buildLayer();
      const layer2 = buildLayer();
      const layer3 = buildLayer();

      recalculateAffectedCells(layer1, forwardPositions, width, height);
      recalculateAffectedCells(layer2, reversePositions, width, height);
      recalculateAffectedCells(layer3, shuffledPositions, width, height);

      // All three should produce identical frame arrays
      expect(layer1.frames).toEqual(layer2.frames);
      expect(layer1.frames).toEqual(layer3.frames);
    });
  });

  // ---------------------------------------------------------------------------
  // Boundary cases
  // ---------------------------------------------------------------------------

  describe('boundary cases', () => {
    test('fence at top-left corner: only south and east connections possible', () => {
      const layer = makeLayer(3, 3);
      placeAt(layer, 0, 0); // top-left corner
      placeAt(layer, 1, 0); // east neighbor
      placeAt(layer, 0, 1); // south neighbor

      recalculateAffectedCells(
        layer,
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
        3, 3
      );

      // (0,0): E+S -> bitmask 6 -> frame 7
      expect(layer.frames[0][0]).toBe(getFenceFrame(6)); // 7
      // (1,0): W only -> bitmask 8 -> frame 9
      expect(layer.frames[0][1]).toBe(getFenceFrame(8)); // 9
      // (0,1): N only -> bitmask 1 -> frame 2
      expect(layer.frames[1][0]).toBe(getFenceFrame(1)); // 2
    });

    test('fence at bottom-right corner: only north and west connections possible', () => {
      const layer = makeLayer(3, 3);
      placeAt(layer, 2, 2); // bottom-right corner
      placeAt(layer, 1, 2); // west neighbor
      placeAt(layer, 2, 1); // north neighbor

      recalculateAffectedCells(
        layer,
        [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 1 }],
        3, 3
      );

      // (2,2): N+W -> bitmask 9 -> frame 10
      expect(layer.frames[2][2]).toBe(getFenceFrame(9)); // 10
      // (1,2): E only -> bitmask 2 -> frame 3
      expect(layer.frames[2][1]).toBe(getFenceFrame(2)); // 3
      // (2,1): S only -> bitmask 4 -> frame 5
      expect(layer.frames[1][2]).toBe(getFenceFrame(4)); // 5
    });

    test('recalculate with empty changedPositions: no-op (affected set is empty)', () => {
      const layer = makeLayer(3, 3);
      placeAt(layer, 1, 1);
      layer.frames[1][1] = getFenceFrame(0); // manually set frame

      recalculateAffectedCells(layer, [], 3, 3);

      // Frame should remain unchanged since no positions were changed
      expect(layer.frames[1][1]).toBe(getFenceFrame(0)); // 1 - unchanged
    });
  });
});
