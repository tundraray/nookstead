export const ClientMessage = {
  MOVE: 'move',
  POSITION_UPDATE: 'position_update',
  NPC_INTERACT: 'npc_interact',
  HARD_RESET: 'hard_reset',
} as const;

export type ClientMessageType = typeof ClientMessage[keyof typeof ClientMessage];

export const ServerMessage = {
  ERROR: 'error',
  CHUNK_TRANSITION: 'chunk_transition',
  MAP_DATA: 'map_data',
  SESSION_KICKED: 'session_kicked',
  ROOM_REDIRECT: 'room_redirect',
  NPC_INTERACT_RESULT: 'npc_interact_result',
} as const;

export interface MovePayload {
  dx: number;
  dy: number;
}

export interface ChunkTransitionPayload {
  newChunkId: string;
  reservation?: {
    sessionId: string;
    room: { roomId: string; processId: string; name: string };
  };
}

export interface PositionUpdatePayload {
  x: number;
  y: number;
  direction: string;
  animState: string;
}
