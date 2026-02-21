// Re-export shim: all exports now come from @nookstead/map-lib
// This file is kept for backward compatibility. Prefer importing from @nookstead/map-lib directly.
export {
  computeRectBounds,
  clampBounds,
  isSimplePolygon,
  polygonArea,
  toZoneVertices,
} from '@nookstead/map-lib';
export type { TileCoord as TilePos } from '@nookstead/map-lib';
