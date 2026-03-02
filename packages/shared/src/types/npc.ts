/**
 * State machine states for a bot companion.
 * Bots alternate between IDLE (waiting) and WALKING (moving toward a target).
 */
export type BotAnimState = 'idle' | 'walking';

/**
 * Runtime state of a single bot, mirroring Colyseus ChunkBot schema fields.
 * Used by the client to type-check bot data received via Colyseus state.
 */
export interface BotState {
  id: string;
  mapId: string;
  name: string;
  skin: string;
  worldX: number;
  worldY: number;
  direction: string;
  state: BotAnimState;
}

/**
 * Payload sent by the client when interacting with a bot.
 */
export interface NpcInteractPayload {
  botId: string;
}

/**
 * Data about a bot returned in a successful interaction result.
 */
export interface NpcBotData {
  id: string;
  name: string;
  state: BotAnimState;
}

/**
 * Result sent by the server after an NPC_INTERACT message.
 * On success: { success: true, bot: NpcBotData }
 * On failure: { success: false, error: string }
 */
export type NpcInteractResult =
  | { success: true; bot: NpcBotData }
  | { success: false; error: string };
