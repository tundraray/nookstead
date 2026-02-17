import {
  computeColumnsPerRow,
  animKey,
  getAnimationDefs,
  type AnimationDef,
} from '../../src/game/characters/frame-map';
import { ANIMATION_FPS } from '../../src/game/constants';

/**
 * Type-narrowing helper: asserts value is defined and returns it.
 * Replaces non-null assertions (!) with a proper runtime guard.
 */
function defined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${label} to be defined`);
  }
  return value;
}

describe('computeColumnsPerRow', () => {
  it('should return 57 for 927px width with 16px frames', () => {
    expect(computeColumnsPerRow(927, 16)).toBe(57);
  });

  it('should return 64 for 1024px width with 16px frames (exact division)', () => {
    expect(computeColumnsPerRow(1024, 16)).toBe(64);
  });

  it('should floor the result for non-exact division', () => {
    expect(computeColumnsPerRow(100, 16)).toBe(6);
  });

  it('should return 0 when texture is narrower than frame', () => {
    expect(computeColumnsPerRow(8, 16)).toBe(0);
  });
});

describe('animKey', () => {
  it('should format key as sheetKey_state_direction', () => {
    expect(animKey('char-scout', 'idle', 'down')).toBe(
      'char-scout_idle_down'
    );
  });

  it('should work with different states and directions', () => {
    expect(animKey('char-scout', 'walk', 'left')).toBe(
      'char-scout_walk_left'
    );
    expect(animKey('char-scout', 'sit', 'up')).toBe('char-scout_sit_up');
    expect(animKey('npc-baker', 'hit', 'right')).toBe('npc-baker_hit_right');
  });
});

describe('getAnimationDefs', () => {
  // COLS = floor(927 / 16) = 57
  let defs: AnimationDef[];

  beforeAll(() => {
    defs = getAnimationDefs('scout', 'char-scout');
  });

  it('should return exactly 31 animation definitions', () => {
    expect(defs).toHaveLength(31);
  });

  it('should have unique keys for all definitions', () => {
    const keys = defs.map((d) => d.key);
    expect(new Set(keys).size).toBe(31);
  });

  it('should use ANIMATION_FPS for all frameRate values', () => {
    for (const def of defs) {
      expect(def.frameRate).toBe(ANIMATION_FPS);
    }
  });

  // --- idle (row 1, 6 frames per direction, standard order) ---
  describe('idle animations', () => {
    // base = 1 * COLS = 57

    it('should have idle_right frames [57..62]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_idle_right'),
        'idle_right'
      );
      expect(def.frames).toEqual([57, 58, 59, 60, 61, 62]);
    });

    it('should have idle_up frames [63..68]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_idle_up'),
        'idle_up'
      );
      expect(def.frames).toEqual([63, 64, 65, 66, 67, 68]);
    });

    it('should have idle_left frames [69..74]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_idle_left'),
        'idle_left'
      );
      expect(def.frames).toEqual([69, 70, 71, 72, 73, 74]);
    });

    it('should have idle_down frames [75..80]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_idle_down'),
        'idle_down'
      );
      expect(def.frames).toEqual([75, 76, 77, 78, 79, 80]);
    });

    it('should loop idle animations (repeat = -1)', () => {
      const idleDefs = defs.filter((d) => d.key.includes('_idle_'));
      expect(idleDefs).toHaveLength(4);
      for (const def of idleDefs) {
        expect(def.repeat).toBe(-1);
      }
    });
  });

  // --- walk (row 2, 6 frames per direction, standard order) ---
  describe('walk animations', () => {
    // base = 2 * COLS = 114

    it('should have walk_right frames [114..119]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_walk_right'),
        'walk_right'
      );
      expect(def.frames).toEqual([114, 115, 116, 117, 118, 119]);
    });

    it('should have walk_up frames [120..125]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_walk_up'),
        'walk_up'
      );
      expect(def.frames).toEqual([120, 121, 122, 123, 124, 125]);
    });

    it('should have walk_left frames [126..131]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_walk_left'),
        'walk_left'
      );
      expect(def.frames).toEqual([126, 127, 128, 129, 130, 131]);
    });

    it('should have walk_down frames [132..137]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_walk_down'),
        'walk_down'
      );
      expect(def.frames).toEqual([132, 133, 134, 135, 136, 137]);
    });

    it('should loop walk animations (repeat = -1)', () => {
      const walkDefs = defs.filter((d) => d.key.includes('_walk_'));
      expect(walkDefs).toHaveLength(4);
      for (const def of walkDefs) {
        expect(def.repeat).toBe(-1);
      }
    });
  });

  // --- waiting (same frames as idle, repeat = -1) ---
  describe('waiting animations', () => {
    it('should have waiting_left with same frames as idle_left', () => {
      const waitDef = defined(
        defs.find((d) => d.key === 'char-scout_waiting_left'),
        'waiting_left'
      );
      const idleDef = defined(
        defs.find((d) => d.key === 'char-scout_idle_left'),
        'idle_left'
      );
      expect(waitDef.frames).toEqual(idleDef.frames);
    });

    it('should have waiting_down with same frames as idle_down', () => {
      const waitDef = defined(
        defs.find((d) => d.key === 'char-scout_waiting_down'),
        'waiting_down'
      );
      const idleDef = defined(
        defs.find((d) => d.key === 'char-scout_idle_down'),
        'idle_down'
      );
      expect(waitDef.frames).toEqual(idleDef.frames);
    });

    it('should loop waiting animations (repeat = -1)', () => {
      const waitDefs = defs.filter((d) => d.key.includes('_waiting_'));
      expect(waitDefs).toHaveLength(4);
      for (const def of waitDefs) {
        expect(def.repeat).toBe(-1);
      }
    });
  });

  // --- sit (row 4, 3 frames per direction, DIFFERENT direction order: DOWN, RIGHT, UP, LEFT) ---
  describe('sit animations', () => {
    // base = 4 * COLS = 228

    it('should have sit_down frames [228..230] (first in sit row)', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_sit_down'),
        'sit_down'
      );
      expect(def.frames).toEqual([228, 229, 230]);
    });

    it('should have sit_right frames [231..233]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_sit_right'),
        'sit_right'
      );
      expect(def.frames).toEqual([231, 232, 233]);
    });

    it('should have sit_up frames [234..236]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_sit_up'),
        'sit_up'
      );
      expect(def.frames).toEqual([234, 235, 236]);
    });

    it('should have sit_left frames [237..239] (last in sit row)', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_sit_left'),
        'sit_left'
      );
      expect(def.frames).toEqual([237, 238, 239]);
    });

    it('should play sit once (repeat = 0)', () => {
      const sitDefs = defs.filter((d) => d.key.includes('_sit_'));
      expect(sitDefs).toHaveLength(4);
      for (const def of sitDefs) {
        expect(def.repeat).toBe(0);
      }
    });
  });

  // --- hit (row 13, 6 frames per direction, standard order) ---
  describe('hit animations', () => {
    // base = 13 * COLS = 741

    it('should have hit_right frames [741..746]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_hit_right'),
        'hit_right'
      );
      expect(def.frames).toEqual([741, 742, 743, 744, 745, 746]);
    });

    it('should have hit_up frames [747..752]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_hit_up'),
        'hit_up'
      );
      expect(def.frames).toEqual([747, 748, 749, 750, 751, 752]);
    });

    it('should have hit_left frames [753..758]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_hit_left'),
        'hit_left'
      );
      expect(def.frames).toEqual([753, 754, 755, 756, 757, 758]);
    });

    it('should have hit_down frames [759..764]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_hit_down'),
        'hit_down'
      );
      expect(def.frames).toEqual([759, 760, 761, 762, 763, 764]);
    });

    it('should play hit once (repeat = 0)', () => {
      const hitDefs = defs.filter((d) => d.key.includes('_hit_'));
      expect(hitDefs).toHaveLength(4);
      for (const def of hitDefs) {
        expect(def.repeat).toBe(0);
      }
    });
  });

  // --- punch (row 14, 6 frames per direction, standard order) ---
  describe('punch animations', () => {
    // base = 14 * COLS = 798

    it('should have punch_right frames [798..803]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_punch_right'),
        'punch_right'
      );
      expect(def.frames).toEqual([798, 799, 800, 801, 802, 803]);
    });

    it('should have punch_up frames [804..809]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_punch_up'),
        'punch_up'
      );
      expect(def.frames).toEqual([804, 805, 806, 807, 808, 809]);
    });

    it('should have punch_left frames [810..815]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_punch_left'),
        'punch_left'
      );
      expect(def.frames).toEqual([810, 811, 812, 813, 814, 815]);
    });

    it('should have punch_down frames [816..821]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_punch_down'),
        'punch_down'
      );
      expect(def.frames).toEqual([816, 817, 818, 819, 820, 821]);
    });

    it('should play punch once (repeat = 0)', () => {
      const punchDefs = defs.filter((d) => d.key.includes('_punch_'));
      expect(punchDefs).toHaveLength(4);
      for (const def of punchDefs) {
        expect(def.repeat).toBe(0);
      }
    });
  });

  // --- hurt (row 19, 4 frames per direction, standard order, 3 directions only - no down) ---
  describe('hurt animations', () => {
    // base = 19 * COLS = 1083

    it('should have hurt_right frames [1083..1086]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_hurt_right'),
        'hurt_right'
      );
      expect(def.frames).toEqual([1083, 1084, 1085, 1086]);
    });

    it('should have hurt_up frames [1087..1090]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_hurt_up'),
        'hurt_up'
      );
      expect(def.frames).toEqual([1087, 1088, 1089, 1090]);
    });

    it('should have hurt_left frames [1091..1094]', () => {
      const def = defined(
        defs.find((d) => d.key === 'char-scout_hurt_left'),
        'hurt_left'
      );
      expect(def.frames).toEqual([1091, 1092, 1093, 1094]);
    });

    it('should NOT have hurt_down (only 3 directions)', () => {
      const def = defs.find((d) => d.key === 'char-scout_hurt_down');
      expect(def).toBeUndefined();
    });

    it('should play hurt once (repeat = 0)', () => {
      const hurtDefs = defs.filter((d) => d.key.includes('_hurt_'));
      expect(hurtDefs).toHaveLength(3);
      for (const def of hurtDefs) {
        expect(def.repeat).toBe(0);
      }
    });
  });

  // --- cross-cutting checks ---
  describe('cross-cutting checks', () => {
    it('should have no duplicate frame indices across non-waiting animations', () => {
      // waiting reuses idle frames by design, so exclude it from uniqueness check
      const nonWaitingDefs = defs.filter(
        (d) => !d.key.includes('_waiting_')
      );
      const allFrames = nonWaitingDefs.flatMap((d) => d.frames);
      expect(new Set(allFrames).size).toBe(allFrames.length);
    });

    it('should have waiting frames identical to idle frames', () => {
      for (const dir of ['left', 'up', 'right', 'down']) {
        const waitDef = defined(
          defs.find((d) => d.key === `char-scout_waiting_${dir}`),
          `waiting_${dir}`
        );
        const idleDef = defined(
          defs.find((d) => d.key === `char-scout_idle_${dir}`),
          `idle_${dir}`
        );
        expect(waitDef.frames).toEqual(idleDef.frames);
      }
    });

    it('should have all frames as non-negative integers', () => {
      for (const def of defs) {
        for (const frame of def.frames) {
          expect(Number.isInteger(frame)).toBe(true);
          expect(frame).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should count animations per state correctly', () => {
      const states = ['idle', 'walk', 'waiting', 'sit', 'hit', 'punch'];
      for (const state of states) {
        const stateDefs = defs.filter((d) =>
          d.key.match(new RegExp(`_${state}_`))
        );
        expect(stateDefs).toHaveLength(4);
      }
      // hurt has only 3
      const hurtDefs = defs.filter((d) => d.key.includes('_hurt_'));
      expect(hurtDefs).toHaveLength(3);
    });

    it('should have correct total: 6*4 + 1*3 = 27', () => {
      // 6 states with 4 directions + 1 state (hurt) with 3 directions
      expect(defs.length).toBe(6 * 4 + 1 * 3);
    });
  });
});
