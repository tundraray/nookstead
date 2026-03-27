import type { LocationType } from '../constants';

export interface PlayerState {
  userId: string;
  worldX: number;
  worldY: number;
  /**
   * chunkId format:
   * - 'map:{uuid}' for single-chunk maps (homesteads, cities)
   * - 'world:{x}:{y}' for open-world spatial chunks
   * - 'city:capital' as a well-known alias (resolved to map:{uuid} by ChunkRoom)
   */
  chunkId: string;
  direction: string;
  skin: string;
  name: string;
  animState: string;
}

export interface AuthData {
  userId: string;
  email: string;
}

export interface ChunkRoomState {
  players: Map<string, PlayerState>;
}

/**
 * A location that a player can be in.
 * - MAP locations use chunkId format 'map:{uuid}' or alias 'city:capital'
 * - WORLD locations use chunkId format 'world:{x}:{y}'
 */
export interface Location {
  id: string;
  type: LocationType;
}

export interface MoveResult {
  worldX: number;
  worldY: number;
  chunkChanged: boolean;
  oldChunkId?: string;
  newChunkId?: string;
}
