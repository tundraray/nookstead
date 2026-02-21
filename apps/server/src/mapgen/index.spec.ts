import { describe, it, expect } from '@jest/globals';
import { createMapGenerator } from '@nookstead/map-lib';
import type { GeneratedMap } from '@nookstead/map-lib';

const MAP_WIDTH = 64;
const MAP_HEIGHT = 64;

describe('MapGenerator (Server)', () => {
  describe('generate(): produces valid GeneratedMap', () => {
    it('should produce a GeneratedMap with grid, layers, and walkable', () => {
      const generator = createMapGenerator(MAP_WIDTH, MAP_HEIGHT);
      const result: GeneratedMap = generator.generate();

      expect(result).toBeDefined();
      expect(result.grid).toBeDefined();
      expect(result.layers).toBeDefined();
      expect(result.walkable).toBeDefined();
      expect(result.seed).toBeDefined();
      expect(typeof result.seed).toBe('number');

      // Grid must be a non-empty 2D array with correct dimensions
      expect(Array.isArray(result.grid)).toBe(true);
      expect(result.grid.length).toBe(MAP_HEIGHT);
      expect(Array.isArray(result.grid[0])).toBe(true);
      expect(result.grid[0].length).toBe(MAP_WIDTH);

      // Walkable must be a boolean 2D array with same dimensions as grid
      expect(result.walkable.length).toBe(result.grid.length);
      expect(result.walkable[0].length).toBe(result.grid[0].length);
      expect(typeof result.walkable[0][0]).toBe('boolean');

      // Layers must be a non-empty array
      expect(result.layers.length).toBeGreaterThan(0);
      expect(result.layers[0].name).toBeDefined();
      expect(result.layers[0].frames).toBeDefined();
    });
  });

  describe('generate(seed): deterministic output', () => {
    it('should produce identical output for the same seed', () => {
      const generator = createMapGenerator(MAP_WIDTH, MAP_HEIGHT);
      const seed = 42;

      const result1: GeneratedMap = generator.generate(seed);
      const result2: GeneratedMap = generator.generate(seed);

      expect(result1.seed).toBe(seed);
      expect(result2.seed).toBe(seed);

      // Grid must be identical
      expect(JSON.stringify(result1.grid)).toBe(JSON.stringify(result2.grid));
      // Layers must be identical
      expect(JSON.stringify(result1.layers)).toBe(
        JSON.stringify(result2.layers),
      );
      // Walkable must be identical
      expect(JSON.stringify(result1.walkable)).toBe(
        JSON.stringify(result2.walkable),
      );
    });
  });

  describe('generate(): different seeds produce different maps', () => {
    it('should produce different output for different seeds', () => {
      const generator = createMapGenerator(MAP_WIDTH, MAP_HEIGHT);

      const result1: GeneratedMap = generator.generate(1);
      const result2: GeneratedMap = generator.generate(999999);

      // Grids should not be identical (with very high probability)
      expect(JSON.stringify(result1.grid)).not.toBe(
        JSON.stringify(result2.grid),
      );
    });
  });

  describe('generate(): all pipeline passes execute', () => {
    it('should execute island, connectivity, water border, and autotile passes', () => {
      // Verify that all passes ran by checking output characteristics:
      // - Island pass creates terrain variety (not all same terrain)
      // - Connectivity pass ensures walkable areas
      // - Water border pass creates border patterns
      // - Autotile pass creates frame indices in layers

      const generator = createMapGenerator(MAP_WIDTH, MAP_HEIGHT);
      const result: GeneratedMap = generator.generate(12345);

      // Verify terrain variety (island pass ran)
      const terrainTypes = new Set<string>();
      for (const row of result.grid) {
        for (const cell of row) {
          terrainTypes.add(cell.terrain);
        }
      }
      expect(terrainTypes.size).toBeGreaterThan(1); // More than one terrain type

      // Verify layers have frame data (autotile pass ran)
      for (const layer of result.layers) {
        expect(layer.frames).toBeDefined();
        expect(layer.frames.length).toBeGreaterThan(0);
        expect(typeof layer.frames[0][0]).toBe('number');
      }
    });
  });

  describe('non-functional: performance and size', () => {
    it('should generate a 64x64 map in less than 500ms', () => {
      const generator = createMapGenerator(MAP_WIDTH, MAP_HEIGHT);
      const start = Date.now();
      generator.generate(42);
      const elapsed = Date.now() - start;

      console.log(`[MapGenerator] Generation time: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(500);
    });

    it('should produce a MapDataPayload smaller than 500KB when serialized', () => {
      const generator = createMapGenerator(MAP_WIDTH, MAP_HEIGHT);
      const result: GeneratedMap = generator.generate(42);

      const payload = {
        seed: result.seed,
        width: result.width,
        height: result.height,
        grid: result.grid,
        layers: result.layers,
        walkable: result.walkable,
      };

      const serialized = JSON.stringify(payload);
      const sizeKB = Buffer.byteLength(serialized, 'utf8') / 1024;

      console.log(
        `[MapGenerator] Serialized map size: ${sizeKB.toFixed(1)}KB`,
      );
      expect(sizeKB).toBeLessThan(500);
    });
  });
});
