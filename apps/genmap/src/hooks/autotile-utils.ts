// Re-export shim: all exports now come from @nookstead/map-lib
// This file is kept for backward compatibility. Prefer importing from @nookstead/map-lib directly.
export {
  checkTerrainPresence,
  computeNeighborMask,
  recomputeAutotileLayers,
  recomputeWalkability,
} from '@nookstead/map-lib';
export type { TilesetInfo, MaterialInfo } from '@nookstead/map-lib';
