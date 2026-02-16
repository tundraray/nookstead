export const ClientMessage = {
  MOVE: 'move',
  POSITION_UPDATE: 'position_update',
} as const;

export type ClientMessageType = typeof ClientMessage[keyof typeof ClientMessage];

export const ServerMessage = {
  ERROR: 'error',
} as const;

export interface MovePayload {
  x: number;
  y: number;
}

export interface PositionUpdatePayload {
  x: number;
  y: number;
  direction: string;
  animState: string;
}
