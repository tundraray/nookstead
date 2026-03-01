export type {
  PlayerState,
  AuthData,
  ChunkRoomState,
  Location,
  MoveResult,
} from './types/room';
export { ClientMessage, ServerMessage } from './types/messages';
export type {
  MovePayload,
  PositionUpdatePayload,
  ClientMessageType,
  ChunkTransitionPayload,
} from './types/messages';
export {
  COLYSEUS_PORT,
  PATCH_RATE_MS,
  AVAILABLE_SKINS,
  CHUNK_SIZE,
  CHUNK_ROOM_NAME,
  MAX_SPEED,
  DEFAULT_SPAWN,
  WORLD_BOUNDS,
  CHUNK_TRANSITION_COOLDOWN_MS,
  LocationType,
  CORRECTION_THRESHOLD,
  INTERPOLATION_SPEED,
  LOADING_TIMEOUT_MS,
  TILE_SIZE,
} from './constants';
export type { SkinKey } from './constants';
// Spawn system
export type { SpawnTile } from './systems/spawn';
export { findSpawnTile, isValidSpawn } from './systems/spawn';
// Map types (from types/map.ts)
export type {
  TerrainCellType,
  CellAction,
  Cell,
  Grid,
  LayerData,
  GeneratedMap,
  SerializedCell,
  SerializedGrid,
  SerializedTileLayer,
  SerializedPlacedObject,
  SerializedObjectLayer,
  SerializedLayer,
  MapDataPayload,
  GameObjectLayerDef,
  CollisionZoneDef,
  GameObjectDefinition,
  SpriteMeta,
  AtlasFrameMeta,
  SessionKickedPayload,
} from './types/map';
export { isTileLayer, isObjectLayer } from './types/map';
// Fence types (from types/fence-layer.ts)
export type {
  FenceCellData,
  SerializedGateData,
  SerializedFenceLayer,
} from './types/fence-layer';
// Game object classification types (from types/game-object.ts)
export {
  GAME_OBJECT_CATEGORIES,
  GAME_OBJECT_TYPES,
  isGameObjectCategory,
  isGameObjectType,
  getAllGameObjectTypes,
} from './types/game-object';
export type {
  GameObjectCategory,
  GameObjectType,
} from './types/game-object';
