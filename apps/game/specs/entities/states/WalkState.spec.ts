import { WalkState } from '../../../src/game/entities/states/WalkState';
import type { PlayerContext } from '../../../src/game/entities/states/types';
import type { StateMachine } from '../../../src/game/entities/StateMachine';
import type { InputController } from '../../../src/game/input/InputController';
import { calculateMovement } from '../../../src/game/systems/movement';

jest.mock('../../../src/game/systems/movement', () => ({
  calculateMovement: jest.fn().mockReturnValue({ x: 60, y: 60, blocked: { x: false, y: false } }),
}));

const mockCalculateMovement = calculateMovement as jest.MockedFunction<typeof calculateMovement>;

/** Create a mock PlayerContext with jest.fn() stubs. */
function createMockContext(
  overrides?: Partial<PlayerContext>
): PlayerContext {
  return {
    sheetKey: 'char-scout',
    facingDirection: 'down',
    inputController: {
      getDirection: jest.fn().mockReturnValue({ x: 1, y: 0 }),
      isMoving: jest.fn().mockReturnValue(true),
      getFacingDirection: jest.fn().mockReturnValue('right'),
      destroy: jest.fn(),
    } as unknown as InputController,
    stateMachine: {
      setState: jest.fn(),
      currentState: 'walk',
      update: jest.fn(),
      context: {},
    } as unknown as StateMachine,
    speed: 100,
    x: 50,
    y: 50,
    mapData: {
      walkable: [[true, true], [true, true]],
      grid: [
        [
          { terrain: 'grass', elevation: 0, meta: {} },
          { terrain: 'grass', elevation: 0, meta: {} },
        ],
        [
          { terrain: 'grass', elevation: 0, meta: {} },
          { terrain: 'grass', elevation: 0, meta: {} },
        ],
      ],
    },
    mapWidth: 10,
    mapHeight: 10,
    tileSize: 16,
    play: jest.fn(),
    setPosition: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

describe('WalkState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateMovement.mockReturnValue({ x: 60, y: 60, blocked: { x: false, y: false } });
  });

  // -----------------------------------------------------------
  // Construction
  // -----------------------------------------------------------
  describe('construction', () => {
    it('should have name "walk"', () => {
      const ctx = createMockContext();
      const state = new WalkState(ctx);
      expect(state.name).toBe('walk');
    });
  });

  // -----------------------------------------------------------
  // enter
  // -----------------------------------------------------------
  describe('enter', () => {
    it('should call play() with correct walk animation key', () => {
      const ctx = createMockContext({ facingDirection: 'down' });
      const state = new WalkState(ctx);

      state.enter();

      expect(ctx.play).toHaveBeenCalledTimes(1);
      expect(ctx.play).toHaveBeenCalledWith('char-scout_walk_down', true);
    });

    it('should use the current facing direction in animation key', () => {
      const ctx = createMockContext({ facingDirection: 'right' });
      const state = new WalkState(ctx);

      state.enter();

      expect(ctx.play).toHaveBeenCalledWith('char-scout_walk_right', true);
    });

    it('should use the context sheetKey in animation key', () => {
      const ctx = createMockContext({ sheetKey: 'char-farmer' });
      const state = new WalkState(ctx);

      state.enter();

      expect(ctx.play).toHaveBeenCalledWith('char-farmer_walk_down', true);
    });
  });

  // -----------------------------------------------------------
  // update - transition to idle
  // -----------------------------------------------------------
  describe('update - transition to idle', () => {
    it('should call setState("idle") when direction is zero', () => {
      const ctx = createMockContext();
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(ctx.stateMachine.setState).toHaveBeenCalledTimes(1);
      expect(ctx.stateMachine.setState).toHaveBeenCalledWith('idle');
    });

    it('should not call calculateMovement when direction is zero', () => {
      const ctx = createMockContext();
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(mockCalculateMovement).not.toHaveBeenCalled();
    });

    it('should not call setPosition when direction is zero', () => {
      const ctx = createMockContext();
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(ctx.setPosition).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // update - movement
  // -----------------------------------------------------------
  describe('update - movement', () => {
    it('should call calculateMovement with correct parameters', () => {
      const ctx = createMockContext();
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 1, y: 0 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('right');
      ctx.facingDirection = 'right';
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(mockCalculateMovement).toHaveBeenCalledTimes(1);
      expect(mockCalculateMovement).toHaveBeenCalledWith({
        position: { x: 50, y: 50 },
        direction: { x: 1, y: 0 },
        speed: 100,
        delta: 16.67,
        walkable: ctx.mapData.walkable,
        grid: ctx.mapData.grid,
        mapWidth: 10,
        mapHeight: 10,
        tileSize: 16,
      });
    });

    it('should call setPosition with movement result', () => {
      const ctx = createMockContext();
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 1, y: 0 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('right');
      ctx.facingDirection = 'right';
      mockCalculateMovement.mockReturnValue({ x: 55, y: 50, blocked: { x: false, y: false } });
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(ctx.setPosition).toHaveBeenCalledTimes(1);
      expect(ctx.setPosition).toHaveBeenCalledWith(55, 50);
    });

    it('should normalize diagonal direction before calling calculateMovement', () => {
      const ctx = createMockContext();
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 1, y: 1 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('right');
      ctx.facingDirection = 'right';
      const state = new WalkState(ctx);

      state.update(16.67);

      const norm = 1 / Math.sqrt(2);
      expect(mockCalculateMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: {
            x: expect.closeTo(norm, 5),
            y: expect.closeTo(norm, 5),
          },
        })
      );
    });

    it('should use current context position for movement calculation', () => {
      const ctx = createMockContext({ x: 120, y: 80 });
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 0, y: 1 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('down');
      ctx.facingDirection = 'down';
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(mockCalculateMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 120, y: 80 },
          direction: { x: 0, y: 1 },
        })
      );
    });
  });

  // -----------------------------------------------------------
  // update - direction change
  // -----------------------------------------------------------
  describe('update - direction change', () => {
    it('should update animation when facing direction changes', () => {
      const ctx = createMockContext({ facingDirection: 'down' });
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 1, y: 0 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('right');
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(ctx.play).toHaveBeenCalledTimes(1);
      expect(ctx.play).toHaveBeenCalledWith('char-scout_walk_right', true);
    });

    it('should update facingDirection on context when direction changes', () => {
      const ctx = createMockContext({ facingDirection: 'down' });
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: -1, y: 0 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('left');
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(ctx.facingDirection).toBe('left');
    });

    it('should not call play when facing direction has not changed', () => {
      const ctx = createMockContext({ facingDirection: 'right' });
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 1, y: 0 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('right');
      const state = new WalkState(ctx);

      state.update(16.67);

      expect(ctx.play).not.toHaveBeenCalled();
    });

    it('should handle multiple direction changes across frames', () => {
      const ctx = createMockContext({ facingDirection: 'down' });
      const state = new WalkState(ctx);

      // Frame 1: change to right
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 1, y: 0 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('right');
      state.update(16.67);
      expect(ctx.facingDirection).toBe('right');
      expect(ctx.play).toHaveBeenCalledWith('char-scout_walk_right', true);

      jest.clearAllMocks();
      mockCalculateMovement.mockReturnValue({ x: 60, y: 60, blocked: { x: false, y: false } });

      // Frame 2: change to up
      (ctx.inputController.getDirection as jest.Mock).mockReturnValue({ x: 0, y: -1 });
      (ctx.inputController.getFacingDirection as jest.Mock).mockReturnValue('up');
      state.update(16.67);
      expect(ctx.facingDirection).toBe('up');
      expect(ctx.play).toHaveBeenCalledWith('char-scout_walk_up', true);
    });
  });
});
