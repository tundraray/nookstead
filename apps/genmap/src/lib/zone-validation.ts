// Re-export shim: all exports now come from @nookstead/map-lib
// This file is kept for backward compatibility. Prefer importing from @nookstead/map-lib directly.
export {
  getZoneTiles,
  rasterizePolygon,
  detectZoneOverlap,
  validateAllZones,
} from '@nookstead/map-lib';
export type {
  OverlapResult,
  ValidationError,
  TileCoord,
} from '@nookstead/map-lib';
