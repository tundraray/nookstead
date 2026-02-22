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

// Material types
export type { TilesetInfo, MaterialInfo } from './types/material-types';

// API response types
export type { MaterialProperties } from './types/api-types';

// Map editor data builder
export { buildMapEditorData } from './core/map-editor-data';
export type { MapEditorData, RawMaterial, RawTileset } from './core/map-editor-data';

// Editor types
export type {
  EditorTool,
  SidebarTab,
  BaseLayer,
  TileLayer,
  PlacedObject,
  ObjectLayer,
  EditorLayer,
  CellDelta,
  EditorCommand,
  MapEditorState,
  MapEditorAction,
  LoadMapPayload,
} from './types/editor-types';
export { SIDEBAR_TABS } from './types/editor-types';

// Core algorithm modules (Phase 2)
export { NEIGHBOR_OFFSETS, computeNeighborMask, computeNeighborMaskByMaterial, computeTransitionMask } from './core/neighbor-mask';
export type { NeighborMaskOptions } from './core/neighbor-mask';

export { recomputeAutotileLayers } from './core/autotile-layers';

export { recomputeWalkability } from './core/walkability';

export { bresenhamLine, floodFill, rectangleFill } from './core/drawing-algorithms';
export type { RectangleFillOptions } from './core/drawing-algorithms';

export { computeRectBounds, clampBounds, isSimplePolygon, polygonArea, toZoneVertices } from './core/zone-geometry';
export type { TileCoord } from './core/zone-geometry';

export { getZoneTiles, rasterizePolygon, detectZoneOverlap, validateAllZones } from './core/zone-validation';
export type { OverlapResult, ValidationError } from './core/zone-validation';

// Editor commands (Phase 3)
export { applyDeltas, PaintCommand, FillCommand } from './core/commands';

// Material resolver (Phase 4)
export { buildTransitionMap, resolvePaint } from './core/material-resolver';
export type {
  TransitionEntry,
  TransitionMap,
  TransitionWarning,
  PaintResult,
  ResolvePaintOptions,
} from './core/material-resolver';
