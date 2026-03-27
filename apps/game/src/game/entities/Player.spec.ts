/**
 * Unit tests for Player entity.
 *
 * Tests verify:
 * 1. reconcile() is a no-op (client-authoritative MVP)
 * 2. preUpdate() does not apply reconciliation interpolation
 * 3. setWaypoints / clearWaypoints work correctly
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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

  // Minimal EventEmitter mock for EventBus (pulled in by dialogue-lock)
  class MockEventEmitter {
    on() { return this; }
    off() { return this; }
    emit() { return this; }
  }

  return {
    __esModule: true,
    default: {
      GameObjects: {
        Sprite: MockSprite,
      },
      Events: {
        EventEmitter: MockEventEmitter,
      },
    },
    GameObjects: {
      Sprite: MockSprite,
    },
    Events: {
      EventEmitter: MockEventEmitter,
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
        enabled: true,
        disableGlobalCapture: jest.fn(),
        resetKeys: jest.fn(),
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
        addKey: jest.fn(() => ({ ...mockKey })),
      },
    },
  };
}

/**
 * Create a mock GeneratedMap large enough for tests.
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

describe('Player', () => {
  let player: Player;

  beforeEach(() => {
    const mockScene = createMockScene();
    const mockMapData = createMockMapData();
    player = new Player(mockScene, 100, 100, mockMapData);

    // Ensure starting state is consistent
    player.x = 100;
    player.y = 100;
  });

  describe('reconcile(): no-op in client-authoritative MVP', () => {
    it('should not change player position regardless of delta', () => {
      player.reconcile(200, 200);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
    });

    it('should not change position for small deltas either', () => {
      player.reconcile(103, 100);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
    });
  });

  describe('preUpdate(): no reconciliation interpolation', () => {
    it('should not move position toward any server position after preUpdate', () => {
      // Even after reconcile is called, preUpdate should not interpolate
      player.reconcile(200, 200);
      player.preUpdate(0, 16);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
    });

    it('should maintain position over multiple frames', () => {
      player.reconcile(105, 100);

      for (let i = 0; i < 10; i++) {
        player.preUpdate(0, 16);
      }

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
    });
  });

  describe('setWaypoints(): stores waypoints and transitions to walk', () => {
    it('should store waypoints and reset currentWaypointIndex to 0', () => {
      const waypoints = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
      player.setWaypoints(waypoints);

      expect(player.waypoints).toEqual(waypoints);
      expect(player.currentWaypointIndex).toBe(0);
    });

    it('should transition to walk state when idle and waypoints are non-empty', () => {
      expect(player.stateMachine.currentState).toBe('idle');

      player.setWaypoints([{ x: 1, y: 0 }]);

      expect(player.stateMachine.currentState).toBe('walk');
    });

    it('should not transition when waypoints array is empty', () => {
      expect(player.stateMachine.currentState).toBe('idle');

      player.setWaypoints([]);

      expect(player.stateMachine.currentState).toBe('idle');
      expect(player.waypoints).toEqual([]);
      expect(player.currentWaypointIndex).toBe(0);
    });
  });

  describe('clearWaypoints(): empties waypoints and resets index', () => {
    it('should empty waypoints and reset currentWaypointIndex to 0', () => {
      player.setWaypoints([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
      player.currentWaypointIndex = 1;

      player.clearWaypoints();

      expect(player.waypoints).toEqual([]);
      expect(player.currentWaypointIndex).toBe(0);
    });
  });
});
