import type { GiftDefinition, GiftId, GiftCategory } from '@nookstead/shared';

export const GIFT_DEFINITIONS: readonly GiftDefinition[] = [
  { id: 'flowers', label: 'Цветы', category: 'flowers', scoreBonus: 3, importance: 4, memoryTemplate: '{player} принёс(ла) мне цветы. Было приятно.' },
  { id: 'pie', label: 'Пирог', category: 'food', scoreBonus: 4, importance: 5, memoryTemplate: '{player} угостил(а) меня домашним пирогом.' },
  { id: 'mushrooms', label: 'Грибы', category: 'food', scoreBonus: 2, importance: 3, memoryTemplate: '{player} поделился(ась) грибами из леса.' },
  { id: 'herbs', label: 'Травы', category: 'food', scoreBonus: 2, importance: 3, memoryTemplate: '{player} принёс(ла) свежие травы.' },
  { id: 'fishing_rod', label: 'Удочка', category: 'tool', scoreBonus: 5, importance: 6, memoryTemplate: '{player} подарил(а) мне удочку ручной работы.' },
  { id: 'carved_wood', label: 'Деревянная фигурка', category: 'craft', scoreBonus: 4, importance: 5, memoryTemplate: '{player} вырезал(а) для меня фигурку.' },
  { id: 'pottery', label: 'Глиняный горшок', category: 'craft', scoreBonus: 3, importance: 4, memoryTemplate: '{player} принёс(ла) горшок собственной лепки.' },
  { id: 'knitted_scarf', label: 'Вязаный шарф', category: 'craft', scoreBonus: 5, importance: 6, memoryTemplate: '{player} связал(а) для меня шарф.' },
  { id: 'old_book', label: 'Старая книга', category: 'book', scoreBonus: 4, importance: 5, memoryTemplate: '{player} поделился(ась) интересной книгой.' },
  { id: 'recipe_book', label: 'Книга рецептов', category: 'book', scoreBonus: 5, importance: 6, memoryTemplate: '{player} принёс(ла) книгу рецептов.' },
  { id: 'silver_ring', label: 'Серебряное кольцо', category: 'luxury', scoreBonus: 7, importance: 7, memoryTemplate: '{player} подарил(а) мне серебряное кольцо.' },
  { id: 'love_letter', label: 'Любовное письмо', category: 'romantic', scoreBonus: 8, importance: 8, memoryTemplate: '{player} написал(а) мне любовное письмо.' },
  { id: 'perfume', label: 'Духи', category: 'luxury', scoreBonus: 6, importance: 7, memoryTemplate: '{player} принёс(ла) духи.' },
  { id: 'candles', label: 'Свечи', category: 'luxury', scoreBonus: 4, importance: 5, memoryTemplate: '{player} принёс(ла) красивые свечи.' },
  { id: 'honey_cake', label: 'Медовый торт', category: 'food', scoreBonus: 5, importance: 6, memoryTemplate: '{player} испёк(ла) для меня медовый торт.' },
] as const;

export function getGift(id: GiftId): GiftDefinition {
  const gift = GIFT_DEFINITIONS.find((g) => g.id === id);
  if (!gift) {
    throw new Error(`[gift-registry] Unknown gift id: ${id}`);
  }
  return gift;
}

export function getGiftsByCategory(category: GiftCategory): GiftDefinition[] {
  return GIFT_DEFINITIONS.filter((g) => g.category === category);
}
