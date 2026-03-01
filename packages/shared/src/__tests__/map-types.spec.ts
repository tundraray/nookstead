// Game Object Client Rendering - Shared Types Integration Test
// Design Doc: design-011-game-object-client-rendering.md
// Generated: 2026-03-01 | Budget Used: 1/3 integration
//
// NOTE: The shared package does not currently have a jest.config.
// A jest config must be added to packages/shared/ before running these tests.
// Alternatively, these tests can be moved to packages/map-lib/ which already
// has jest configured and imports from @nookstead/shared.

import {
  isTileLayer,
  isObjectLayer,
} from '../index';
import type {
  SerializedLayer,
  SerializedTileLayer,
  SerializedObjectLayer,
} from '../index';

describe('SerializedLayer type guards', () => {
  // AC-1.1: "SerializedLayer shall use a discriminated union with type: 'tile' | 'object' field"
  // AC-1.3: "If a SerializedLayer has no type field (legacy data), then the client shall treat it as type: 'tile'"
  // ROI: 81 | Business Value: 8 (contract correctness) | Frequency: 10 (every player load)
  // Behavior: Layer data arrives from server -> type guards classify correctly -> correct rendering pipeline selected
  // @category: core-functionality
  // @dependency: @nookstead/shared (pure type definitions and helper functions)
  // @complexity: low

  describe('isTileLayer()', () => {
    it('should identify a tile layer with explicit type: "tile"', () => {
      const layer: SerializedTileLayer = {
        type: 'tile',
        name: 'test',
        terrainKey: 'grass',
        frames: [],
      };

      const result = isTileLayer(layer);

      expect(result).toBe(true);
    });

    it('should treat a layer without type field as a tile layer (backward compatibility)', () => {
      const layer = {
        name: 'test',
        terrainKey: 'grass',
        frames: [],
      };

      const result = isTileLayer(layer as SerializedLayer);

      expect(result).toBe(true);
    });

    it('should reject an object layer', () => {
      const layer: SerializedObjectLayer = {
        type: 'object',
        name: 'test',
        objects: [],
      };

      const result = isTileLayer(layer);

      expect(result).toBe(false);
    });
  });

  describe('isObjectLayer()', () => {
    it('should identify an object layer with type: "object"', () => {
      const layer: SerializedObjectLayer = {
        type: 'object',
        name: 'test',
        objects: [],
      };

      const result = isObjectLayer(layer);

      expect(result).toBe(true);
    });

    it('should reject a tile layer', () => {
      const layer: SerializedTileLayer = {
        type: 'tile',
        name: 'test',
        terrainKey: 'grass',
        frames: [],
      };

      const result = isObjectLayer(layer);

      expect(result).toBe(false);
    });

    it('should reject a legacy layer without type field', () => {
      const layer = {
        name: 'test',
        terrainKey: 'grass',
        frames: [],
      };

      const result = isObjectLayer(layer as SerializedLayer);

      expect(result).toBe(false);
    });
  });
});
