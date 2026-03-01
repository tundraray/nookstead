// Game Object Client Rendering - Walkability Integration Test
// Design Doc: design-011-game-object-client-rendering.md
// Generated: 2026-03-01 | Budget Used: 2/3 integration
//
// Tests the applyObjectCollisionZones() function which overlays object
// collision/walkable zones onto the terrain-based walkability grid.
// This is a pure function that mutates the walkable grid in place.

import { applyObjectCollisionZones } from './walkability';
import type { CollisionZoneDef } from '@nookstead/shared';

// TILE_SIZE constant matching the game client (16px tiles)
const TILE_SIZE = 16;

/** Create a rows x cols walkable grid filled with a given value. */
function createGrid(rows: number, cols: number, value: boolean): boolean[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(value) as boolean[]);
}

/** Helper to build a CollisionZoneDef with sensible defaults. */
function makeZone(
  overrides: Partial<CollisionZoneDef> & Pick<CollisionZoneDef, 'type' | 'x' | 'y' | 'width' | 'height'>,
): CollisionZoneDef {
  return {
    id: overrides.id ?? 'zone-1',
    label: overrides.label ?? 'test zone',
    shape: 'rectangle',
    ...overrides,
  };
}

describe('applyObjectCollisionZones', () => {
  // AC-7.1: "When recomputeWalkability() is called with placed objects data,
  //   collision zones of type 'collision' shall mark overlapping tile cells as non-walkable (false)"
  // AC-7.2: "collision zones of type 'walkable' shall mark overlapping tile cells as walkable (true),
  //   overriding both terrain walkability and prior collision zones"
  // AC-7.3: "The walkability computation shall apply collision zones first, then walkable zones
  //   (walkable overrides collision)"
  // ROI: 90 | Business Value: 9 (movement blocking) | Frequency: 10 (every player movement)
  // Behavior: Placed objects with collision zones -> walkable grid cells updated -> player movement affected
  // @category: core-functionality
  // @dependency: @nookstead/shared (CollisionZoneDef type), walkability module
  // @complexity: medium

  it('should mark collision zone cells as non-walkable', () => {
    // Arrange
    const walkable = createGrid(4, 4, true);
    const placedObjects = [{ objectId: 'obj-a', gridX: 1, gridY: 1 }];
    const objectDefinitions = new Map([
      [
        'obj-a',
        {
          collisionZones: [
            makeZone({ type: 'collision', x: 0, y: 0, width: 16, height: 16 }),
          ],
        },
      ],
    ]);

    // Act
    applyObjectCollisionZones(walkable, placedObjects, objectDefinitions, TILE_SIZE);

    // Assert
    expect(walkable[1][1]).toBe(false);
    // All other cells remain true
    expect(walkable[0][0]).toBe(true);
    expect(walkable[0][1]).toBe(true);
    expect(walkable[0][2]).toBe(true);
    expect(walkable[0][3]).toBe(true);
    expect(walkable[1][0]).toBe(true);
    expect(walkable[1][2]).toBe(true);
    expect(walkable[1][3]).toBe(true);
    expect(walkable[2][0]).toBe(true);
    expect(walkable[2][1]).toBe(true);
    expect(walkable[2][2]).toBe(true);
    expect(walkable[2][3]).toBe(true);
    expect(walkable[3][0]).toBe(true);
    expect(walkable[3][1]).toBe(true);
    expect(walkable[3][2]).toBe(true);
    expect(walkable[3][3]).toBe(true);
  });

  it('should mark walkable zone cells as walkable (override)', () => {
    // Arrange
    const walkable = createGrid(4, 4, false);
    const placedObjects = [{ objectId: 'obj-a', gridX: 2, gridY: 2 }];
    const objectDefinitions = new Map([
      [
        'obj-a',
        {
          collisionZones: [
            makeZone({ type: 'walkable', x: 0, y: 0, width: 16, height: 16 }),
          ],
        },
      ],
    ]);

    // Act
    applyObjectCollisionZones(walkable, placedObjects, objectDefinitions, TILE_SIZE);

    // Assert
    expect(walkable[2][2]).toBe(true);
    // Other cells remain false
    expect(walkable[0][0]).toBe(false);
    expect(walkable[1][1]).toBe(false);
    expect(walkable[3][3]).toBe(false);
    expect(walkable[2][1]).toBe(false);
    expect(walkable[1][2]).toBe(false);
  });

  it('should apply walkable zones after collision zones (walkable overrides collision)', () => {
    // Arrange
    const walkable = createGrid(4, 4, true);
    const placedObjects = [{ objectId: 'obj-a', gridX: 1, gridY: 1 }];
    const objectDefinitions = new Map([
      [
        'obj-a',
        {
          collisionZones: [
            // Collision zone covering 2x2 tiles at offset (0,0)
            makeZone({ id: 'coll-1', type: 'collision', x: 0, y: 0, width: 32, height: 32 }),
            // Walkable zone covering 1 tile at offset (16,0) -> overrides cell [1][2]
            makeZone({ id: 'walk-1', type: 'walkable', x: 16, y: 0, width: 16, height: 16 }),
          ],
        },
      ],
    ]);

    // Act
    applyObjectCollisionZones(walkable, placedObjects, objectDefinitions, TILE_SIZE);

    // Assert
    expect(walkable[1][1]).toBe(false); // collision only
    expect(walkable[1][2]).toBe(true);  // walkable overrides collision
    expect(walkable[2][1]).toBe(false); // collision only
    expect(walkable[2][2]).toBe(false); // collision only
    // Unaffected cells remain true
    expect(walkable[0][0]).toBe(true);
    expect(walkable[0][1]).toBe(true);
    expect(walkable[0][2]).toBe(true);
    expect(walkable[3][3]).toBe(true);
  });

  it('should correctly map pixel-based collision zones to tile grid cells', () => {
    // Arrange
    const walkable = createGrid(4, 4, true);
    // Object at gridX=0, gridY=0 with a collision zone at pixel offset (8,8) size 24x24
    // pixelStartX = 0*16 + 8 = 8, pixelEndX = 8 + 24 = 32
    // pixelStartY = 0*16 + 8 = 8, pixelEndY = 8 + 24 = 32
    // tileStartX = floor(8/16) = 0, tileEndX = ceil(32/16) = 2
    // tileStartY = floor(8/16) = 0, tileEndY = ceil(32/16) = 2
    // -> covers tiles [0][0], [0][1], [1][0], [1][1]
    const placedObjects = [{ objectId: 'obj-a', gridX: 0, gridY: 0 }];
    const objectDefinitions = new Map([
      [
        'obj-a',
        {
          collisionZones: [
            makeZone({ type: 'collision', x: 8, y: 8, width: 24, height: 24 }),
          ],
        },
      ],
    ]);

    // Act
    applyObjectCollisionZones(walkable, placedObjects, objectDefinitions, TILE_SIZE);

    // Assert
    expect(walkable[0][0]).toBe(false);
    expect(walkable[0][1]).toBe(false);
    expect(walkable[1][0]).toBe(false);
    expect(walkable[1][1]).toBe(false);
    // Cells outside the zone remain true
    expect(walkable[0][2]).toBe(true);
    expect(walkable[0][3]).toBe(true);
    expect(walkable[1][2]).toBe(true);
    expect(walkable[2][0]).toBe(true);
    expect(walkable[2][1]).toBe(true);
    expect(walkable[3][3]).toBe(true);
  });

  it('should clamp collision zones at map edges without array index errors', () => {
    // Arrange
    const walkable = createGrid(3, 3, true);
    // Object at gridX=2, gridY=2 (bottom-right corner) with 32x32 collision zone
    // pixelStartX = 2*16 + 0 = 32, pixelEndX = 32 + 32 = 64
    // tileStartX = floor(32/16) = 2, tileEndX = min(3, ceil(64/16)) = min(3, 4) = 3
    // tileStartY = floor(32/16) = 2, tileEndY = min(3, ceil(64/16)) = min(3, 4) = 3
    // -> covers only tile [2][2] (clamped to grid bounds)
    const placedObjects = [{ objectId: 'obj-a', gridX: 2, gridY: 2 }];
    const objectDefinitions = new Map([
      [
        'obj-a',
        {
          collisionZones: [
            makeZone({ type: 'collision', x: 0, y: 0, width: 32, height: 32 }),
          ],
        },
      ],
    ]);

    // Act -- should not throw
    expect(() => {
      applyObjectCollisionZones(walkable, placedObjects, objectDefinitions, TILE_SIZE);
    }).not.toThrow();

    // Assert
    expect(walkable[2][2]).toBe(false);
    // Grid dimensions unchanged
    expect(walkable.length).toBe(3);
    expect(walkable[0].length).toBe(3);
    // Other cells remain true
    expect(walkable[0][0]).toBe(true);
    expect(walkable[1][1]).toBe(true);
  });

  it('should handle multiple overlapping collision zones from different objects', () => {
    // Arrange
    const walkable = createGrid(4, 4, true);
    const placedObjects = [
      { objectId: 'obj-a', gridX: 1, gridY: 1 },
      { objectId: 'obj-b', gridX: 1, gridY: 1 },
    ];
    const objectDefinitions = new Map([
      [
        'obj-a',
        {
          collisionZones: [
            makeZone({ id: 'coll-a', type: 'collision', x: 0, y: 0, width: 16, height: 16 }),
          ],
        },
      ],
      [
        'obj-b',
        {
          collisionZones: [
            makeZone({ id: 'coll-b', type: 'collision', x: 16, y: 0, width: 16, height: 16 }),
          ],
        },
      ],
    ]);

    // Act
    applyObjectCollisionZones(walkable, placedObjects, objectDefinitions, TILE_SIZE);

    // Assert
    expect(walkable[1][1]).toBe(false); // Object A collision
    expect(walkable[1][2]).toBe(false); // Object B collision
    // Other cells remain true
    expect(walkable[0][0]).toBe(true);
    expect(walkable[0][1]).toBe(true);
    expect(walkable[2][2]).toBe(true);
    expect(walkable[3][3]).toBe(true);
  });

  it('should skip objects whose objectId is not in objectDefinitions', () => {
    // Arrange
    const walkable = createGrid(4, 4, true);
    const placedObjects = [{ objectId: 'missing-id', gridX: 1, gridY: 1 }];
    const objectDefinitions = new Map<
      string,
      { collisionZones: CollisionZoneDef[] }
    >();

    // Act -- should not throw
    expect(() => {
      applyObjectCollisionZones(walkable, placedObjects, objectDefinitions, TILE_SIZE);
    }).not.toThrow();

    // Assert -- all cells remain true (unchanged)
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(walkable[y][x]).toBe(true);
      }
    }
  });
});
