import type { TilesetInfo } from '../types/material-types';
import { TilesetRegistry } from './tileset-registry';
import { buildGraphs } from './graph-builder';
import { computeRoutingTable } from './router';
import { classifyEdge } from './edge-classifier';

function t(key: string, from: string, to?: string): TilesetInfo {
  const name = to ? `${from}_${to}` : from;
  return to ? { key, name, fromMaterialKey: from, toMaterialKey: to } : { key, name, fromMaterialKey: from };
}

describe('classifyEdge', () => {
  it('returns C1 for same material', () => {
    const registry = new TilesetRegistry([t('grass_base', 'grass')]);
    const { compatGraph } = buildGraphs(registry);
    const router = computeRoutingTable(compatGraph);

    expect(classifyEdge('grass', 'grass', router, registry)).toBe('C1');
  });

  it('returns C2 for symmetric direct pair (grass <-> water)', () => {
    const registry = new TilesetRegistry([
      t('grass_base', 'grass'),
      t('water_base', 'water'),
      t('grass_water', 'grass', 'water'),
      t('water_grass', 'water', 'grass'),
    ]);
    const { compatGraph } = buildGraphs(registry);
    const router = computeRoutingTable(compatGraph, ['water', 'grass']);

    expect(classifyEdge('grass', 'water', router, registry)).toBe('C2');
    expect(classifyEdge('water', 'grass', router, registry)).toBe('C2');
  });

  it('returns C3 for stable bridge (deep_sand <-> deep_water via water)', () => {
    const registry = new TilesetRegistry([
      t('deep_sand_base', 'deep_sand'),
      t('deep_water_base', 'deep_water'),
      t('water_base', 'water'),
      t('deep_sand_water', 'deep_sand', 'water'),
      t('deep_water_water', 'deep_water', 'water'),
    ]);
    const { compatGraph } = buildGraphs(registry);
    const router = computeRoutingTable(compatGraph, ['water', 'deep_sand', 'deep_water']);

    expect(classifyEdge('deep_sand', 'deep_water', router, registry)).toBe('C3');
    expect(classifyEdge('deep_water', 'deep_sand', router, registry)).toBe('C3');
  });

  it('returns C4 for reverse-based mixed valid pair (deep_water <-> water)', () => {
    const registry = new TilesetRegistry([
      t('deep_water_base', 'deep_water'),
      t('water_base', 'water'),
      t('deep_water_water', 'deep_water', 'water'),
    ]);
    const { compatGraph } = buildGraphs(registry);
    const router = computeRoutingTable(compatGraph, ['water', 'deep_water']);

    expect(classifyEdge('deep_water', 'water', router, registry)).toBe('C4');
    expect(classifyEdge('water', 'deep_water', router, registry)).toBe('C4');
  });

  it('returns C4 for both-direct but different bridges', () => {
    const registry = new TilesetRegistry([
      t('a_x', 'a', 'x'),
      t('x_z', 'x', 'z'),
      t('y_z', 'y', 'z'),
      t('b_y', 'b', 'y'),
    ]);
    const { compatGraph } = buildGraphs(registry);
    const router = computeRoutingTable(compatGraph, ['x', 'y', 'z', 'a', 'b']);

    expect(classifyEdge('a', 'b', router, registry)).toBe('C4');
    expect(classifyEdge('b', 'a', router, registry)).toBe('C4');
  });

  it('returns C5 when at least one side is unresolved', () => {
    const registry = new TilesetRegistry([
      t('grass_base', 'grass'),
      t('water_base', 'water'),
      t('grass_water', 'grass', 'water'),
    ]);
    const { compatGraph } = buildGraphs(registry);
    const router = computeRoutingTable(compatGraph);

    expect(classifyEdge('grass', 'lava', router, registry)).toBe('C5');
    expect(classifyEdge('lava', 'grass', router, registry)).toBe('C5');
  });
});
