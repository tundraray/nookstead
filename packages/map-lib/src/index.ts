// Re-export shared types for convenience
export type {
  TerrainCellType, Cell, Grid, LayerData, GeneratedMap,
  CellAction
} from '@nookstead/shared';

// Core autotile engine
export {
  FRAMES_PER_TERRAIN, SOLID_FRAME, ISOLATED_FRAME, EMPTY_FRAME,
  getFrame,
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
  WarpZoneProperties, SpawnRuleConfig, NpcScheduleConfig, OperatingHoursConfig,
} from './types/index';
export {
  MAP_TYPE_CONSTRAINTS, ZONE_COLORS, ZONE_OVERLAP_ALLOWED,
  validateMapDimensions, isWarpZone,
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
  InteractionLayer,
  EditorLayerUnion,
  EditorLayer,
  CellDelta,
  EditorCommand,
  MapEditorState,
  MapEditorAction,
  LoadMapPayload,
} from './types/editor-types';
export { SIDEBAR_TABS } from './types/editor-types';

// Core algorithm modules (Phase 2)
export { computeNeighborMask } from './core/neighbor-mask';

export { bresenhamLine, floodFill, rectangleFill, stampCells } from './core/drawing-algorithms';
export type { RectangleFillOptions } from './core/drawing-algorithms';

export { computeRectBounds, clampBounds, isSimplePolygon, polygonArea, toZoneVertices } from './core/zone-geometry';
export type { TileCoord } from './core/zone-geometry';

export { getZoneTiles, rasterizePolygon, detectZoneOverlap, validateAllZones } from './core/zone-validation';
export type { OverlapResult, ValidationError } from './core/zone-validation';

// Routing pipeline modules (Phase 5)
export { TilesetRegistry, type ResolvedPair } from './core/tileset-registry';
export { buildGraphs, type MaterialGraphs } from './core/graph-builder';
export { computeRoutingTable } from './core/router';
export { resolveEdge } from './core/edge-resolver';
export { classifyEdge } from './core/edge-classifier';
export { selectTilesetForCell, computeCellFrame, resolveRenderTilesetKey } from './core/cell-tileset-selector';
export { RetileEngine } from './core/retile-engine';
export { RoutingPaintCommand, RoutingFillCommand } from './core/routing-commands';

// Walkability
export { recomputeWalkability, applyObjectCollisionZones } from './core/walkability';

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
