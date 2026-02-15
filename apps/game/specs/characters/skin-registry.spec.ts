import { getSkins, getDefaultSkin, SkinDefinition } from '../../src/game/characters/skin-registry';

describe('skin-registry', () => {
  describe('getSkins()', () => {
    it('should return an array with at least one entry', () => {
      const skins = getSkins();
      expect(skins.length).toBeGreaterThanOrEqual(1);
    });

    it('should return array containing the Scout skin', () => {
      const skins = getSkins();
      const scout = skins.find((s: SkinDefinition) => s.key === 'scout');
      expect(scout).toBeDefined();
    });

    it('should have correct Scout skin properties', () => {
      const skins = getSkins();
      const scout = skins.find((s: SkinDefinition) => s.key === 'scout');
      expect(scout).toEqual({
        key: 'scout',
        sheetPath: 'characters/Modern_Exteriors_Characters_Scout_16x16_6.png',
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
    it('should return the Scout skin as the default', () => {
      const defaultSkin = getDefaultSkin();
      expect(defaultSkin.key).toBe('scout');
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
