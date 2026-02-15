export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SpriteRect = [x: number, y: number, w: number, h: number];
export type PanelId = 'inventory' | 'map' | 'quests' | 'social' | 'settings';

export interface NavItem {
  id: PanelId;
  label: string;
  shortcutKey: string;
  shortcutCode: string;
  tooltip: string;
}

export interface HeaderState {
  day: number;
  time: string;
  season: Season;
  gold: number;
  activePanel: PanelId | null;
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
  energy: number; // 0-100
  maxEnergy: number;
  hotbarItems: (HotbarItem | null)[]; // length 10
  selectedSlot: number; // 0-9
}

export const DEFAULT_HUD_STATE: HUDState = {
  day: 1,
  time: '08:00',
  season: 'spring',
  gold: 0,
  energy: 100,
  maxEnergy: 100,
  hotbarItems: Array(10).fill(null),
  selectedSlot: 0,
};
