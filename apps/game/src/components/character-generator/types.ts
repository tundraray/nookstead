export type LayerCategory =
  | 'body'
  | 'eyes'
  | 'hairstyle'
  | 'outfit'
  | 'accessory'
  | 'smartphone'
  | 'book';

export interface LayerOption {
  id: string;
  category: LayerCategory;
  path: string;
  displayName: string;
  group?: string;
  variant?: string;
  columns: number;
  sheetWidth: number;
  sheetHeight: number;
}

export interface SkinRecipe {
  type: 'custom';
  body: string;
  eyes: string | null;
  hairstyle: string | null;
  outfit: string | null;
  accessory: string | null;
  smartphone: string | null;
  book: string | null;
  isKid: boolean;
}

export interface PresetSkinSelection {
  type: 'preset';
  skin: string;
}

export type StoredSkin = SkinRecipe | PresetSkinSelection;

export const SKIN_RECIPE_KEY = 'nookstead:skin:recipe';
export const SKIN_SHEET_KEY = 'nookstead:skin:sheet';

export const ADULT_BODY_WIDTH = 927;
export const ADULT_BODY_HEIGHT = 656;
export const ADULT_BODY_COLUMNS = 57;

export const ADULT_OVERLAY_WIDTH = 896;
export const ADULT_OVERLAY_HEIGHT = 656;
export const ADULT_OVERLAY_COLUMNS = 56;

export const FRAME_WIDTH = 16;
export const FRAME_HEIGHT = 32;

/** Layer compositing order (bottom to top). */
export const LAYER_ORDER: LayerCategory[] = [
  'body',
  'eyes',
  'outfit',
  'hairstyle',
  'accessory',
];
