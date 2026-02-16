export type { PlayerState, GameRoomState, AuthData } from './types/room.js';
export { ClientMessage, ServerMessage } from './types/messages.js';
export type {
  MovePayload,
  PositionUpdatePayload,
  ClientMessageType,
} from './types/messages.js';
export {
  COLYSEUS_PORT,
  TICK_RATE,
  TICK_INTERVAL_MS,
  PATCH_RATE_MS,
  ROOM_NAME,
  MAX_PLAYERS_PER_ROOM,
  AVAILABLE_SKINS,
  POSITION_SYNC_INTERVAL_MS,
} from './constants.js';
export type { SkinKey } from './constants.js';
