export interface PlayerState {
  userId: string;
  x: number;
  y: number;
  name: string;
  connected: boolean;
  skin: string;
  direction: string;
  animState: string;
}

export interface GameRoomState {
  players: Map<string, PlayerState>;
}

export interface AuthData {
  userId: string;
  email: string;
}
