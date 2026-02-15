import { getSkins, getDefaultSkin, SkinDefinition } from '../../src/game/characters/skin-registry';

describe('skin-registry', () => {
  describe('getSkins()', () => {
    it('should return an array with at least one entry', () => {
      const skins = getSkins();
      expect(skins.length).toBeGreaterThanOrEqual(1);
    });

    it('should return array containing the first Scout skin', () => {
      const skins = getSkins();
      const scout = skins.find((s: SkinDefinition) => s.key === 'scout_1');
      expect(scout).toBeDefined();
    });

    it('should have correct first Scout skin properties', () => {
      const skins = getSkins();
      const scout = skins.find((s: SkinDefinition) => s.key === 'scout_1');
      expect(scout).toEqual({
        key: 'scout_1',
        sheetPath: 'characters/scout_1.png',
        sheetKey: 'char-scout',
      });
    });

    it('should return a new array each time (defensive copy)', () => {
      const first = getSkins();
      const second = getSkins();
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });
  });

  describe('getDefaultSkin()', () => {
    it('should return the first Scout skin as the default', () => {
      const defaultSkin = getDefaultSkin();
      expect(defaultSkin.key).toBe('scout_1');
    });

    it('should return a SkinDefinition with all required fields', () => {
      const defaultSkin = getDefaultSkin();
      expect(defaultSkin).toHaveProperty('key');
      expect(defaultSkin).toHaveProperty('sheetPath');
      expect(defaultSkin).toHaveProperty('sheetKey');
    });

    it('should return the first entry in the registry', () => {
      const skins = getSkins();
      const defaultSkin = getDefaultSkin();
      expect(defaultSkin).toEqual(skins[0]);
    });
  });
});
