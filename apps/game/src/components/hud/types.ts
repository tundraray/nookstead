import type { Season } from '@nookstead/shared';
export type { Season };
export type SpriteRect = [x: number, y: number, w: number, h: number];

export interface HeaderState {
  day: number;
  time: string;
  season: Season;
  gold: number;
}

export interface NineSliceSet {
  cornerTL: SpriteRect;
  edgeT: SpriteRect;
  cornerTR: SpriteRect;
  edgeL: SpriteRect;
  center: SpriteRect;
  edgeR: SpriteRect;
  cornerBL: SpriteRect;
  edgeB: SpriteRect;
  cornerBR: SpriteRect;
}

export interface HotbarItem {
  id: string;
  spriteRect: SpriteRect;
  quantity: number;
}

export interface HUDState {
  day: number;
  time: string; // "HH:MM"
  season: Season;
  gold: number;
  hotbarItems: (HotbarItem | null)[]; // length 10
  selectedSlot: number; // 0-9
}
