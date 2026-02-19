// Re-export shared types for convenience
export type {
  TerrainCellType, Cell, Grid, LayerData, GeneratedMap,
  GenerationPass, LayerPass, CellAction
} from '@nookstead/shared';

// Core autotile engine
export {
  N, NE, E, SE, S, SW, W, NW,
  FRAMES_PER_TERRAIN, SOLID_FRAME, ISOLATED_FRAME, EMPTY_FRAME,
  getFrame, gateDiagonals, VALID_BLOB47_MASKS
} from './core/autotile';

// Terrain definitions
export type { TerrainType, TilesetRelationship } from './core/terrain';
export {
  TERRAINS, TILESETS, TERRAIN_NAMES,
  getTerrainByKey, getInverseTileset, canLayerTogether, getTilesetsForTerrain
} from './core/terrain';

// Terrain properties
export type { SurfaceProperties } from './core/terrain-properties';
export { SURFACE_PROPERTIES, getSurfaceProperties, isWalkable } from './core/terrain-properties';

// Generation pipeline
export { MapGenerator, createMapGenerator } from './generation/map-generator';
export { IslandPass } from './generation/passes/island-pass';
export { ConnectivityPass } from './generation/passes/connectivity-pass';
export { WaterBorderPass } from './generation/passes/water-border-pass';
export { AutotilePass } from './generation/passes/autotile-pass';

// Map types, zone types, and template types
export type {
  MapType, MapDimensionConstraints,
  ZoneType, ZoneShape, ZoneBounds, ZoneVertex, ZoneData,
  DimensionValidationResult,
  TemplateParameter, TemplateConstraintType, TemplateConstraint, MapTemplate,
} from './types/index';
export {
  MAP_TYPE_CONSTRAINTS, ZONE_COLORS, ZONE_OVERLAP_ALLOWED,
  validateMapDimensions,
} from './types/index';
