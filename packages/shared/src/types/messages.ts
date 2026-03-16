export const ClientMessage = {
  MOVE: 'move',
  POSITION_UPDATE: 'position_update',
  NPC_INTERACT: 'npc_interact',
  HARD_RESET: 'hard_reset',
  DIALOGUE_MESSAGE: 'dialogue_message',
  DIALOGUE_END: 'dialogue_end',
  DIALOGUE_ACTION: 'dialogue_action',
  // Inventory operations
  INVENTORY_REQUEST: 'inventory_request',
  INVENTORY_MOVE: 'inventory_move',
  INVENTORY_ADD: 'inventory_add', // debug/admin use only
  INVENTORY_DROP: 'inventory_drop',
  TOOL_ACTION: 'tool_action',
} as const;

export type ClientMessageType = typeof ClientMessage[keyof typeof ClientMessage];

export const ServerMessage = {
  ERROR: 'error',
  CHUNK_TRANSITION: 'chunk_transition',
  MAP_DATA: 'map_data',
  SESSION_KICKED: 'session_kicked',
  ROOM_REDIRECT: 'room_redirect',
  NPC_INTERACT_RESULT: 'npc_interact_result',
  DIALOGUE_START: 'dialogue_start',
  DIALOGUE_STREAM_CHUNK: 'dialogue_stream_chunk',
  DIALOGUE_END_TURN: 'dialogue_end_turn',
  DIALOGUE_ACTION_RESULT: 'dialogue_action_result',
  DIALOGUE_SCORE_CHANGE: 'dialogue_score_change',
  DIALOGUE_EMOTION: 'dialogue_emotion',
  CLOCK_CONFIG: 'clock_config',
  // Inventory responses
  INVENTORY_DATA: 'inventory_data',
  INVENTORY_UPDATE: 'inventory_update',
  INVENTORY_ERROR: 'inventory_error',
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

/** Payload for TOOL_ACTION messages (farming tools, interactions). Stub — no server handler yet. */
export interface ToolActionPayload {
  action: string;
  x: number;
  y: number;
  data?: Record<string, unknown>;
}
