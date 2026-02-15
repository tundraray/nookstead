export const ClientMessage = {
  MOVE: 'move',
} as const;

export const ServerMessage = {
  ERROR: 'error',
} as const;

export interface MovePayload {
  x: number;
  y: number;
}
