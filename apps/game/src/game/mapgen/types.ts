// TRANSITIONAL: Re-exports shared map types for backward compatibility.
// All imports should be updated to use '@nookstead/shared' or '@nookstead/map-lib' directly.
// This file will be deleted in a future cleanup.
export type {
  TerrainCellType,
  Cell,
  CellAction,
  Grid,
  LayerData,
  GeneratedMap,
  GenerationPass,
  LayerPass,
  MapDataPayload,
  SerializedGrid,
  SerializedLayer,
} from '@nookstead/shared';

// Also re-export terrain types from map-lib for convenience
export type { TerrainType, TilesetRelationship, SurfaceProperties } from '@nookstead/map-lib';
