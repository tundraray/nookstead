import type { MaterialProperties } from '@nookstead/map-lib';

export type { MaterialProperties };

const DEFAULT_PROPERTIES: MaterialProperties = {
  key: '',
  walkable: true,
  speedModifier: 1.0,
  swimRequired: false,
  damaging: false,
};

let cache: Map<string, MaterialProperties> | null = null;

/**
 * Populate the material cache from pre-fetched data.
 * Called by Preloader with data from GET /api/game-data.
 */
export function loadMaterialCacheFromData(
  materials: MaterialProperties[],
): void {
  cache = new Map(materials.map((m) => [m.key, m]));
  console.log(`[MaterialCache] Loaded ${cache.size} materials`);
}

export function getMaterialProperties(
  terrainKey: string
): MaterialProperties {
  return cache?.get(terrainKey) ?? DEFAULT_PROPERTIES;
}
