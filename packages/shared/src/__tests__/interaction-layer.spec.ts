import type {
  CellTrigger,
  WarpTrigger,
  SoundTrigger,
  SerializedInteractionLayer,
} from '../types/interaction-layer';
import {
  serializeInteractionLayer,
  deserializeInteractionLayer,
  isInteractionLayer,
} from '../types/interaction-layer';

// ============================================================
// CellTrigger discriminated union narrowing
// ============================================================

describe('CellTrigger discriminated union', () => {
  it('narrows to WarpTrigger when type is warp', () => {
    const trigger: CellTrigger = {
      type: 'warp',
      activation: 'touch',
      targetMap: 'town',
      targetX: 10,
      targetY: 20,
    };
    if (trigger.type === 'warp') {
      expect(trigger.targetMap).toBe('town');
      expect(trigger.targetX).toBe(10);
      expect(trigger.targetY).toBe(20);
    }
  });

  it('narrows to InteractTrigger when type is interact', () => {
    const trigger: CellTrigger = {
      type: 'interact',
      activation: 'click',
      interactionType: 'shop',
    };
    if (trigger.type === 'interact') {
      expect(trigger.interactionType).toBe('shop');
    }
  });

  it('narrows to EventTrigger when type is event', () => {
    const trigger: CellTrigger = {
      type: 'event',
      activation: 'touch',
      eventName: 'cutscene_intro',
      oneShot: true,
    };
    if (trigger.type === 'event') {
      expect(trigger.eventName).toBe('cutscene_intro');
      expect(trigger.oneShot).toBe(true);
    }
  });

  it('narrows to SoundTrigger when type is sound', () => {
    const trigger: CellTrigger = {
      type: 'sound',
      activation: 'proximity',
      soundKey: 'waterfall_ambient',
      volume: 0.7,
      loop: true,
    };
    if (trigger.type === 'sound') {
      expect(trigger.soundKey).toBe('waterfall_ambient');
      expect(trigger.volume).toBe(0.7);
      expect(trigger.loop).toBe(true);
    }
  });

  it('narrows to DamageTrigger when type is damage', () => {
    const trigger: CellTrigger = {
      type: 'damage',
      activation: 'touch',
      amount: 5,
      interval: 1000,
      damageType: 'fire',
    };
    if (trigger.type === 'damage') {
      expect(trigger.amount).toBe(5);
      expect(trigger.interval).toBe(1000);
      expect(trigger.damageType).toBe('fire');
    }
  });

  it('covers all trigger types in exhaustive switch', () => {
    function getTriggerLabel(trigger: CellTrigger): string {
      switch (trigger.type) {
        case 'warp':
          return 'warp';
        case 'interact':
          return 'interact';
        case 'event':
          return 'event';
        case 'sound':
          return 'sound';
        case 'damage':
          return 'damage';
      }
    }

    const triggers: CellTrigger[] = [
      { type: 'warp', activation: 'touch', targetMap: 'm', targetX: 0, targetY: 0 },
      { type: 'interact', activation: 'click', interactionType: 'shop' },
      { type: 'event', activation: 'touch', eventName: 'e' },
      { type: 'sound', activation: 'proximity', soundKey: 's' },
      { type: 'damage', activation: 'touch', amount: 1, interval: 1000 },
    ];

    const labels = triggers.map(getTriggerLabel);
    expect(labels).toEqual(['warp', 'interact', 'event', 'sound', 'damage']);
  });
});

// ============================================================
// Serialization roundtrip
// ============================================================

describe('serializeInteractionLayer', () => {
  it('serializes an empty triggers map to an empty array', () => {
    const triggers = new Map<string, CellTrigger[]>();
    const result = serializeInteractionLayer('Test', triggers);

    expect(result).toEqual({
      type: 'interaction',
      name: 'Test',
      triggers: [],
    });
  });

  it('skips map entries with empty trigger arrays', () => {
    const triggers = new Map<string, CellTrigger[]>();
    triggers.set('3,4', []);
    const result = serializeInteractionLayer('Test', triggers);

    expect(result.triggers).toHaveLength(0);
  });

  it('serializes a single warp trigger at one position', () => {
    const warp: WarpTrigger = {
      type: 'warp',
      activation: 'touch',
      targetMap: 'town',
      targetX: 5,
      targetY: 10,
    };
    const triggers = new Map<string, CellTrigger[]>();
    triggers.set('2,3', [warp]);

    const result = serializeInteractionLayer('Warps', triggers);

    expect(result.triggers).toHaveLength(1);
    expect(result.triggers[0]).toEqual({ x: 2, y: 3, triggers: [warp] });
  });

  it('serializes multiple trigger types at the same position', () => {
    const warp: WarpTrigger = {
      type: 'warp',
      activation: 'touch',
      targetMap: 'town',
      targetX: 0,
      targetY: 0,
    };
    const sound: SoundTrigger = {
      type: 'sound',
      activation: 'proximity',
      soundKey: 'portal_hum',
    };
    const triggers = new Map<string, CellTrigger[]>();
    triggers.set('5,5', [warp, sound]);

    const result = serializeInteractionLayer('Mixed', triggers);

    expect(result.triggers).toHaveLength(1);
    expect(result.triggers[0].triggers).toHaveLength(2);
    expect(result.triggers[0].triggers[0].type).toBe('warp');
    expect(result.triggers[0].triggers[1].type).toBe('sound');
  });

  it('serializes triggers across multiple positions', () => {
    const triggers = new Map<string, CellTrigger[]>();
    triggers.set('0,0', [
      { type: 'damage', activation: 'touch', amount: 1, interval: 500 },
    ]);
    triggers.set('10,20', [
      { type: 'event', activation: 'touch', eventName: 'boss_spawn' },
    ]);

    const result = serializeInteractionLayer('Multi', triggers);

    expect(result.triggers).toHaveLength(2);
    const positions = result.triggers.map((e) => `${e.x},${e.y}`);
    expect(positions).toContain('0,0');
    expect(positions).toContain('10,20');
  });
});

describe('deserializeInteractionLayer', () => {
  it('deserializes an empty layer to an empty map', () => {
    const layer: SerializedInteractionLayer = {
      type: 'interaction',
      name: 'Empty',
      triggers: [],
    };

    const result = deserializeInteractionLayer(layer);

    expect(result.size).toBe(0);
  });

  it('deserializes trigger entries back to a Map', () => {
    const layer: SerializedInteractionLayer = {
      type: 'interaction',
      name: 'Test',
      triggers: [
        {
          x: 3,
          y: 4,
          triggers: [
            { type: 'warp', activation: 'touch', targetMap: 'town', targetX: 0, targetY: 0 },
          ],
        },
      ],
    };

    const result = deserializeInteractionLayer(layer);

    expect(result.size).toBe(1);
    expect(result.has('3,4')).toBe(true);
    const entry = result.get('3,4');
    expect(entry).toBeDefined();
    expect(entry?.[0].type).toBe('warp');
  });

  it('skips entries with invalid trigger types and logs a warning', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const layer: SerializedInteractionLayer = {
      type: 'interaction',
      name: 'BadData',
      triggers: [
        {
          x: 0,
          y: 0,
          triggers: [
            { type: 'warp', activation: 'touch', targetMap: 't', targetX: 0, targetY: 0 },
            { type: 'unknown_type' as CellTrigger['type'], activation: 'touch' } as CellTrigger,
          ],
        },
      ],
    };

    const result = deserializeInteractionLayer(layer);

    expect(result.size).toBe(1);
    expect(result.get('0,0')).toHaveLength(1);
    expect(result.get('0,0')?.[0].type).toBe('warp');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown trigger type'),
    );

    consoleSpy.mockRestore();
  });

  it('skips entries where all triggers are invalid', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const layer: SerializedInteractionLayer = {
      type: 'interaction',
      name: 'AllBad',
      triggers: [
        {
          x: 1,
          y: 1,
          triggers: [
            { type: 'bogus' as CellTrigger['type'] } as CellTrigger,
          ],
        },
      ],
    };

    const result = deserializeInteractionLayer(layer);

    expect(result.size).toBe(0);

    consoleSpy.mockRestore();
  });
});

describe('serialization roundtrip', () => {
  it('roundtrips all 5 trigger types losslessly', () => {
    const triggers = new Map<string, CellTrigger[]>();
    triggers.set('0,0', [
      { type: 'warp', activation: 'touch', targetMap: 'dungeon', targetX: 1, targetY: 2, transition: 'fade' },
    ]);
    triggers.set('1,1', [
      { type: 'interact', activation: 'click', interactionType: 'shop' },
    ]);
    triggers.set('2,2', [
      { type: 'event', activation: 'touch', eventName: 'quest_start', oneShot: true },
    ]);
    triggers.set('3,3', [
      { type: 'sound', activation: 'proximity', soundKey: 'birds', volume: 0.5, loop: true },
    ]);
    triggers.set('4,4', [
      { type: 'damage', activation: 'touch', amount: 10, interval: 2000, damageType: 'poison' },
    ]);

    const serialized = serializeInteractionLayer('Roundtrip', triggers);
    const deserialized = deserializeInteractionLayer(serialized);

    expect(deserialized.size).toBe(5);
    for (const [key, value] of triggers) {
      expect(deserialized.get(key)).toEqual(value);
    }
  });

  it('roundtrips multi-trigger tiles', () => {
    const triggers = new Map<string, CellTrigger[]>();
    triggers.set('5,5', [
      { type: 'warp', activation: 'touch', targetMap: 'town', targetX: 0, targetY: 0 },
      { type: 'sound', activation: 'proximity', soundKey: 'portal' },
      { type: 'event', activation: 'touch', eventName: 'portal_enter' },
    ]);

    const serialized = serializeInteractionLayer('MultiTrigger', triggers);
    const deserialized = deserializeInteractionLayer(serialized);

    expect(deserialized.get('5,5')).toHaveLength(3);
    expect(deserialized.get('5,5')).toEqual(triggers.get('5,5'));
  });

  it('handles a large layer (100 triggers) in under 50ms', () => {
    const triggers = new Map<string, CellTrigger[]>();
    for (let i = 0; i < 100; i++) {
      triggers.set(`${i},${i}`, [
        { type: 'warp', activation: 'touch', targetMap: `map_${i}`, targetX: i, targetY: i },
      ]);
    }

    const start = performance.now();
    const serialized = serializeInteractionLayer('Perf', triggers);
    const deserialized = deserializeInteractionLayer(serialized);
    const elapsed = performance.now() - start;

    expect(deserialized.size).toBe(100);
    expect(elapsed).toBeLessThan(50);
  });
});

// ============================================================
// isInteractionLayer type guard
// ============================================================

describe('isInteractionLayer', () => {
  it('returns true for a valid SerializedInteractionLayer', () => {
    const layer: SerializedInteractionLayer = {
      type: 'interaction',
      name: 'Test',
      triggers: [],
    };
    expect(isInteractionLayer(layer)).toBe(true);
  });

  it('returns false for a tile layer', () => {
    expect(isInteractionLayer({ type: 'tile', name: 'Ground', frames: [] })).toBe(false);
  });

  it('returns false for an object layer', () => {
    expect(isInteractionLayer({ type: 'object', name: 'Objects', objects: [] })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isInteractionLayer(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isInteractionLayer(undefined)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isInteractionLayer('interaction')).toBe(false);
  });

  it('returns false for an object without type field', () => {
    expect(isInteractionLayer({ name: 'No Type' })).toBe(false);
  });
});
