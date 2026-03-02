/**
 * Unit tests for Player.reconcile() movement prediction behavior.
 *
 * Tests verify:
 * 1. Small delta (< CORRECTION_THRESHOLD) activates interpolation
 * 2. Large delta (>= CORRECTION_THRESHOLD) triggers snap
 * 3. Snap sets position equal to authoritative
 * 4. Interpolation converges toward authoritative over multiple frames
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { CORRECTION_THRESHOLD, INTERPOLATION_SPEED } from '@nookstead/shared';

// Mock Phaser before importing Player (must be before any import that uses Phaser)
jest.mock('phaser', () => {
  class MockSprite {
    x: number;
    y: number;
    scene: any;

    constructor(scene: any, x: number, y: number, _textureKey: string) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setPosition(x: number, y: number): this {
      this.x = x;
      this.y = y;
      return this;
    }

    setOrigin(_originX: number, _originY: number): this {
      return this;
    }

    setDepth(_depth: number): this {
      return this;
    }

    play(_key: string, _ignoreIfPlaying?: boolean): this {
      return this;
    }

    preUpdate(_time: number, _delta: number): void {
      // No-op base implementation
    }
  }

  return {
    __esModule: true,
    default: {
      GameObjects: {
        Sprite: MockSprite,
      },
    },
    GameObjects: {
      Sprite: MockSprite,
    },
  };
});

// Mock colyseus service (imported by WalkState via ../../../services/colyseus)
// Path resolved relative to this test file: ../../services/colyseus -> src/services/colyseus
jest.mock('../../services/colyseus', () => ({
  getRoom: jest.fn(() => null),
}));

import { Player } from './Player';
import type { GeneratedMap } from '@nookstead/shared';

/**
 * Create a mock Phaser scene with the minimum API surface
 * needed by Player constructor and InputController.
 */
function createMockScene(): any {
  const mockKey = { isDown: false };
  return {
    add: {
      existing: jest.fn(),
    },
    input: {
      keyboard: {
        createCursorKeys: jest.fn(() => ({
          up: { ...mockKey },
          down: { ...mockKey },
          left: { ...mockKey },
          right: { ...mockKey },
          space: { ...mockKey },
          shift: { ...mockKey },
        })),
        addKeys: jest.fn(() => ({
          W: { ...mockKey },
          A: { ...mockKey },
          S: { ...mockKey },
          D: { ...mockKey },
        })),
      },
    },
  };
}

/**
 * Create a mock GeneratedMap large enough for reconcile tests.
 * The walkable grid must cover all pixel positions used in tests
 * (up to ~200px → tile 12 at TILE_SIZE=16) so the displacement
 * check in preUpdate() doesn't relocate the player.
 */
function createMockMapData(): GeneratedMap {
  const size = 20;
  const row = () => Array.from({ length: size }, () => true);
  const gridRow = () =>
    Array.from({ length: size }, () => ({
      terrain: 'grass',
      elevation: 1,
      meta: {},
    }));
  return {
    width: size,
    height: size,
    seed: 42,
    grid: Array.from({ length: size }, gridRow),
    layers: [],
    walkable: Array.from({ length: size }, row),
  };
}

describe('Player: Movement Prediction', () => {
  let player: Player;

  beforeEach(() => {
    const mockScene = createMockScene();
    const mockMapData = createMockMapData();
    player = new Player(mockScene, 100, 100, mockMapData);

    // Ensure starting state is consistent
    player.x = 100;
    player.y = 100;
    player.authoritativeX = 100;
    player.authoritativeY = 100;
  });

  describe('reconcile(): small delta triggers interpolation', () => {
    it('should activate interpolation when delta < CORRECTION_THRESHOLD', () => {
      // Delta of 3px is well below CORRECTION_THRESHOLD (8px)
      const smallDelta = CORRECTION_THRESHOLD - 5;
      const serverX = 100 + smallDelta;
      const serverY = 100;

      player.reconcile(serverX, serverY);

      // Player should NOT snap: position remains at 100 after reconcile call
      expect(player.x).toBe(100);
      expect(player.y).toBe(100);

      // After one frame of preUpdate, interpolation moves position toward authoritative
      player.preUpdate(0, 16);

      // x should have moved toward serverX but not reached it
      expect(player.x).toBeGreaterThan(100);
      expect(player.x).toBeLessThan(serverX);
    });
  });

  describe('reconcile(): large delta triggers snap', () => {
    it('should snap to authoritative when delta >= CORRECTION_THRESHOLD', () => {
      // Delta of 25px is well above CORRECTION_THRESHOLD (8px)
      const largeDelta = CORRECTION_THRESHOLD + 17;
      const serverX = 100 + largeDelta;
      const serverY = 100;

      player.reconcile(serverX, serverY);

      // Player should snap immediately to server position
      expect(player.x).toBe(serverX);
      expect(player.y).toBe(100);
    });

    it('should set position equal to authoritative after snap', () => {
      const serverX = 200;
      const serverY = 150;

      player.reconcile(serverX, serverY);

      // Verify predicted position equals authoritative after snap
      expect(player.x).toBe(player.authoritativeX);
      expect(player.y).toBe(player.authoritativeY);
      expect(player.x).toBe(200);
      expect(player.y).toBe(150);
    });
  });

  describe('reconcile(): interpolation converges toward authoritative over frames', () => {
    it('should converge toward authoritative position over multiple frames', () => {
      // Setup: small delta of 5px (below CORRECTION_THRESHOLD of 8px)
      const initialDelta = 5;
      const targetX = 100 + initialDelta;
      player.x = 100;
      player.y = 100;

      player.reconcile(targetX, 100);

      // Verify authoritative was set
      expect(player.authoritativeX).toBe(targetX);

      // Simulate 10 frames of interpolation
      const frameCount = 10;
      const positions: number[] = [];
      for (let i = 0; i < frameCount; i++) {
        player.preUpdate(0, 16);
        positions.push(player.x);
      }

      // Each subsequent position should be closer to (or equal to) the target
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }

      // After 10 frames with delta-time interpolation:
      // Per-frame factor = 1 - (1 - INTERPOLATION_SPEED)^(delta/16.67)
      // With delta=16: factor ≈ 0.1927, retention = 1 - factor ≈ 0.8073
      // remaining = initialDelta * retention^frameCount
      // The lerp also has a 0.5px snap threshold in preUpdate, so if remaining
      // drops below 0.5, the position snaps to authoritative.
      const frameDelta = 16;
      const retention = Math.pow(1 - INTERPOLATION_SPEED, frameDelta / 16.67);
      const remaining = initialDelta * Math.pow(retention, frameCount);
      const expectedMin = targetX - remaining - 0.01;

      expect(player.x).toBeGreaterThan(expectedMin);
      expect(player.x).toBeLessThanOrEqual(targetX);

      // Y should remain unchanged (no Y delta)
      expect(player.y).toBe(100);
    });
  });
});
