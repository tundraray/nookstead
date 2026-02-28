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
  BrushShape,
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
export { NEIGHBOR_OFFSETS, computeNeighborMask, computeNeighborMaskByMaterial } from './core/neighbor-mask';
export type { NeighborMaskOptions } from './core/neighbor-mask';

export { recomputeWalkability } from './core/walkability';

export { bresenhamLine, floodFill, rectangleFill, stampCells } from './core/drawing-algorithms';
export type { RectangleFillOptions } from './core/drawing-algorithms';

export { computeRectBounds, clampBounds, isSimplePolygon, polygonArea, toZoneVertices } from './core/zone-geometry';
export type { TileCoord } from './core/zone-geometry';

export { getZoneTiles, rasterizePolygon, detectZoneOverlap, validateAllZones } from './core/zone-validation';
export type { OverlapResult, ValidationError } from './core/zone-validation';

// Material resolver (Phase 4)
export { buildTransitionMap, resolvePaint } from './core/material-resolver';
export type {
  TransitionEntry,
  TransitionMap,
  TransitionWarning,
  PaintResult,
  ResolvePaintOptions,
} from './core/material-resolver';

// Routing pipeline modules (Phase 5)
export { TilesetRegistry, type ResolvedPair } from './core/tileset-registry';
export { buildGraphs, type MaterialGraphs } from './core/graph-builder';
export { computeRoutingTable } from './core/router';
export { resolveEdge } from './core/edge-resolver';
export { classifyEdge } from './core/edge-classifier';
export { selectTilesetForCell, computeCellFrame, resolveRenderTilesetKey } from './core/cell-tileset-selector';
export { RetileEngine } from './core/retile-engine';
export { RoutingPaintCommand, RoutingFillCommand } from './core/routing-commands';

// Routing types
export type {
  CompatGraph,
  RenderGraph,
  MaterialPriorityMap,
  RoutingTable,
  NeighborDirection,
  EdgeDirection,
  CellCacheEntry,
  CellCache,
  CellPatchEntry,
  RetileResult,
  RetileEngineOptions,
  EdgeOwner,
  MapPatchEntry,
} from './types/routing-types';
export type { EdgeClass } from './core/edge-classifier';
