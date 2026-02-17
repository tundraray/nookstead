// TRANSITIONAL: Re-exports shared map types for backward compatibility.
// All imports should be updated to use '@nookstead/shared' directly.
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
