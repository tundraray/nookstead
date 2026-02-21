export interface MaterialProperties {
  walkable: boolean;
  speedModifier: number;
  swimRequired: boolean;
  damaging: boolean;
}

const DEFAULT_PROPERTIES: MaterialProperties = {
  walkable: true,
  speedModifier: 1.0,
  swimRequired: false,
  damaging: false,
};

let cache: Map<string, MaterialProperties> | null = null;

export async function loadMaterialCache(): Promise<void> {
  const res = await fetch('/api/materials');
  if (!res.ok) {
    console.error(
      '[MaterialCache] Failed to load materials:',
      res.status,
      res.statusText
    );
    return;
  }

  const materials: Array<{
    key: string;
    walkable: boolean;
    speedModifier: number;
    swimRequired: boolean;
    damaging: boolean;
  }> = await res.json();

  cache = new Map(
    materials.map((m) => [
      m.key,
      {
        walkable: m.walkable,
        speedModifier: m.speedModifier,
        swimRequired: m.swimRequired,
        damaging: m.damaging,
      },
    ])
  );

  console.log(`[MaterialCache] Loaded ${cache.size} materials`);
}

export function getMaterialProperties(
  terrainKey: string
): MaterialProperties {
  return cache?.get(terrainKey) ?? DEFAULT_PROPERTIES;
}

export function isMaterialWalkable(terrainKey: string): boolean {
  return getMaterialProperties(terrainKey).walkable;
}
