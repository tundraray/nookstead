// Re-export shared types for convenience
export type {
  TerrainCellType, Cell, Grid, LayerData, GeneratedMap,
  CellAction
} from '@nookstead/shared';

// Core autotile engine
export {
  N, NE, E, SE, S, SW, W, NW,
  FRAMES_PER_TERRAIN, SOLID_FRAME, ISOLATED_FRAME, EMPTY_FRAME,
  getFrame, gateDiagonals, VALID_BLOB47_MASKS
} from './core/autotile';

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
