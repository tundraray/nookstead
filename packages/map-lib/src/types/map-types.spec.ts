import type { ZoneData, ZoneType } from './map-types';
import { ZONE_COLORS, ZONE_OVERLAP_ALLOWED, isWarpZone } from './map-types';

describe('ZoneType completeness', () => {
  const ALL_ZONE_TYPES: ZoneType[] = [
    'crop_field',
    'path',
    'water_feature',
    'decoration',
    'spawn_point',
    'transition',
    'npc_location',
    'animal_pen',
    'building_footprint',
    'transport_point',
    'lighting',
    'warp_zone',
    'no_dig',
    'no_build',
    'no_fish',
    'no_spawn',
    'farmland',
  ];

  it('ZONE_COLORS has an entry for every ZoneType', () => {
    for (const zt of ALL_ZONE_TYPES) {
      expect(ZONE_COLORS).toHaveProperty(zt);
      expect(typeof ZONE_COLORS[zt]).toBe('string');
    }
  });

  it('ZONE_COLORS has exactly 17 entries', () => {
    expect(Object.keys(ZONE_COLORS)).toHaveLength(17);
  });

  it('all ZONE_COLORS values are valid hex color strings', () => {
    for (const color of Object.values(ZONE_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('ZONE_OVERLAP_ALLOWED', () => {
  it('includes farmland + crop_field overlap', () => {
    const found = ZONE_OVERLAP_ALLOWED.some(
      ([a, b]) =>
        (a === 'farmland' && b === 'crop_field') ||
        (a === 'crop_field' && b === 'farmland'),
    );
    expect(found).toBe(true);
  });

  it('includes warp_zone + transition overlap', () => {
    const found = ZONE_OVERLAP_ALLOWED.some(
      ([a, b]) =>
        (a === 'warp_zone' && b === 'transition') ||
        (a === 'transition' && b === 'warp_zone'),
    );
    expect(found).toBe(true);
  });

  it('includes no_dig + no_build stacking', () => {
    const found = ZONE_OVERLAP_ALLOWED.some(
      ([a, b]) =>
        (a === 'no_dig' && b === 'no_build') ||
        (a === 'no_build' && b === 'no_dig'),
    );
    expect(found).toBe(true);
  });

  it('all pairs reference valid ZoneType values', () => {
    const validTypes = new Set(Object.keys(ZONE_COLORS));
    for (const [a, b] of ZONE_OVERLAP_ALLOWED) {
      expect(validTypes.has(a)).toBe(true);
      expect(validTypes.has(b)).toBe(true);
    }
  });
});

describe('isWarpZone', () => {
  it('returns true for a zone with zoneType warp_zone', () => {
    const zone: ZoneData = {
      id: 'z1',
      name: 'Town Entrance',
      zoneType: 'warp_zone',
      shape: 'rectangle',
      bounds: { x: 0, y: 0, width: 2, height: 2 },
      properties: { targetMap: 'town', targetX: 10, targetY: 20 },
      zIndex: 0,
    };
    expect(isWarpZone(zone)).toBe(true);
  });

  it('returns false for a non-warp zone', () => {
    const zone: ZoneData = {
      id: 'z2',
      name: 'Farm Plot',
      zoneType: 'crop_field',
      shape: 'rectangle',
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      properties: {},
      zIndex: 0,
    };
    expect(isWarpZone(zone)).toBe(false);
  });

  it('narrows type to include WarpZoneProperties', () => {
    const zone: ZoneData = {
      id: 'z1',
      name: 'Portal',
      zoneType: 'warp_zone',
      shape: 'rectangle',
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      properties: { targetMap: 'dungeon', targetX: 5, targetY: 5, transition: 'fade' },
      zIndex: 0,
    };
    if (isWarpZone(zone)) {
      expect(zone.properties.targetMap).toBe('dungeon');
      expect(zone.properties.targetX).toBe(5);
    } else {
      fail('Expected isWarpZone to return true');
    }
  });
});
