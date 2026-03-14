/**
 * Unit tests for WalkState waypoint-following behavior.
 *
 * Tests verify:
 * 1. Waypoint following moves toward current waypoint
 * 2. Advancing to next waypoint when within threshold
 * 3. Transitioning to idle when all waypoints exhausted
 * 4. Keyboard input clears waypoints
 * 5. Movement lock clears waypoints
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock the movement system to avoid complex physics calculations
jest.mock('../../systems/movement', () => ({
  calculateMovement: jest.fn(({ position }: any) => ({
    x: position.x,
    y: position.y,
  })),
}));

// Mock the dialogue-lock module
let mockMovementLocked = false;
jest.mock('../../systems/dialogue-lock', () => ({
  isMovementLocked: jest.fn(() => mockMovementLocked),
}));

// Mock colyseus service
jest.mock('../../../services/colyseus', () => ({
  getRoom: jest.fn(() => null),
}));

import { WalkState } from './WalkState';
import type { PlayerContext } from './types';

const TILE_SIZE = 16;

/**
 * Create a mock PlayerContext with sensible defaults for waypoint tests.
 * The player is positioned at the pixel equivalent of tile (3, 3).
 */
function createMockContext(overrides?: Partial<PlayerContext>): PlayerContext {
  return {
    sheetKey: 'player',
    facingDirection: 'down',
    inputController: {
      getDirection: jest.fn(() => ({ x: 0, y: 0 })),
      getFacingDirection: jest.fn(() => 'down' as const),
    } as any,
    stateMachine: {
      currentState: 'walk',
      setState: jest.fn(),
    } as any,
    speed: 100,
    x: 3 * TILE_SIZE + TILE_SIZE / 2, // 56 (center of tile 3)
    y: (3 + 1) * TILE_SIZE,            // 64 (bottom edge of tile 3)
    mapData: {
      walkable: Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => true)
      ),
      grid: [] as any,
    },
    mapWidth: 10,
    mapHeight: 10,
    tileSize: TILE_SIZE,
    moveTarget: null,
    play: jest.fn(),
    setPosition: jest.fn(function (this: any, x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }),
    clearMoveTarget: jest.fn(),
    waypoints: [],
    currentWaypointIndex: 0,
    setWaypoints: jest.fn(),
    clearWaypoints: jest.fn(),
    ...overrides,
  };
}

describe('WalkState: Waypoint Following', () => {
  beforeEach(() => {
    mockMovementLocked = false;
  });

  describe('when waypoints are present', () => {
    it('should call clearWaypoints and clearMoveTarget and transition to idle when player is at the only waypoint', () => {
      // Player is at tile (3,3), waypoint is also at tile (3,3)
      const context = createMockContext({
        waypoints: [{ x: 3, y: 3 }],
        currentWaypointIndex: 0,
      });

      const walkState = new WalkState(context);
      walkState.update(16);

      expect(context.clearWaypoints).toHaveBeenCalled();
      expect(context.clearMoveTarget).toHaveBeenCalled();
      expect(context.stateMachine.setState).toHaveBeenCalledWith('idle');
    });

    it('should advance currentWaypointIndex when player reaches an intermediate waypoint', () => {
      // Player is at tile (3,3), first waypoint is (3,3), second waypoint is (4,3)
      const context = createMockContext({
        waypoints: [{ x: 3, y: 3 }, { x: 4, y: 3 }],
        currentWaypointIndex: 0,
      });

      const walkState = new WalkState(context);
      walkState.update(16);

      // Should advance to next waypoint, not transition to idle
      expect(context.currentWaypointIndex).toBe(1);
      expect(context.stateMachine.setState).not.toHaveBeenCalledWith('idle');
    });
  });

  describe('keyboard input clears waypoints', () => {
    it('should call clearWaypoints when keyboard input is active with waypoints set', () => {
      const context = createMockContext({
        waypoints: [{ x: 5, y: 5 }],
        currentWaypointIndex: 0,
      });
      (context.inputController.getDirection as jest.Mock).mockReturnValue({
        x: 1,
        y: 0,
      });
      (context.inputController.getFacingDirection as jest.Mock).mockReturnValue(
        'right'
      );

      const walkState = new WalkState(context);
      walkState.update(16);

      expect(context.clearWaypoints).toHaveBeenCalled();
    });
  });

  describe('movement lock clears waypoints', () => {
    it('should call clearWaypoints when movement is locked with waypoints set', () => {
      mockMovementLocked = true;
      const context = createMockContext({
        waypoints: [{ x: 5, y: 5 }],
        currentWaypointIndex: 0,
      });

      const walkState = new WalkState(context);
      walkState.update(16);

      expect(context.clearWaypoints).toHaveBeenCalled();
      expect(context.clearMoveTarget).toHaveBeenCalled();
      expect(context.stateMachine.setState).toHaveBeenCalledWith('idle');
    });
  });

  describe('moveTarget fallback preserved', () => {
    it('should still use moveTowardTarget when no waypoints but moveTarget exists', () => {
      const context = createMockContext({
        waypoints: [],
        moveTarget: { x: 200, y: 200 },
      });

      const walkState = new WalkState(context);
      // Should not throw — falls through to moveTarget branch
      walkState.update(16);

      // If moveTarget is far away, it should NOT transition to idle
      expect(context.stateMachine.setState).not.toHaveBeenCalledWith('idle');
    });

    it('should transition to idle when no waypoints and no moveTarget', () => {
      const context = createMockContext({
        waypoints: [],
        moveTarget: null,
      });

      const walkState = new WalkState(context);
      walkState.update(16);

      expect(context.stateMachine.setState).toHaveBeenCalledWith('idle');
    });
  });
});
