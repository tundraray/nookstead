import type { LocationType } from '../constants';

export interface PlayerState {
  userId: string;
  worldX: number;
  worldY: number;
  chunkId: string;
  direction: string;
  skin: string;
  name: string;
}

export interface AuthData {
  userId: string;
  email: string;
}

export interface ChunkRoomState {
  players: Map<string, PlayerState>;
}

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
