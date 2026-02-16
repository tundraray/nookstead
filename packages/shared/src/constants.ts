export const COLYSEUS_PORT = 2567;
export const TICK_RATE = 10;
export const TICK_INTERVAL_MS = 1000 / TICK_RATE;
export const PATCH_RATE_MS = 100;
export const ROOM_NAME = 'game_room';
export const MAX_PLAYERS_PER_ROOM = 50;

export type SkinKey =
  | 'scout_1'
  | 'scout_2'
  | 'scout_3'
  | 'scout_4'
  | 'scout_5'
  | 'scout_6';

export const AVAILABLE_SKINS: SkinKey[] = [
  'scout_1',
  'scout_2',
  'scout_3',
  'scout_4',
  'scout_5',
  'scout_6',
];

export const POSITION_SYNC_INTERVAL_MS = TICK_INTERVAL_MS;
