export const COLYSEUS_PORT = 2567;
export const PATCH_RATE_MS = 100;

export type SkinKey =
  | 'scout_1'
  | 'scout_2'
  | 'scout_3'
  | 'scout_4'
  | 'scout_5'
  | 'scout_6';

export const AVAILABLE_SKINS: SkinKey[] = [
  'scout_1',
  'scout_2',
  'scout_3',
  'scout_4',
  'scout_5',
  'scout_6',
];

// Tile size (shared between client and server)
export const TILE_SIZE = 16;

// Chunk-based world configuration
export const CHUNK_SIZE = 64;
export const CHUNK_ROOM_NAME = 'chunk_room';

// Movement configuration
export const MAX_SPEED = 5;

// Default spawn location (center of 64×64 map at 16px tiles, last-resort fallback)
export const DEFAULT_SPAWN = {
  worldX: 520,
  worldY: 528,
  chunkId: 'city:capital',
};

// World boundaries
export const WORLD_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 1024,
  maxY: 1024,
};

// Chunk transition configuration
export const CHUNK_TRANSITION_COOLDOWN_MS = 500;

// Location types
export enum LocationType {
  MAP = 'MAP', // Single-chunk maps: homesteads, cities (chunkId format: map:{mapId})
  WORLD = 'WORLD', // Spatial open-world chunks (chunkId format: world:{x}:{y})
}

/**
 * Discriminator for map subtypes stored in the maps table.
 * Matches the map_type column values in the database.
 */
export type MapType = 'homestead' | 'city' | 'open_world';

// Movement prediction configuration (FR-16)

/**
 * Pixel distance threshold for movement reconciliation.
 * Delta below threshold: smooth interpolation (lerp at INTERPOLATION_SPEED per frame).
 * Delta at or above threshold: snap to authoritative position immediately.
 */
export const CORRECTION_THRESHOLD = 8;

/**
 * Lerp factor per frame for smooth position correction.
 * Applied each frame while interpolating toward authoritative position.
 * Value 0.2 means 20% of remaining distance is closed each frame.
 */
export const INTERPOLATION_SPEED = 0.2;

// Loading screen configuration (FR-19)

/**
 * Maximum milliseconds to wait for MAP_DATA and player snapshot before showing
 * a timeout error with retry button.
 */
export const LOADING_TIMEOUT_MS = 10000;
