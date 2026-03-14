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

// Default spawn location (center of 64×64 map at 16px tiles, last-resort fallback)
export const DEFAULT_SPAWN = {
  worldX: 520,
  worldY: 528,
  chunkId: 'city:capital',
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

/**
 * Milliseconds after a client-side displacement during which server
 * reconciliation is suppressed, preventing the server from overwriting
 * the corrected position before it receives the POSITION_UPDATE.
 */
export const DISPLACEMENT_RECONCILE_COOLDOWN_MS = 500;

// Loading screen configuration (FR-19)

/**
 * Maximum milliseconds to wait for MAP_DATA and player snapshot before showing
 * a timeout error with retry button.
 */
export const LOADING_TIMEOUT_MS = 10000;

// ─── Bot Companion Configuration ─────────────────────────────────────────────

/**
 * Bot movement speed in pixels per second.
 * At PATCH_RATE_MS=100ms per tick, this equals 6 pixels per tick.
 */
export const BOT_SPEED = 60;

/**
 * Maximum tile distance from a bot's spawn point for wander target selection.
 * Measured in tile units (multiply by TILE_SIZE for pixel distance).
 */
export const BOT_WANDER_RADIUS = 8;

/**
 * Number of server ticks a bot waits in IDLE state before choosing a new wander target.
 * At PATCH_RATE_MS=100ms, 30 ticks = 3 seconds between wander attempts.
 */
export const BOT_WANDER_INTERVAL_TICKS = 30;

/**
 * Maximum number of bot companions allowed per homestead room.
 */
export const MAX_BOTS_PER_HOMESTEAD = 5;

/**
 * Default number of bots created for a new homestead (first visit).
 */
export const DEFAULT_BOT_COUNT = 1;

/**
 * Interaction radius in tiles. Player must be within this distance to interact with a bot.
 */
export const BOT_INTERACTION_RADIUS = 3;

/**
 * Milliseconds without position change before a WALKING bot is considered stuck.
 * After this timeout, the bot picks a new random target.
 */
export const BOT_STUCK_TIMEOUT_MS = 5000;

/**
 * Maximum number of attempts to find a random walkable tile for bot wander target.
 * Prevents infinite loops on heavily obstructed maps.
 */
export const MAX_WANDER_TARGET_ATTEMPTS = 20;

/**
 * Pool of names assigned to bot companions at creation.
 * Names are assigned uniquely within a homestead (no two bots share a name).
 */
export const BOT_NAMES: readonly string[] = [
  'Biscuit',
  'Clover',
  'Fern',
  'Hazel',
  'Juniper',
  'Maple',
  'Pebble',
  'Sage',
  'Thistle',
  'Willow',
];

// ─── A* Pathfinding Configuration ───────────────────────────────────────────

/**
 * Time-to-live in milliseconds for a computed A* route before it is
 * considered stale and must be recalculated.
 */
export const BOT_ROUTE_CACHE_TTL_MS = 30_000;

/**
 * Maximum number of waypoints an A* path may contain.
 * Paths exceeding this length are discarded and the bot idles.
 */
export const BOT_MAX_PATH_LENGTH = 100;

/**
 * Pixel distance threshold for considering a waypoint "reached".
 * When the bot is within this many pixels of the current waypoint,
 * it advances to the next waypoint in the path.
 */
export const BOT_WAYPOINT_THRESHOLD = 2;

/**
 * Maximum consecutive pathfinding failures before the bot enters
 * an extended idle period instead of retrying immediately.
 */
export const BOT_MAX_PATHFIND_FAILURES = 3;

/**
 * Number of server ticks a bot waits in extended idle after hitting
 * BOT_MAX_PATHFIND_FAILURES consecutive pathfinding failures.
 */
export const BOT_EXTENDED_IDLE_TICKS = 100;

// ─── Player Click-to-Move Pathfinding Configuration ─────────────────────────

/**
 * Maximum number of waypoints an A* path may contain for player click-to-move.
 * Paths exceeding this length are truncated. Higher than BOT_MAX_PATH_LENGTH
 * because players may click far destinations.
 */
export const PLAYER_MAX_PATH_LENGTH = 200;

/**
 * Pixel distance threshold for considering an intermediate waypoint "reached"
 * during player waypoint following. Uses a tight threshold (2px) to keep the
 * player on the grid path without overshooting tile centers.
 */
export const PLAYER_WAYPOINT_THRESHOLD = 2;
