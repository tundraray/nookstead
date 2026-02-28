import {
  getSkins,
  getActiveSkin,
  getSkinByKey,
  SkinDefinition,
} from '../../src/game/characters/skin-registry';

describe('skin-registry', () => {
  describe('getSkins()', () => {
    it('should return an array with at least one entry', () => {
      const skins = getSkins();
      expect(skins.length).toBeGreaterThanOrEqual(1);
    });

    it('should return all 6 scout skins', () => {
      const skins = getSkins();
      expect(skins).toHaveLength(6);
    });

    it('should return array containing the first Scout skin', () => {
      const skins = getSkins();
      const scout = skins.find((s: SkinDefinition) => s.key === 'scout_1');
      expect(scout).toBeDefined();
    });

    it('should have correct first Scout skin properties with unique sheetKey', () => {
      const skins = getSkins();
      const scout = skins.find((s: SkinDefinition) => s.key === 'scout_1');
      expect(scout).toEqual({
        key: 'scout_1',
        sheetPath: 'characters/scout_1.png',
        sheetKey: 'scout_1',
        type: 'preset',
        textureWidth: 927,
      });
    });

    it('should have unique sheetKey for every skin entry', () => {
      const skins = getSkins();
      const sheetKeys = skins.map((s: SkinDefinition) => s.sheetKey);
      const uniqueKeys = new Set(sheetKeys);
      expect(uniqueKeys.size).toBe(skins.length);
    });

    it('should have sheetKey matching key for every skin entry', () => {
      const skins = getSkins();
      for (const skin of skins) {
        expect(skin.sheetKey).toBe(skin.key);
      }
    });

    it('should return a new array each time (defensive copy)', () => {
      const first = getSkins();
      const second = getSkins();
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });
  });

  describe('getActiveSkin()', () => {
    it('should return the first Scout skin as the default when no custom skin is set', () => {
      const activeSkin = getActiveSkin();
      expect(activeSkin.key).toBe('scout_1');
    });

    it('should return a SkinDefinition with all required fields', () => {
      const activeSkin = getActiveSkin();
      expect(activeSkin).toHaveProperty('key');
      expect(activeSkin).toHaveProperty('sheetPath');
      expect(activeSkin).toHaveProperty('sheetKey');
      expect(activeSkin).toHaveProperty('type');
      expect(activeSkin).toHaveProperty('textureWidth');
    });

    it('should return the first entry in the registry when no custom skin', () => {
      const skins = getSkins();
      const activeSkin = getActiveSkin();
      expect(activeSkin).toEqual(skins[0]);
    });

    it('should have sheetKey matching its key', () => {
      const activeSkin = getActiveSkin();
      expect(activeSkin.sheetKey).toBe(activeSkin.key);
    });
  });

  describe('getSkinByKey()', () => {
    it('should return the correct skin definition for a valid key', () => {
      const skin = getSkinByKey('scout_3');
      expect(skin).toBeDefined();
      expect(skin!.key).toBe('scout_3');
      expect(skin!.sheetKey).toBe('scout_3');
      expect(skin!.sheetPath).toBe('characters/scout_3.png');
    });

    it('should return undefined for an invalid key', () => {
      const skin = getSkinByKey('invalid');
      expect(skin).toBeUndefined();
    });

    it('should return undefined for an empty string key', () => {
      const skin = getSkinByKey('');
      expect(skin).toBeUndefined();
    });

    it('should find each of the 6 scout skins by key', () => {
      for (let i = 1; i <= 6; i++) {
        const key = `scout_${i}`;
        const skin = getSkinByKey(key);
        expect(skin).toBeDefined();
        expect(skin!.key).toBe(key);
        expect(skin!.sheetKey).toBe(key);
      }
    });
  });
});
