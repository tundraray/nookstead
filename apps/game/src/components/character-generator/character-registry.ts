import type { LayerCategory, LayerOption } from './types';
import {
  ADULT_BODY_WIDTH,
  ADULT_BODY_HEIGHT,
  ADULT_BODY_COLUMNS,
  ADULT_OVERLAY_WIDTH,
  ADULT_OVERLAY_HEIGHT,
  ADULT_OVERLAY_COLUMNS,
} from './types';

const BASE_PATH = '/assets/character-generator';

function makeBody(num: string): LayerOption {
  return {
    id: `body_${num}`,
    category: 'body',
    path: `${BASE_PATH}/bodies/Body_${num}.png`,
    displayName: `Body ${num}`,
    columns: ADULT_BODY_COLUMNS,
    sheetWidth: ADULT_BODY_WIDTH,
    sheetHeight: ADULT_BODY_HEIGHT,
  };
}

function makeEyes(num: string): LayerOption {
  return {
    id: `eyes_${num}`,
    category: 'eyes',
    path: `${BASE_PATH}/eyes/Eyes_${num}.png`,
    displayName: `Eyes ${num}`,
    columns: ADULT_OVERLAY_COLUMNS,
    sheetWidth: ADULT_OVERLAY_WIDTH,
    sheetHeight: ADULT_OVERLAY_HEIGHT,
  };
}

function makeHairstyle(style: string, color: string): LayerOption {
  return {
    id: `hairstyle_${style}_${color}`,
    category: 'hairstyle',
    path: `${BASE_PATH}/hairstyles/Hairstyle_${style}_${color}.png`,
    displayName: `Style ${parseInt(style)} Color ${parseInt(color)}`,
    group: `Style ${parseInt(style)}`,
    variant: `Color ${parseInt(color)}`,
    columns: ADULT_OVERLAY_COLUMNS,
    sheetWidth: ADULT_OVERLAY_WIDTH,
    sheetHeight: ADULT_OVERLAY_HEIGHT,
  };
}

function makeOutfit(style: string, variant: string): LayerOption {
  return {
    id: `outfit_${style}_${variant}`,
    category: 'outfit',
    path: `${BASE_PATH}/outfits/Outfit_${style}_${variant}.png`,
    displayName: `Outfit ${parseInt(style)} #${parseInt(variant)}`,
    group: `Outfit ${parseInt(style)}`,
    variant: `#${parseInt(variant)}`,
    columns: ADULT_OVERLAY_COLUMNS,
    sheetWidth: ADULT_OVERLAY_WIDTH,
    sheetHeight: ADULT_OVERLAY_HEIGHT,
  };
}

function makeAccessory(
  num: string,
  name: string,
  variant: string
): LayerOption {
  const displayName = name.replace(/_/g, ' ');
  return {
    id: `accessory_${num}_${name}_${variant}`,
    category: 'accessory',
    path: `${BASE_PATH}/accessories/Accessory_${num}_${name}_${variant}.png`,
    displayName: `${displayName} #${parseInt(variant)}`,
    group: displayName,
    variant: `#${parseInt(variant)}`,
    columns: ADULT_OVERLAY_COLUMNS,
    sheetWidth: ADULT_OVERLAY_WIDTH,
    sheetHeight: ADULT_OVERLAY_HEIGHT,
  };
}

function makeSmartphone(num: string): LayerOption {
  return {
    id: `smartphone_${num}`,
    category: 'smartphone',
    path: `${BASE_PATH}/smartphones/Smartphone_${num}.png`,
    displayName: `Smartphone ${num}`,
    columns: 24,
    sheetWidth: 384,
    sheetHeight: 192,
  };
}

function makeBook(num: string): LayerOption {
  return {
    id: `book_${num}`,
    category: 'book',
    path: `${BASE_PATH}/books/Book_${num}.png`,
    displayName: `Book ${num}`,
    columns: ADULT_OVERLAY_COLUMNS,
    sheetWidth: ADULT_OVERLAY_WIDTH,
    sheetHeight: ADULT_OVERLAY_HEIGHT,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function generateRange(count: number, factory: (num: string) => LayerOption): LayerOption[] {
  return Array.from({ length: count }, (_, i) => factory(pad2(i + 1)));
}

function generateHairstyles(): LayerOption[] {
  const results: LayerOption[] = [];
  for (let style = 1; style <= 29; style++) {
    const colorCount = style <= 26 ? 7 : 6;
    for (let color = 1; color <= colorCount; color++) {
      results.push(makeHairstyle(pad2(style), pad2(color)));
    }
  }
  return results;
}

/** Outfit variant counts per style (1-indexed). */
const OUTFIT_VARIANTS: number[] = [
  10, 4, 4, 3, 5, 4, 4, 3, 3, 5,
  4, 3, 4, 5, 3, 3, 3, 4, 4, 3,
  4, 4, 4, 4, 5, 3, 3, 4, 4, 3,
  5, 5, 3,
];

function generateOutfits(): LayerOption[] {
  const results: LayerOption[] = [];
  for (let style = 1; style <= 33; style++) {
    const variantCount = OUTFIT_VARIANTS[style - 1];
    for (let v = 1; v <= variantCount; v++) {
      results.push(makeOutfit(pad2(style), pad2(v)));
    }
  }
  return results;
}

interface AccessoryType {
  num: string;
  name: string;
  variants: number;
}

const ACCESSORY_TYPES: AccessoryType[] = [
  { num: '01', name: 'Ladybug', variants: 4 },
  { num: '02', name: 'Bee', variants: 3 },
  { num: '03', name: 'Backpack', variants: 10 },
  { num: '04', name: 'Snapback', variants: 6 },
  { num: '05', name: 'Dino_Snapback', variants: 3 },
  { num: '06', name: 'Policeman_Hat', variants: 6 },
  { num: '07', name: 'Bataclava', variants: 3 },
  { num: '08', name: 'Detective_Hat', variants: 3 },
  { num: '09', name: 'Zombie_Brain', variants: 3 },
  { num: '10', name: 'Bolt', variants: 3 },
  { num: '11', name: 'Beanie', variants: 5 },
  { num: '12', name: 'Mustache', variants: 5 },
  { num: '13', name: 'Beard', variants: 5 },
  { num: '14', name: 'Gloves', variants: 4 },
  { num: '15', name: 'Glasses', variants: 6 },
  { num: '16', name: 'Monocle', variants: 3 },
  { num: '17', name: 'Medical_Mask', variants: 5 },
  { num: '18', name: 'Chef', variants: 3 },
  { num: '19', name: 'Party_Cone', variants: 4 },
];

function generateAccessories(): LayerOption[] {
  const results: LayerOption[] = [];
  for (const { num, name, variants } of ACCESSORY_TYPES) {
    for (let v = 1; v <= variants; v++) {
      results.push(makeAccessory(num, name, pad2(v)));
    }
  }
  return results;
}

const BODIES = generateRange(9, makeBody);
const EYES = generateRange(7, makeEyes);
const HAIRSTYLES = generateHairstyles();
const OUTFITS = generateOutfits();
const ACCESSORIES = generateAccessories();
const SMARTPHONES = Array.from({ length: 5 }, (_, i) =>
  makeSmartphone(String(i + 1))
);
const BOOKS = generateRange(6, makeBook);

const CATEGORY_MAP: Record<LayerCategory, LayerOption[]> = {
  body: BODIES,
  eyes: EYES,
  hairstyle: HAIRSTYLES,
  outfit: OUTFITS,
  accessory: ACCESSORIES,
  smartphone: SMARTPHONES,
  book: BOOKS,
};

export function getLayerOptions(category: LayerCategory): LayerOption[] {
  return CATEGORY_MAP[category];
}

export function getDefaultOptions(): Record<LayerCategory, LayerOption | null> {
  return {
    body: BODIES[0],
    eyes: EYES[0],
    hairstyle: HAIRSTYLES[0],
    outfit: OUTFITS[0],
    accessory: null,
    smartphone: null,
    book: null,
  };
}

export function getLayerOptionById(
  category: LayerCategory,
  id: string
): LayerOption | undefined {
  return CATEGORY_MAP[category].find((opt) => opt.id === id);
}

/** Get unique groups for a category (for grouped selectors). */
export function getGroups(category: LayerCategory): string[] {
  const options = CATEGORY_MAP[category];
  const groups = new Set<string>();
  for (const opt of options) {
    if (opt.group) groups.add(opt.group);
  }
  return [...groups];
}
