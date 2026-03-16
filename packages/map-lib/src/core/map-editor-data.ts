import type { MaterialInfo, TilesetInfo } from '../types/material-types';

export interface MapEditorData {
  materials: MaterialInfo[];
  tilesets: TilesetInfo[];
}

/** Material shape expected by buildMapEditorData (keys only, no UUIDs). */
export interface RawMaterial {
  key: string;
  color: string;
  walkable: boolean;
  renderPriority: number;
  diggable?: boolean;
  fishable?: boolean;
  waterSource?: boolean;
  buildable?: boolean;
  surfaceType?: string | null;
}

/** Tileset shape expected by buildMapEditorData (material keys already resolved). */
export interface RawTileset {
  key: string;
  name: string;
  fromMaterialKey: string | null;
  toMaterialKey: string | null;
}

/**
 * Transform raw records into editor-ready structures.
 * - Assigns baseTilesetKey (first standalone tileset per material)
 *
 * Callers are responsible for resolving DB UUIDs to material keys
 * before passing data to this function.
 */
export function buildMapEditorData(
  rawMaterials: RawMaterial[],
  rawTilesets: RawTileset[],
): MapEditorData {
  // Two-pass baseTilesetKey: prefer standalone tilesets (fromMaterial only, no toMaterial)
  const baseTilesetMap = new Map<string, string>();
  const tilesetInfos: TilesetInfo[] = [];

  for (const ts of rawTilesets) {
    tilesetInfos.push({
      key: ts.key,
      name: ts.name,
      fromMaterialKey: ts.fromMaterialKey ?? undefined,
      toMaterialKey: ts.toMaterialKey ?? undefined,
    });

    // Pass 1: only accept standalone tilesets (fromMaterial set, toMaterial absent)
    if (ts.fromMaterialKey && !ts.toMaterialKey && !baseTilesetMap.has(ts.fromMaterialKey)) {
      baseTilesetMap.set(ts.fromMaterialKey, ts.key);
    }
  }

  // Pass 2: fallback for materials without a standalone tileset
  for (const ts of tilesetInfos) {
    if (ts.fromMaterialKey && !baseTilesetMap.has(ts.fromMaterialKey)) {
      baseTilesetMap.set(ts.fromMaterialKey, ts.key);
    }
  }

  const materials: MaterialInfo[] = rawMaterials.map((m) => ({
    key: m.key,
    color: m.color,
    walkable: m.walkable,
    renderPriority: m.renderPriority,
    baseTilesetKey: baseTilesetMap.get(m.key),
    diggable: m.diggable ?? false,
    fishable: m.fishable ?? false,
    waterSource: m.waterSource ?? false,
    buildable: m.buildable ?? false,
    surfaceType: m.surfaceType ?? null,
  }));

  return { materials, tilesets: tilesetInfos };
}
