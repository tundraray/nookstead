export type Category = 'skins' | 'eyes' | 'hairstyles' | 'accessories';

export type AnimationType = 'idle' | 'talk' | 'nod' | 'shake';

export interface PortraitPiece {
  id: string;
  category: Category;
  path: string;
  displayName: string;
  group?: string;
  variant?: string;
}

export interface PortraitState {
  skin: PortraitPiece;
  eyes: PortraitPiece;
  hairstyle: PortraitPiece;
  accessory: PortraitPiece | null;
  animationType: AnimationType;
}

export const FRAME_WIDTH = 32;
export const FRAME_HEIGHT = 32;
export const SHEET_COLUMNS = 10;
export const SHEET_ROWS = 3;
export const ANIMATION_FPS = 8;

/** Spritesheet row index for each animated type. idle is static (frame 0 of talk row). */
export const ANIM_ROW: Record<AnimationType, number> = {
  idle: 0,
  talk: 0,
  nod: 1,
  shake: 2,
};
