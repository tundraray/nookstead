// Re-export from shared package -- implementation moved to @nookstead/map-lib
export {
  TERRAINS, TILESETS, TERRAIN_NAMES,
  getTerrainByKey, getInverseTileset, canLayerTogether, getTilesetsForTerrain
} from '@nookstead/map-lib';
export type { TerrainType, TilesetRelationship } from '@nookstead/map-lib';
