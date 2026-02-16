import { IdleState } from '../../../src/game/entities/states/IdleState';
import type { PlayerContext } from '../../../src/game/entities/states/types';
import type { StateMachine } from '../../../src/game/entities/StateMachine';
import type { InputController } from '../../../src/game/input/InputController';

/** Create a mock PlayerContext with jest.fn() stubs. */
function createMockContext(
  overrides?: Partial<PlayerContext>
): PlayerContext {
  return {
    sheetKey: 'char-scout',
    facingDirection: 'down',
    inputController: {
      getDirection: jest.fn().mockReturnValue({ x: 0, y: 0 }),
      isMoving: jest.fn().mockReturnValue(false),
      getFacingDirection: jest.fn().mockReturnValue('down'),
      destroy: jest.fn(),
    } as unknown as InputController,
    stateMachine: {
      setState: jest.fn(),
      currentState: 'idle',
      update: jest.fn(),
      context: {},
    } as unknown as StateMachine,
    speed: 100,
    x: 50,
    y: 50,
    mapData: {
      walkable: [[true]],
      grid: [[{ terrain: 'grass', elevation: 0, meta: {} }]],
    },
    mapWidth: 10,
    mapHeight: 10,
    tileSize: 16,
    moveTarget: null,
    play: jest.fn(),
    setPosition: jest.fn().mockReturnThis(),
    clearMoveTarget: jest.fn(),
    ...overrides,
  };
}

describe('IdleState', () => {
  // -----------------------------------------------------------
  // Construction
  // -----------------------------------------------------------
  describe('construction', () => {
    it('should have name "idle"', () => {
      const ctx = createMockContext();
      const state = new IdleState(ctx);
      expect(state.name).toBe('idle');
    });
  });

  // -----------------------------------------------------------
  // enter
  // -----------------------------------------------------------
  describe('enter', () => {
    it('should call play() with correct idle animation key', () => {
      const ctx = createMockContext({ facingDirection: 'down' });
      const state = new IdleState(ctx);

      state.enter();

      expect(ctx.play).toHaveBeenCalledTimes(1);
      expect(ctx.play).toHaveBeenCalledWith('char-scout_idle_down', true);
    });

    it('should use the current facing direction in animation key', () => {
      const ctx = createMockContext({ facingDirection: 'left' });
      const state = new IdleState(ctx);

      state.enter();

      expect(ctx.play).toHaveBeenCalledWith('char-scout_idle_left', true);
    });

    it('should use the context sheetKey in animation key', () => {
      const ctx = createMockContext({ sheetKey: 'char-farmer' });
      const state = new IdleState(ctx);

      state.enter();

      expect(ctx.play).toHaveBeenCalledWith('char-farmer_idle_down', true);
    });
  });

  // -----------------------------------------------------------
  // update
  // -----------------------------------------------------------
  describe('update', () => {
    it('should not call setState when input is not moving', () => {
      const ctx = createMockContext();
      (ctx.inputController.isMoving as jest.Mock).mockReturnValue(false);
      const state = new IdleState(ctx);

      state.update(16.67);

      expect(ctx.stateMachine.setState).not.toHaveBeenCalled();
    });

    it('should call setState("walk") when input detects movement', () => {
      const ctx = createMockContext();
      (ctx.inputController.isMoving as jest.Mock).mockReturnValue(true);
      const state = new IdleState(ctx);

      state.update(16.67);

      expect(ctx.stateMachine.setState).toHaveBeenCalledTimes(1);
      expect(ctx.stateMachine.setState).toHaveBeenCalledWith('walk');
    });

    it('should check isMoving on every update call', () => {
      const ctx = createMockContext();
      (ctx.inputController.isMoving as jest.Mock).mockReturnValue(false);
      const state = new IdleState(ctx);

      state.update(16.67);
      state.update(16.67);
      state.update(16.67);

      expect(ctx.inputController.isMoving).toHaveBeenCalledTimes(3);
    });
  });
});
