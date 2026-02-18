import type { PortraitPiece } from './types';

const BASE_PATH = '/assets/portrait-generator';

// ---------------------------------------------------------------------------
// Skins: skin_1 .. skin_9
// ---------------------------------------------------------------------------
export const SKINS: PortraitPiece[] = Array.from({ length: 9 }, (_, i) => {
  const n = i + 1;
  return {
    id: `skin_${n}`,
    category: 'skins' as const,
    path: `${BASE_PATH}/skins/skin_${n}.png`,
    displayName: `Skin ${n}`,
  };
});

// ---------------------------------------------------------------------------
// Eyes: eyes_01 .. eyes_07
// ---------------------------------------------------------------------------
export const EYES: PortraitPiece[] = Array.from({ length: 7 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    id: `eyes_${n}`,
    category: 'eyes' as const,
    path: `${BASE_PATH}/eyes/eyes_${n}.png`,
    displayName: `Eyes ${i + 1}`,
  };
});

// ---------------------------------------------------------------------------
// Hairstyles: hairstyle_{style}_{color}
// Styles 01-26 have colors 1-7, styles 27-29 have colors 1-6
// ---------------------------------------------------------------------------
function buildHairstyles(): PortraitPiece[] {
  const pieces: PortraitPiece[] = [];
  for (let style = 1; style <= 29; style++) {
    const maxColor = style >= 27 ? 6 : 7;
    const styleStr = String(style).padStart(2, '0');
    for (let color = 1; color <= maxColor; color++) {
      pieces.push({
        id: `hairstyle_${styleStr}_${color}`,
        category: 'hairstyles',
        path: `${BASE_PATH}/hairstyles/hairstyle_${styleStr}_${color}.png`,
        displayName: `Style ${style} - Color ${color}`,
        group: `Style ${style}`,
        variant: `Color ${color}`,
      });
    }
  }
  return pieces;
}

export const HAIRSTYLES: PortraitPiece[] = buildHairstyles();

// ---------------------------------------------------------------------------
// Accessories — manually enumerated from the asset list
// ---------------------------------------------------------------------------
interface AccessoryDef {
  num: string;
  name: string;
  variants: number[];
  smallVariants?: number[];
}

const ACCESSORY_DEFS: AccessoryDef[] = [
  { num: '01', name: 'Ladybug', variants: [1, 2, 3, 4] },
  {
    num: '04',
    name: 'Snapback',
    variants: [1, 2, 3, 4, 5, 6],
    smallVariants: [1, 2, 3, 4, 5, 6],
  },
  { num: '05', name: 'Dino Snapback', variants: [1, 2, 3] },
  {
    num: '06',
    name: 'Policeman Hat',
    variants: [1, 2, 3, 4, 5, 6],
    smallVariants: [1, 2, 3, 4, 5, 6],
  },
  { num: '07', name: 'Bataclava', variants: [1, 2, 3] },
  { num: '08', name: 'Detective Hat', variants: [1, 2, 3] },
  { num: '09', name: 'Zombie Brain', variants: [1, 2, 3] },
  { num: '10', name: 'Bolt', variants: [1, 2, 3] },
  {
    num: '11',
    name: 'Beanie',
    variants: [1, 2, 3, 4, 5],
    smallVariants: [1, 2, 3, 4, 5],
  },
  { num: '12', name: 'Mustache', variants: [1, 2, 3, 4, 5] },
  { num: '13', name: 'Beard', variants: [1, 2, 3, 4, 5] },
  { num: '15', name: 'Glasses', variants: [1, 2, 3, 4, 5, 6] },
  { num: '16', name: 'Monocle', variants: [1, 2, 3] },
  { num: '17', name: 'Medical Mask', variants: [1, 2, 3, 4, 5] },
  {
    num: '19',
    name: 'Party Cone',
    variants: [1, 2, 3, 4],
    smallVariants: [1, 2, 3, 4],
  },
];

function buildAccessories(): PortraitPiece[] {
  const pieces: PortraitPiece[] = [];

  for (const def of ACCESSORY_DEFS) {
    const fileNameBase = def.name.replace(/ /g, '_').toLowerCase();

    for (const v of def.variants) {
      pieces.push({
        id: `accessory_${def.num}_${fileNameBase}_${v}`,
        category: 'accessories',
        path: `${BASE_PATH}/accessories/accessory_${def.num}_${fileNameBase}_${v}.png`,
        displayName: `${def.name} ${v}`,
        group: def.name,
        variant: String(v),
      });
    }

    if (def.smallVariants) {
      for (const v of def.smallVariants) {
        pieces.push({
          id: `accessory_${def.num}_${fileNameBase}_small_${v}`,
          category: 'accessories',
          path: `${BASE_PATH}/accessories/accessory_${def.num}_${fileNameBase}_small_${v}.png`,
          displayName: `${def.name} Small ${v}`,
          group: `${def.name} Small`,
          variant: String(v),
        });
      }
    }
  }

  return pieces;
}

export const ACCESSORIES: PortraitPiece[] = buildAccessories();

// ---------------------------------------------------------------------------
// Grouped helpers
// ---------------------------------------------------------------------------

export interface PieceGroup {
  label: string;
  pieces: PortraitPiece[];
}

function groupByField(items: PortraitPiece[]): PieceGroup[] {
  const map = new Map<string, PortraitPiece[]>();
  for (const item of items) {
    const key = item.group ?? item.displayName;
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(item);
  }
  return Array.from(map.entries()).map(([label, pieces]) => ({
    label,
    pieces,
  }));
}

export const HAIRSTYLE_GROUPS: PieceGroup[] = groupByField(HAIRSTYLES);
export const ACCESSORY_GROUPS: PieceGroup[] = groupByField(ACCESSORIES);

// ---------------------------------------------------------------------------
// All pieces by category
// ---------------------------------------------------------------------------

export function getPieces(category: 'skins'): PortraitPiece[];
export function getPieces(category: 'eyes'): PortraitPiece[];
export function getPieces(category: 'hairstyles'): PortraitPiece[];
export function getPieces(category: 'accessories'): PortraitPiece[];
export function getPieces(
  category: 'skins' | 'eyes' | 'hairstyles' | 'accessories'
): PortraitPiece[] {
  switch (category) {
    case 'skins':
      return SKINS;
    case 'eyes':
      return EYES;
    case 'hairstyles':
      return HAIRSTYLES;
    case 'accessories':
      return ACCESSORIES;
  }
}
