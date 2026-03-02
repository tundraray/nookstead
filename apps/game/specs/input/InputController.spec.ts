import {
  InputController,
  isTextInputFocused,
} from '../../src/game/input/InputController';

/**
 * Create a lightweight Phaser.Scene mock with configurable key states.
 *
 * @param keyStates - Map of key names to their pressed state.
 *   Supported keys: 'up', 'down', 'left', 'right' (cursor keys),
 *   'W', 'A', 'S', 'D' (WASD keys), 'space', 'shift'.
 */
function createMockScene(
  keyStates: Record<string, boolean> = {}
): { scene: Phaser.Scene; keyboard: Record<string, unknown> } {
  const makeKey = (name: string) => ({
    isDown: keyStates[name] ?? false,
  });

  const keyboard = {
    enabled: true,
    disableGlobalCapture: jest.fn(),
    resetKeys: jest.fn(),
    createCursorKeys: () => ({
      up: makeKey('up'),
      down: makeKey('down'),
      left: makeKey('left'),
      right: makeKey('right'),
      space: makeKey('space'),
      shift: makeKey('shift'),
    }),
    addKeys: () => ({
      W: makeKey('W'),
      A: makeKey('A'),
      S: makeKey('S'),
      D: makeKey('D'),
    }),
  };

  const scene = { input: { keyboard } } as unknown as Phaser.Scene;
  return { scene, keyboard };
}

describe('InputController', () => {
  // Clean up any controllers that register document listeners
  const controllers: InputController[] = [];
  afterEach(() => {
    controllers.forEach((c) => c.destroy());
    controllers.length = 0;
  });

  function create(keyStates: Record<string, boolean> = {}) {
    const { scene, keyboard } = createMockScene(keyStates);
    const controller = new InputController(scene);
    controllers.push(controller);
    return { controller, keyboard };
  }

  // -----------------------------------------------------------
  // getDirection
  // -----------------------------------------------------------
  describe('getDirection', () => {
    it('should return {0, 0} when no keys are pressed', () => {
      const { controller } = create();
      const dir = controller.getDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('should return {0, -1} when W is pressed', () => {
      const { controller } = create({ W: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(-1);
    });

    it('should return {0, 1} when S is pressed', () => {
      const { controller } = create({ S: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(1);
    });

    it('should return {-1, 0} when A is pressed', () => {
      const { controller } = create({ A: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(-1);
      expect(dir.y).toBe(0);
    });

    it('should return {1, 0} when D is pressed', () => {
      const { controller } = create({ D: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(1);
      expect(dir.y).toBe(0);
    });

    it('should return {1, -1} when W+D are pressed (diagonal)', () => {
      const { controller } = create({ W: true, D: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(1);
      expect(dir.y).toBe(-1);
    });

    it('should return {0, 0} when opposing W+S are pressed', () => {
      const { controller } = create({ W: true, S: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('should return {0, 0} when opposing A+D are pressed', () => {
      const { controller } = create({ A: true, D: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('should return {0, 0} when a text input is focused', () => {
      const { controller } = create({ W: true });
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      const dir = controller.getDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
      input.remove();
    });
  });

  // -----------------------------------------------------------
  // Arrow keys (identical to WASD)
  // -----------------------------------------------------------
  describe('arrow keys', () => {
    it('should return {0, -1} when up arrow is pressed', () => {
      const { controller } = create({ up: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(-1);
    });

    it('should return {0, 1} when down arrow is pressed', () => {
      const { controller } = create({ down: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(1);
    });

    it('should return {-1, 0} when left arrow is pressed', () => {
      const { controller } = create({ left: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(-1);
      expect(dir.y).toBe(0);
    });

    it('should return {1, 0} when right arrow is pressed', () => {
      const { controller } = create({ right: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(1);
      expect(dir.y).toBe(0);
    });

    it('should combine WASD and arrow keys (W + right arrow)', () => {
      const { controller } = create({ W: true, right: true });
      const dir = controller.getDirection();
      expect(dir.x).toBe(1);
      expect(dir.y).toBe(-1);
    });
  });

  // -----------------------------------------------------------
  // isMoving
  // -----------------------------------------------------------
  describe('isMoving', () => {
    it('should return false when no keys are pressed', () => {
      const { controller } = create();
      expect(controller.isMoving()).toBe(false);
    });

    it('should return true when W is pressed', () => {
      const { controller } = create({ W: true });
      expect(controller.isMoving()).toBe(true);
    });

    it('should return false when opposing keys cancel out', () => {
      const { controller } = create({ W: true, S: true });
      expect(controller.isMoving()).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // getFacingDirection
  // -----------------------------------------------------------
  describe('getFacingDirection', () => {
    it('should default to down when no keys are pressed', () => {
      const { controller } = create();
      expect(controller.getFacingDirection()).toBe('down');
    });

    it('should return up when W is pressed', () => {
      const { controller } = create({ W: true });
      expect(controller.getFacingDirection()).toBe('up');
    });

    it('should return down when S is pressed', () => {
      const { controller } = create({ S: true });
      expect(controller.getFacingDirection()).toBe('down');
    });

    it('should return left when A is pressed', () => {
      const { controller } = create({ A: true });
      expect(controller.getFacingDirection()).toBe('left');
    });

    it('should return right when D is pressed', () => {
      const { controller } = create({ D: true });
      expect(controller.getFacingDirection()).toBe('right');
    });

    it('should give horizontal priority for diagonal W+D (facing right)', () => {
      const { controller } = create({ W: true, D: true });
      expect(controller.getFacingDirection()).toBe('right');
    });

    it('should give horizontal priority for diagonal S+A (facing left)', () => {
      const { controller } = create({ S: true, A: true });
      expect(controller.getFacingDirection()).toBe('left');
    });

    it('should persist last facing direction when keys are released', () => {
      const { controller } = create({ D: true });
      expect(controller.getFacingDirection()).toBe('right');

      const { controller: controller2 } = create();
      expect(controller2.getFacingDirection()).toBe('down');
    });
  });

  // -----------------------------------------------------------
  // Text input detection (activeElement polling)
  // -----------------------------------------------------------
  describe('text input detection', () => {
    it('should suppress movement when an input element is focused', () => {
      const { controller } = create({ W: true });

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      expect(controller.getDirection()).toEqual({ x: 0, y: 0 });
      expect(controller.isMoving()).toBe(false);

      input.remove();
    });

    it('should resume movement when an input element loses focus', () => {
      const { controller } = create({ W: true });

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      input.blur();

      expect(controller.getDirection()).toEqual({ x: 0, y: -1 });

      input.remove();
    });

    it('should suppress movement for textarea elements', () => {
      const { controller } = create({ W: true });

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      expect(controller.getDirection()).toEqual({ x: 0, y: 0 });

      textarea.remove();
    });

    it('should suppress movement for select elements', () => {
      const { controller } = create({ W: true });

      const select = document.createElement('select');
      document.body.appendChild(select);
      select.focus();

      expect(controller.getDirection()).toEqual({ x: 0, y: 0 });

      select.remove();
    });

    it('should suppress movement for contenteditable elements', () => {
      const { controller } = create({ W: true });

      const div = document.createElement('div');
      div.contentEditable = 'true';
      // tabIndex needed for JSDOM to make contenteditable focusable
      div.tabIndex = 0;
      document.body.appendChild(div);
      div.focus();

      expect(controller.getDirection()).toEqual({ x: 0, y: 0 });

      div.remove();
    });

    it('should not suppress movement for non-input elements', () => {
      const { controller } = create({ W: true });

      const div = document.createElement('div');
      div.tabIndex = 0;
      document.body.appendChild(div);
      div.focus();

      expect(controller.getDirection()).toEqual({ x: 0, y: -1 });

      div.remove();
    });
  });

  // -----------------------------------------------------------
  // isTextInputFocused (exported utility)
  // -----------------------------------------------------------
  describe('isTextInputFocused', () => {
    it('should return false when body is focused', () => {
      (document.activeElement as HTMLElement)?.blur?.();
      expect(isTextInputFocused()).toBe(false);
    });

    it('should return true for focused input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      expect(isTextInputFocused()).toBe(true);
      input.remove();
    });

    it('should return true for focused contenteditable', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      // tabIndex needed for JSDOM to make contenteditable focusable
      div.tabIndex = 0;
      document.body.appendChild(div);
      div.focus();
      expect(isTextInputFocused()).toBe(true);
      div.remove();
    });

    it('should return false for focused non-input element', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.focus();
      expect(isTextInputFocused()).toBe(false);
      button.remove();
    });
  });

  // -----------------------------------------------------------
  // destroy
  // -----------------------------------------------------------
  describe('destroy', () => {
    it('should not throw when called', () => {
      const { controller } = create();
      expect(() => controller.destroy()).not.toThrow();
    });
  });
});
