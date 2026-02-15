import type { NavItem } from '@/components/hud/types';

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'inventory',
    label: 'Inv',
    shortcutKey: 'I',
    shortcutCode: 'KeyI',
    tooltip: 'Inventory (I)',
  },
  {
    id: 'map',
    label: 'Map',
    shortcutKey: 'M',
    shortcutCode: 'KeyM',
    tooltip: 'Map (M)',
  },
  {
    id: 'quests',
    label: 'Quest',
    shortcutKey: 'J',
    shortcutCode: 'KeyJ',
    tooltip: 'Quests (J)',
  },
  {
    id: 'social',
    label: 'Social',
    shortcutKey: 'O',
    shortcutCode: 'KeyO',
    tooltip: 'Social (O)',
  },
  {
    id: 'settings',
    label: 'Gear',
    shortcutKey: 'Esc',
    shortcutCode: 'Escape',
    tooltip: 'Settings (Esc)',
  },
];

export const SHORTCUT_MAP: Record<string, NavItem['id']> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.shortcutCode, item.id])
) as Record<string, NavItem['id']>;
