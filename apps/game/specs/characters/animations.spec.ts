import { registerAnimations } from '../../src/game/characters/animations';
import { getAnimationDefs } from '../../src/game/characters/frame-map';

/**
 * Creates a mock Phaser.Scene with a recording AnimationManager.
 *
 * The mock tracks all calls to `anims.create` and implements
 * `anims.generateFrameNumbers` as a simple frame-object mapper,
 * matching Phaser's return format: `{ key, frame }[]`.
 */
function createMockScene() {
  const createdAnims: Array<{
    key: string;
    frames: Array<{ key: string; frame: number }>;
    frameRate: number;
    repeat: number;
  }> = [];

  const scene = {
    anims: {
      create: (config: {
        key: string;
        frames: Array<{ key: string; frame: number }>;
        frameRate: number;
        repeat: number;
      }) => {
        createdAnims.push(config);
      },
      generateFrameNumbers: (
        key: string,
        config: { frames: number[] }
      ): Array<{ key: string; frame: number }> =>
        config.frames.map((f) => ({ key, frame: f })),
    },
  } as unknown as Phaser.Scene;

  return { scene, createdAnims };
}

describe('registerAnimations', () => {
  const SHEET_KEY = 'char-scout';
  const TEXTURE_WIDTH = 927;
  const FRAME_WIDTH = 16;

  let createdAnims: Array<{
    key: string;
    frames: Array<{ key: string; frame: number }>;
    frameRate: number;
    repeat: number;
  }>;
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    const mock = createMockScene();
    createdAnims = mock.createdAnims;
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    registerAnimations(mock.scene, SHEET_KEY, TEXTURE_WIDTH, FRAME_WIDTH);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it('should register exactly 31 animations', () => {
    expect(createdAnims).toHaveLength(31);
  });

  it('should have unique keys for all registered animations', () => {
    const keys = createdAnims.map((a) => a.key);
    expect(new Set(keys).size).toBe(31);
  });

  it('should produce keys matching sheetKey_state_direction format', () => {
    const keyPattern = /^char-scout_[a-z]+_(up|down|left|right)$/;
    for (const anim of createdAnims) {
      expect(anim.key).toMatch(keyPattern);
    }
  });

  describe('repeat values', () => {
    it('should set repeat=0 for idle animations (static frame)', () => {
      const idleAnims = createdAnims.filter((a) => a.key.includes('_idle_'));
      expect(idleAnims).toHaveLength(4);
      for (const anim of idleAnims) {
        expect(anim.repeat).toBe(0);
      }
    });

    it('should set repeat=-1 for walk animations (loop)', () => {
      const walkAnims = createdAnims.filter((a) => a.key.includes('_walk_'));
      expect(walkAnims).toHaveLength(4);
      for (const anim of walkAnims) {
        expect(anim.repeat).toBe(-1);
      }
    });

    it('should set repeat=-1 for waiting animations (loop)', () => {
      const waitAnims = createdAnims.filter((a) =>
        a.key.includes('_waiting_')
      );
      expect(waitAnims).toHaveLength(4);
      for (const anim of waitAnims) {
        expect(anim.repeat).toBe(-1);
      }
    });

    it('should set repeat=0 for sit animations (play once)', () => {
      const sitAnims = createdAnims.filter((a) => a.key.includes('_sit_'));
      expect(sitAnims).toHaveLength(4);
      for (const anim of sitAnims) {
        expect(anim.repeat).toBe(0);
      }
    });

    it('should set repeat=0 for hit animations (play once)', () => {
      const hitAnims = createdAnims.filter((a) => a.key.includes('_hit_'));
      expect(hitAnims).toHaveLength(4);
      for (const anim of hitAnims) {
        expect(anim.repeat).toBe(0);
      }
    });

    it('should set repeat=0 for punch animations (play once)', () => {
      const punchAnims = createdAnims.filter((a) =>
        a.key.includes('_punch_')
      );
      expect(punchAnims).toHaveLength(4);
      for (const anim of punchAnims) {
        expect(anim.repeat).toBe(0);
      }
    });

    it('should set repeat=0 for hurt animations (play once)', () => {
      const hurtAnims = createdAnims.filter((a) => a.key.includes('_hurt_'));
      expect(hurtAnims).toHaveLength(3);
      for (const anim of hurtAnims) {
        expect(anim.repeat).toBe(0);
      }
    });
  });

  describe('frame counts', () => {
    it('should have 1 frame per idle animation (static)', () => {
      const idleAnims = createdAnims.filter((a) => a.key.includes('_idle_'));
      for (const anim of idleAnims) {
        expect(anim.frames).toHaveLength(1);
      }
    });

    it('should have 6 frames per walk animation', () => {
      const walkAnims = createdAnims.filter((a) => a.key.includes('_walk_'));
      for (const anim of walkAnims) {
        expect(anim.frames).toHaveLength(6);
      }
    });

    it('should have 6 frames per waiting animation (reuses wait)', () => {
      const waitAnims = createdAnims.filter((a) =>
        a.key.includes('_waiting_')
      );
      for (const anim of waitAnims) {
        expect(anim.frames).toHaveLength(6);
      }
    });

    it('should have 3 frames per sit animation', () => {
      const sitAnims = createdAnims.filter((a) => a.key.includes('_sit_'));
      for (const anim of sitAnims) {
        expect(anim.frames).toHaveLength(3);
      }
    });

    it('should have 6 frames per hit animation', () => {
      const hitAnims = createdAnims.filter((a) => a.key.includes('_hit_'));
      for (const anim of hitAnims) {
        expect(anim.frames).toHaveLength(6);
      }
    });

    it('should have 6 frames per punch animation', () => {
      const punchAnims = createdAnims.filter((a) =>
        a.key.includes('_punch_')
      );
      for (const anim of punchAnims) {
        expect(anim.frames).toHaveLength(6);
      }
    });

    it('should have 4 frames per hurt animation', () => {
      const hurtAnims = createdAnims.filter((a) => a.key.includes('_hurt_'));
      for (const anim of hurtAnims) {
        expect(anim.frames).toHaveLength(4);
      }
    });
  });

  describe('frame data correctness', () => {
    it('should pass frame objects from generateFrameNumbers to create', () => {
      // Each frame object should have { key: sheetKey, frame: number }
      for (const anim of createdAnims) {
        for (const frameObj of anim.frames) {
          expect(frameObj.key).toBe(SHEET_KEY);
          expect(typeof frameObj.frame).toBe('number');
        }
      }
    });

    it('should match animation defs from getAnimationDefs', () => {
      const expectedDefs = getAnimationDefs('scout', SHEET_KEY);
      expect(createdAnims).toHaveLength(expectedDefs.length);

      for (const expectedDef of expectedDefs) {
        const registered = createdAnims.find(
          (a) => a.key === expectedDef.key
        );
        if (!registered) {
          throw new Error(`Expected animation '${expectedDef.key}' to be registered`);
        }
        expect(registered.frameRate).toBe(expectedDef.frameRate);
        expect(registered.repeat).toBe(expectedDef.repeat);
        expect(registered.frames.map((f) => f.frame)).toEqual(
          expectedDef.frames
        );
      }
    });
  });

  describe('console logging', () => {
    it('should log columns-per-row value via console.info', () => {
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    });

    it('should include sheetKey and texture dimensions in log message', () => {
      const logMessage = consoleInfoSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain(SHEET_KEY);
      expect(logMessage).toContain(String(TEXTURE_WIDTH));
    });
  });
});
