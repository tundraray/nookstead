/**
 * Unit tests for SitState lifecycle behavior.
 *
 * Tests verify:
 * 1. enter() plays sit animation with correct facing direction key (AC-1)
 * 2. enter() sends ANIM_STATE 'sit' to server
 * 3. update() transitions to idle on X key JustDown (AC-2)
 * 4. update() transitions to walk when isMoving() is true (AC-3)
 * 5. update() transitions to walk when moveTarget is set (AC-4)
 * 6. update() transitions to walk when waypoints is non-empty (AC-4)
 * 7. update() ignores X key when isTextInputFocused() is true (AC-5)
 * 8. update() ignores X key when isMovementLocked() is true (AC-6a)
 * 9. update() does not call setPosition or position-mutating methods (AC-7)
 * 10. exit() sends ANIM_STATE 'idle' to server
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock the dialogue-lock module
let mockMovementLocked = false;
jest.mock('../../systems/dialogue-lock', () => ({
  isMovementLocked: jest.fn(() => mockMovementLocked),
}));

// Mock the InputController module (for isTextInputFocused)
let mockTextInputFocused = false;
jest.mock('../../input/InputController', () => ({
  isTextInputFocused: jest.fn(() => mockTextInputFocused),
  InputController: jest.fn(),
}));

// Mock colyseus service
const mockSend = jest.fn();
jest.mock('../../../services/colyseus', () => ({
  getRoom: jest.fn(() => ({ send: mockSend })),
}));

// Mock Phaser (must provide __esModule and default to satisfy ESM-style import)
// Use closure pattern: the factory returns a function that reads mockJustDown at call time
let mockJustDown = false;
jest.mock('phaser', () => {
  const justDown = jest.fn(() => mockJustDown);
  return {
    __esModule: true,
    default: {
      Input: {
        Keyboard: { JustDown: justDown },
      },
    },
    Input: {
      Keyboard: { JustDown: justDown },
    },
  };
});

import { SitState } from './SitState';
import type { PlayerContext } from './types';
import { ClientMessage } from '@nookstead/shared';

/** State name constants for readability. */
const SIT = 'sit';
const IDLE = 'idle';
const WALK = 'walk';

/**
 * Create a mock PlayerContext with sensible defaults for sit state tests.
 */
function createMockContext(overrides?: Partial<PlayerContext>): PlayerContext {
  return {
    sheetKey: 'player',
    facingDirection: 'down',
    inputController: {
      getDirection: jest.fn(() => ({ x: 0, y: 0 })),
      getFacingDirection: jest.fn(() => 'down' as const),
      isMoving: jest.fn(() => false),
    } as any,
    stateMachine: {
      currentState: SIT,
      setState: jest.fn(),
    } as any,
    speed: 100,
    x: 56,
    y: 64,
    mapData: {
      walkable: Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => true)
      ),
      grid: [] as any,
    },
    mapWidth: 10,
    mapHeight: 10,
    tileSize: 16,
    moveTarget: null,
    play: jest.fn(),
    setPosition: jest.fn(),
    clearMoveTarget: jest.fn(),
    waypoints: [],
    currentWaypointIndex: 0,
    setWaypoints: jest.fn(),
    clearWaypoints: jest.fn(),
    ...overrides,
  };
}

describe('SitState', () => {
  let xKey: { isDown: boolean };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMovementLocked = false;
    mockTextInputFocused = false;
    mockJustDown = false;
    xKey = { isDown: false };
  });

  describe('enter()', () => {
    it('should play sit animation with correct facing direction key', () => {
      const context = createMockContext({ facingDirection: 'right' });
      const sitState = new SitState(context, xKey as any);

      sitState.enter();

      expect(context.play).toHaveBeenCalledWith('player_sit_right', false);
    });

    it('should send ANIM_STATE "sit" to server', () => {
      const context = createMockContext();
      const sitState = new SitState(context, xKey as any);

      sitState.enter();

      expect(mockSend).toHaveBeenCalledWith(ClientMessage.ANIM_STATE, {
        animState: SIT,
      });
    });
  });

  describe('update()', () => {
    it('should transition to idle on X key JustDown', () => {
      mockJustDown = true;
      const context = createMockContext();
      const sitState = new SitState(context, xKey as any);

      sitState.update(16);

      expect(context.stateMachine.setState).toHaveBeenCalledWith(IDLE);
    });

    it('should transition to walk when isMoving() is true', () => {
      const context = createMockContext();
      (context.inputController.isMoving as jest.Mock).mockReturnValue(true);
      const sitState = new SitState(context, xKey as any);

      sitState.update(16);

      expect(context.stateMachine.setState).toHaveBeenCalledWith(WALK);
    });

    it('should transition to walk when moveTarget is set', () => {
      const context = createMockContext({
        moveTarget: { x: 200, y: 200 },
      });
      const sitState = new SitState(context, xKey as any);

      sitState.update(16);

      expect(context.stateMachine.setState).toHaveBeenCalledWith(WALK);
    });

    it('should transition to walk when waypoints is non-empty', () => {
      const context = createMockContext({
        waypoints: [{ x: 5, y: 5 }],
      });
      const sitState = new SitState(context, xKey as any);

      sitState.update(16);

      expect(context.stateMachine.setState).toHaveBeenCalledWith(WALK);
    });

    it('should ignore X key when isTextInputFocused() is true', () => {
      mockTextInputFocused = true;
      mockJustDown = true;
      const context = createMockContext();
      const sitState = new SitState(context, xKey as any);

      sitState.update(16);

      expect(context.stateMachine.setState).not.toHaveBeenCalled();
    });

    it('should ignore X key when isMovementLocked() is true', () => {
      mockMovementLocked = true;
      mockJustDown = true;
      const context = createMockContext();
      const sitState = new SitState(context, xKey as any);

      sitState.update(16);

      expect(context.stateMachine.setState).not.toHaveBeenCalled();
    });

    it('should not call setPosition or position-mutating methods', () => {
      const context = createMockContext();
      const sitState = new SitState(context, xKey as any);

      sitState.update(16);

      expect(context.setPosition).not.toHaveBeenCalled();
    });
  });

  describe('exit()', () => {
    it('should send ANIM_STATE "idle" to server', () => {
      const context = createMockContext();
      const sitState = new SitState(context, xKey as any);

      sitState.exit();

      expect(mockSend).toHaveBeenCalledWith(ClientMessage.ANIM_STATE, {
        animState: IDLE,
      });
    });
  });
});
