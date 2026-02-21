export const COLYSEUS_PORT = 2567;
export const TICK_RATE = 10;
export const TICK_INTERVAL_MS = 1000 / TICK_RATE;
export const PATCH_RATE_MS = 100;
export const ROOM_NAME = 'game_room';
export const MAX_PLAYERS_PER_ROOM = 50;

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

export const POSITION_SYNC_INTERVAL_MS = TICK_INTERVAL_MS;

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
  CITY = 'CITY',
  PLAYER = 'PLAYER',
  OPEN_WORLD = 'OPEN_WORLD',
}

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
