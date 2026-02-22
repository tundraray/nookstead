import { buildMapEditorData } from './map-editor-data';
import type { RawTileset } from './map-editor-data';

describe('buildMapEditorData - baseTilesetKey selection', () => {
  it('should prefer standalone tileset for baseTilesetKey', () => {
    const materials = [
      { key: 'grass', color: '#0f0', walkable: true, renderPriority: 1 },
      { key: 'water', color: '#00f', walkable: false, renderPriority: 2 },
    ];
    const tilesets = [
      // Transition tileset listed first -- should NOT win
      {
        key: 'grass-to-water',
        name: 'Grass to Water',
        fromMaterialKey: 'grass',
        toMaterialKey: 'water',
      },
      // Standalone tileset listed second -- SHOULD win
      {
        key: 'grass-standalone',
        name: 'Grass Standalone',
        fromMaterialKey: 'grass',
        toMaterialKey: null,
      },
    ];

    const result = buildMapEditorData(materials, tilesets);

    const grass = result.materials.find((m) => m.key === 'grass')!;
    expect(grass.baseTilesetKey).toBe('grass-standalone');
  });

  it('should fall back to transition tileset when no standalone exists', () => {
    const materials = [
      { key: 'grass', color: '#0f0', walkable: true, renderPriority: 1 },
      { key: 'water', color: '#00f', walkable: false, renderPriority: 2 },
    ];
    const tilesets = [
      {
        key: 'grass-to-water',
        name: 'Grass to Water',
        fromMaterialKey: 'grass',
        toMaterialKey: 'water',
      },
    ];

    const result = buildMapEditorData(materials, tilesets);

    const grass = result.materials.find((m) => m.key === 'grass')!;
    expect(grass.baseTilesetKey).toBe('grass-to-water');
  });

  it('should set baseTilesetKey to undefined when no tileset references the material', () => {
    const materials = [
      { key: 'grass', color: '#0f0', walkable: true, renderPriority: 1 },
    ];
    const tilesets: RawTileset[] = [];

    const result = buildMapEditorData(materials, tilesets);

    expect(result.materials[0].baseTilesetKey).toBeUndefined();
  });
});
