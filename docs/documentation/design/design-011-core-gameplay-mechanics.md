# Техническая спецификация: Ключевые игровые механики Nookstead

**Версия:** 1.0
**Дата:** 14 марта 2026
**Автор:** Senior Mechanics Engineer Agent
**Статус:** Техническая спецификация (Phase 0 -- прототип)
**Зависимости:** GDD v3.0, Core Mechanics Analysis v1.0, Responsive World Design v2.0, NPC Service Spec

---

## Содержание

1. [Система фермерства](#1-система-фермерства)
2. [Экономическая система](#2-экономическая-система)
3. [Система осведомленности NPC о действиях игрока](#3-система-осведомленности-npc-о-действиях-игрока)
4. [Система инвентаря](#4-система-инвентаря)
5. [Система отношений](#5-система-отношений)
6. [Органическая система квестов](#6-органическая-система-квестов)
7. [Цикл дня/ночи и погода](#7-цикл-дняночи-и-погода)
8. [Мультиплеерная синхронизация](#8-мультиплеерная-синхронизация)
9. [Схема базы данных](#9-схема-базы-данных)
10. [Приложение: конфигурация предметов](#10-приложение-конфигурация-предметов)

---

## 1. Система фермерства

### 1.1 Философия

Фермерство в Nookstead -- не самоцель, а **контекст для реакции мира**. Посадил клубнику -- Марко спросит про пирог. Вырастил тыкву -- Олег одобрит терпение. Пропустил полив -- Лена заметит подсохшие грядки, но растения не погибнут. Система намеренно прощающая: рост приостанавливается при отсутствии полива, никогда не наказывает потерей.

### 1.2 Colyseus-схема грядки

```typescript
// libs/shared/src/schemas/FarmPlotState.ts
import { Schema, type } from '@colyseus/schema';

/**
 * Состояние одной грядки.
 * Синхронизируется через Colyseus для мультиплеера
 * (видимо при посещении чужого хозяйства).
 */
export class FarmPlotState extends Schema {
  /** Координата X грядки в тайлах (от 0) */
  @type('uint8') x: number = 0;

  /** Координата Y грядки в тайлах (от 0) */
  @type('uint8') y: number = 0;

  /**
   * Тип посаженной культуры. Пустая строка = пустая грядка.
   * Одно из: '' | 'radish' | 'potato' | 'strawberry' | 'tomato' | 'pumpkin'
   */
  @type('string') cropType: string = '';

  /**
   * Стадия роста (0-4):
   *   0 = семя
   *   1 = росток
   *   2 = рост
   *   3 = зрелость
   *   4 = урожай (готов к сбору)
   */
  @type('uint8') growthStage: number = 0;

  /** Timestamp (ms) момента посадки */
  @type('float64') plantedAt: number = 0;

  /** Полита ли грядка в текущий период */
  @type('boolean') watered: boolean = false;

  /** Timestamp (ms) последнего полива */
  @type('float64') lastWateredAt: number = 0;

  /**
   * Накопленное "эффективное" время роста в мс.
   * Увеличивается только в периоды, когда грядка полита.
   */
  @type('float64') effectiveGrowthMs: number = 0;

  /** Timestamp последнего обновления effectiveGrowthMs */
  @type('float64') lastGrowthUpdate: number = 0;

  /** Готова ли грядка к сбору (growthStage === 4) */
  @type('boolean') harvestReady: boolean = false;
}
```

### 1.3 Конфигурация культур

```typescript
// libs/shared/src/config/crops.ts

export interface CropConfig {
  /** Уникальный идентификатор (slug) */
  id: string;

  /** Отображаемое имя (RU) */
  name: string;

  /** Допустимые сезоны для посадки */
  seasons: Season[];

  /**
   * Общее время роста в мс.
   * Растение проходит stages стадий за это время,
   * но только при условии полива (см. алгоритм ниже).
   */
  growthTimeMs: number;

  /** Количество стадий роста (включая урожай) */
  stages: number;

  /** Ключ спрайта для каждой стадии (0..stages-1) */
  stageSprites: string[];

  /** Цена семян (покупка у торговца) */
  seedPrice: number;

  /** Базовая цена продажи собранного урожая */
  sellPrice: number;

  /**
   * Бонусные множители конкретных NPC при продаже напрямую.
   * Ключ -- npcId, значение -- множитель (1.0 = без бонуса).
   */
  npcBonus: Record<string, number>;

  /** Сколько раз в день нужно поливать (1 или 2) */
  wateringsPerDay: number;

  /**
   * Погибает ли при пропуске полива.
   * В Nookstead ВСЕГДА false (cozy-дизайн).
   */
  withersOnMissedWater: false;

  /** Через сколько мс после созревания плод увядает (визуально) */
  witherAfterHarvestMs: number;

  /** Количество урожая с одной грядки */
  harvestYield: number;

  /** Шанс "золотого" урожая (множитель x3 при продаже) */
  goldenChance: number;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Константы времени */
const HOUR = 3_600_000;
const DAY = 86_400_000;

export const CROP_CONFIGS: Record<string, CropConfig> = {
  radish: {
    id: 'radish',
    name: 'Редис',
    seasons: ['spring', 'summer'],
    growthTimeMs: 12 * HOUR,       // 12 реальных часов
    stages: 5,
    stageSprites: [
      'crop_radish_0', 'crop_radish_1', 'crop_radish_2',
      'crop_radish_3', 'crop_radish_4',
    ],
    seedPrice: 5,
    sellPrice: 15,
    npcBonus: {
      stepan: 1.0,   // Степан не даёт бонус, но хвалит
      ira: 1.15,     // Ира: "Для салата -- идеально!"
    },
    wateringsPerDay: 1,
    withersOnMissedWater: false,
    witherAfterHarvestMs: 48 * HOUR,
    harvestYield: 3,
    goldenChance: 0.05,
  },

  potato: {
    id: 'potato',
    name: 'Картофель',
    seasons: ['spring'],
    growthTimeMs: 2 * DAY,          // 48 реальных часов
    stages: 5,
    stageSprites: [
      'crop_potato_0', 'crop_potato_1', 'crop_potato_2',
      'crop_potato_3', 'crop_potato_4',
    ],
    seedPrice: 8,
    sellPrice: 25,
    npcBonus: {
      marko: 1.2,    // Марко: мука/зерновые категория
      ira: 1.2,      // Ира: "Из картошки суп сварю!"
    },
    wateringsPerDay: 1,
    withersOnMissedWater: false,
    witherAfterHarvestMs: 48 * HOUR,
    harvestYield: 4,
    goldenChance: 0.03,
  },

  strawberry: {
    id: 'strawberry',
    name: 'Клубника',
    seasons: ['spring', 'summer'],
    growthTimeMs: 3 * DAY,          // 72 реальных часа
    stages: 5,
    stageSprites: [
      'crop_strawberry_0', 'crop_strawberry_1', 'crop_strawberry_2',
      'crop_strawberry_3', 'crop_strawberry_4',
    ],
    seedPrice: 12,
    sellPrice: 40,
    npcBonus: {
      marko: 1.2,    // Марко: "Для пирога -- идеально!"
      lena: 1.5,     // Лена: цветы и ягоды
    },
    wateringsPerDay: 2,
    withersOnMissedWater: false,
    witherAfterHarvestMs: 48 * HOUR,
    harvestYield: 5,
    goldenChance: 0.04,
  },

  tomato: {
    id: 'tomato',
    name: 'Помидоры',
    seasons: ['summer'],
    growthTimeMs: 4 * DAY,          // 96 реальных часов
    stages: 5,
    stageSprites: [
      'crop_tomato_0', 'crop_tomato_1', 'crop_tomato_2',
      'crop_tomato_3', 'crop_tomato_4',
    ],
    seedPrice: 10,
    sellPrice: 35,
    npcBonus: {
      ira: 1.15,     // Ира: +15% на все продукты питания
    },
    wateringsPerDay: 2,
    withersOnMissedWater: false,
    witherAfterHarvestMs: 48 * HOUR,
    harvestYield: 6,
    goldenChance: 0.03,
  },

  pumpkin: {
    id: 'pumpkin',
    name: 'Тыква',
    seasons: ['autumn'],
    growthTimeMs: 6 * DAY,          // 144 реальных часа
    stages: 5,
    stageSprites: [
      'crop_pumpkin_0', 'crop_pumpkin_1', 'crop_pumpkin_2',
      'crop_pumpkin_3', 'crop_pumpkin_4',
    ],
    seedPrice: 15,
    sellPrice: 60,
    npcBonus: {
      lena: 1.3,     // Лена: "Какая красивая тыква!"
    },
    wateringsPerDay: 2,
    withersOnMissedWater: false,
    witherAfterHarvestMs: 48 * HOUR,
    harvestYield: 2,
    goldenChance: 0.08,    // Повышенный шанс "золотого"
  },
} as const;
```

### 1.4 Алгоритм роста

Рост основан на **накопленном эффективном времени** (`effectiveGrowthMs`). Время начисляется только когда грядка полита. Это значит, что при пропуске полива рост ставится на паузу, а не убивает растение.

```typescript
// apps/server/src/systems/farming/CropGrowthSystem.ts

import { FarmPlotState } from '@nookstead/shared/schemas';
import { CROP_CONFIGS, CropConfig } from '@nookstead/shared/config/crops';

/** Бонус от дождя: рост на 25% быстрее */
const RAIN_GROWTH_MULTIPLIER = 1.25;

/**
 * Обновляет рост на одной грядке.
 * Вызывается каждый тик сервера (100 мс) для каждого активного участка.
 *
 * Алгоритм:
 * 1. Если грядка пуста или уже на стадии урожая -- пропускаем.
 * 2. Если грядка НЕ полита -- рост приостановлен, ничего не начисляем.
 * 3. Если полита -- добавляем дельту к effectiveGrowthMs.
 * 4. Маппим effectiveGrowthMs на стадию роста (0-4).
 */
export function updateCropGrowth(
  plot: FarmPlotState,
  now: number,
  isRaining: boolean,
): void {
  // Пропуск пустых грядок и готовых к сбору
  if (plot.cropType === '' || plot.harvestReady) return;

  const config = CROP_CONFIGS[plot.cropType];
  if (!config) return;

  const deltaMs = now - plot.lastGrowthUpdate;
  plot.lastGrowthUpdate = now;

  // Рост только при поливе
  if (!plot.watered) return;

  // Начисляем эффективное время с учётом дождя
  const multiplier = isRaining ? RAIN_GROWTH_MULTIPLIER : 1.0;
  plot.effectiveGrowthMs += deltaMs * multiplier;

  // Вычисляем стадию
  const progress = Math.min(plot.effectiveGrowthMs / config.growthTimeMs, 1.0);
  const newStage = calculateGrowthStage(progress, config.stages);

  if (newStage !== plot.growthStage) {
    plot.growthStage = newStage;
  }

  // Проверяем готовность к сбору
  if (progress >= 1.0 && !plot.harvestReady) {
    plot.harvestReady = true;
    plot.growthStage = config.stages - 1; // Последняя стадия = урожай
  }
}

/**
 * Маппинг прогресса (0.0 - 1.0) на стадию роста (0 - stages-1).
 *
 * Распределение по GDD:
 *   Стадия 0 (семя):     0%  - 15%
 *   Стадия 1 (росток):   15% - 35%
 *   Стадия 2 (рост):     35% - 65%
 *   Стадия 3 (зрелость): 65% - 90%
 *   Стадия 4 (урожай):   90% - 100%
 */
function calculateGrowthStage(progress: number, stages: number): number {
  if (stages !== 5) {
    // Fallback: равномерное распределение для нестандартных культур
    return Math.min(Math.floor(progress * stages), stages - 1);
  }

  if (progress < 0.15) return 0;
  if (progress < 0.35) return 1;
  if (progress < 0.65) return 2;
  if (progress < 0.90) return 3;
  return 4;
}

/**
 * Ежедневный сброс полива.
 * Вызывается при наступлении нового реального дня (полночь по серверу)
 * или при наступлении нового игрового дня (при speed multiplier > 1).
 */
export function resetDailyWatering(plots: FarmPlotState[]): void {
  for (const plot of plots) {
    if (plot.cropType !== '') {
      plot.watered = false;
    }
  }
}
```

### 1.5 Механика полива

#### Серверная обработка

```typescript
// apps/server/src/systems/farming/WateringSystem.ts

import { FarmPlotState } from '@nookstead/shared/schemas';

export interface WaterResult {
  success: boolean;
  plotsWatered: number;
  errorMessage?: string;
}

/**
 * Обрабатывает действие полива от игрока.
 * Вызывается по Colyseus-сообщению 'action_water'.
 */
export function handleWaterAction(
  plots: FarmPlotState[],
  targetX: number,
  targetY: number,
  toolLevel: number,
  now: number,
): WaterResult {
  // Определяем зону полива по уровню инструмента
  const range = getWateringRange(toolLevel);
  let watered = 0;

  for (const plot of plots) {
    if (isInRange(plot.x, plot.y, targetX, targetY, range)) {
      if (plot.cropType !== '' && !plot.watered) {
        plot.watered = true;
        plot.lastWateredAt = now;
        watered++;
      }
    }
  }

  return { success: watered > 0, plotsWatered: watered };
}

/**
 * Зона полива зависит от уровня инструмента:
 *   Уровень 1: 1 тайл (только целевой)
 *   Уровень 2: 3 тайла в ряд (1x3)
 *   Уровень 3: 3x3 зона
 */
function getWateringRange(toolLevel: number): WateringRange {
  switch (toolLevel) {
    case 1: return { type: 'single' };
    case 2: return { type: 'line', length: 3 };
    case 3: return { type: 'area', width: 3, height: 3 };
    default: return { type: 'single' };
  }
}

type WateringRange =
  | { type: 'single' }
  | { type: 'line'; length: number }
  | { type: 'area'; width: number; height: number };

function isInRange(
  plotX: number,
  plotY: number,
  targetX: number,
  targetY: number,
  range: WateringRange,
): boolean {
  switch (range.type) {
    case 'single':
      return plotX === targetX && plotY === targetY;
    case 'line':
      return plotY === targetY
        && plotX >= targetX
        && plotX < targetX + range.length;
    case 'area':
      const halfW = Math.floor(range.width / 2);
      const halfH = Math.floor(range.height / 2);
      return plotX >= targetX - halfW && plotX <= targetX + halfW
        && plotY >= targetY - halfH && plotY <= targetY + halfH;
  }
}
```

#### Клиентская анимация полива

| Параметр | Значение |
|----------|----------|
| Длительность анимации лейки | 500 мс |
| Спрайт эффекта капель | `fx_water_drops` |
| Длительность эффекта капель | 800 мс |
| Звук | `sfx_watering` (тихий плеск) |
| Визуальная метка "полито" | Тёмный оттенок грядки до следующего сброса |

### 1.6 Механика сбора урожая

```typescript
// apps/server/src/systems/farming/HarvestSystem.ts

import { FarmPlotState } from '@nookstead/shared/schemas';
import { CROP_CONFIGS } from '@nookstead/shared/config/crops';
import { InventoryState } from '@nookstead/shared/schemas';

export interface HarvestResult {
  success: boolean;
  itemId: string;
  quantity: number;
  isGolden: boolean;
}

/**
 * Обрабатывает сбор урожая.
 * Вызывается по Colyseus-сообщению 'action_harvest'.
 */
export function handleHarvestAction(
  plot: FarmPlotState,
  inventory: InventoryState,
  toolLevel: number,
): HarvestResult | null {
  if (!plot.harvestReady || plot.cropType === '') return null;

  const config = CROP_CONFIGS[plot.cropType];
  if (!config) return null;

  // Определяем количество и качество
  const isGolden = Math.random() < config.goldenChance;
  const itemId = isGolden ? `${config.id}_golden` : config.id;
  const quantity = config.harvestYield;

  // Пробуем добавить в инвентарь
  const added = addToInventory(inventory, itemId, quantity);
  if (!added) return null; // Инвентарь полон

  // Очищаем грядку
  resetPlot(plot);

  return { success: true, itemId, quantity, isGolden };
}

function resetPlot(plot: FarmPlotState): void {
  plot.cropType = '';
  plot.growthStage = 0;
  plot.plantedAt = 0;
  plot.watered = false;
  plot.lastWateredAt = 0;
  plot.effectiveGrowthMs = 0;
  plot.lastGrowthUpdate = 0;
  plot.harvestReady = false;
}

function addToInventory(
  inventory: InventoryState,
  itemId: string,
  quantity: number,
): boolean {
  // Сначала ищем существующий стак с тем же предметом
  for (const slot of inventory.slots) {
    if (slot.itemId === itemId && slot.quantity < getMaxStack(itemId)) {
      const canAdd = Math.min(quantity, getMaxStack(itemId) - slot.quantity);
      slot.quantity += canAdd;
      quantity -= canAdd;
      if (quantity <= 0) return true;
    }
  }

  // Затем используем пустые слоты
  for (const slot of inventory.slots) {
    if (slot.itemId === '') {
      const canAdd = Math.min(quantity, getMaxStack(itemId));
      slot.itemId = itemId;
      slot.quantity = canAdd;
      quantity -= canAdd;
      if (quantity <= 0) return true;
    }
  }

  return quantity <= 0;
}

function getMaxStack(itemId: string): number {
  return 99; // Стандартный размер стака для MVP
}
```

#### Клиентская анимация сбора

| Параметр | Значение |
|----------|----------|
| Анимация серпа | 400 мс |
| "Pop" эффект частиц | 300 мс, 5-8 частиц, цвет плода |
| Звук | `sfx_harvest_pop` + `sfx_coin_jingle` |
| Всплывающий текст | "+{quantity} {cropName}" -- жёлтый, парящий вверх 600 мс |
| Золотой урожай | Дополнительный блеск + звук `sfx_golden_harvest` |

### 1.7 Система инструментов

```typescript
// libs/shared/src/config/tools.ts

export interface ToolConfig {
  id: string;
  name: string;
  action: 'till' | 'water' | 'harvest';
  level: 1 | 2 | 3;
  /** Зона действия инструмента */
  range: ToolRange;
  animationKey: string;
  cooldownMs: number;
  /** Цена покупки / улучшения у NPC Егора */
  price: number;
}

export type ToolRange =
  | { type: 'single' }
  | { type: 'line'; length: number }
  | { type: 'area'; width: number; height: number };

export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  // --- Лейка ---
  watering_can_1: {
    id: 'watering_can_1',
    name: 'Лейка',
    action: 'water',
    level: 1,
    range: { type: 'single' },
    animationKey: 'anim_water_1',
    cooldownMs: 500,
    price: 0,
  },
  watering_can_2: {
    id: 'watering_can_2',
    name: 'Улучшенная лейка',
    action: 'water',
    level: 2,
    range: { type: 'line', length: 3 },
    animationKey: 'anim_water_2',
    cooldownMs: 700,
    price: 300,
  },
  watering_can_3: {
    id: 'watering_can_3',
    name: 'Мастерская лейка',
    action: 'water',
    level: 3,
    range: { type: 'area', width: 3, height: 3 },
    animationKey: 'anim_water_3',
    cooldownMs: 900,
    price: 1200,
  },

  // --- Мотыга ---
  hoe_1: {
    id: 'hoe_1',
    name: 'Мотыга',
    action: 'till',
    level: 1,
    range: { type: 'single' },
    animationKey: 'anim_hoe_1',
    cooldownMs: 600,
    price: 0,
  },
  hoe_2: {
    id: 'hoe_2',
    name: 'Улучшенная мотыга',
    action: 'till',
    level: 2,
    range: { type: 'line', length: 3 },
    animationKey: 'anim_hoe_2',
    cooldownMs: 800,
    price: 300,
  },
  hoe_3: {
    id: 'hoe_3',
    name: 'Мастерская мотыга',
    action: 'till',
    level: 3,
    range: { type: 'area', width: 3, height: 3 },
    animationKey: 'anim_hoe_3',
    cooldownMs: 1000,
    price: 1200,
  },

  // --- Серп ---
  sickle_1: {
    id: 'sickle_1',
    name: 'Серп',
    action: 'harvest',
    level: 1,
    range: { type: 'single' },
    animationKey: 'anim_sickle_1',
    cooldownMs: 400,
    price: 0,
  },
  sickle_2: {
    id: 'sickle_2',
    name: 'Улучшенный серп',
    action: 'harvest',
    level: 2,
    range: { type: 'line', length: 3 },
    animationKey: 'anim_sickle_2',
    cooldownMs: 600,
    price: 300,
  },
  sickle_3: {
    id: 'sickle_3',
    name: 'Мастерский серп',
    action: 'harvest',
    level: 3,
    range: { type: 'area', width: 3, height: 3 },
    animationKey: 'anim_sickle_3',
    cooldownMs: 800,
    price: 1200,
  },
};
```

### 1.8 Прогрессия фермы

| Уровень | Размер | Грядок | Стоимость | Время разблокировки | NPC-реакция |
|---------|--------|--------|-----------|--------------------|-|
| Начальный | 3x3 | 9 | Бесплатно | Старт | Степан даёт 3 семечка редиса |
| Уровень 2 | 4x4 | 16 | 500 монет | ~1 неделя | Виктор: "Участок растёт!" |
| Уровень 3 | 5x5 | 25 | 1500 монет | ~3 недели | Степан: "Серьёзный фермер!" |
| Уровень 4 | 6x6 | 36 | 4000 монет | ~6 недель | Лена: "Лучший огород в городе!" |

```typescript
// libs/shared/src/config/farm-levels.ts

export interface FarmLevel {
  level: number;
  gridSize: number;
  maxPlots: number;
  upgradeCost: number;
  reputationRequired: number;
}

export const FARM_LEVELS: FarmLevel[] = [
  { level: 1, gridSize: 3, maxPlots: 9,  upgradeCost: 0,    reputationRequired: 0  },
  { level: 2, gridSize: 4, maxPlots: 16, upgradeCost: 500,  reputationRequired: 2  },
  { level: 3, gridSize: 5, maxPlots: 25, upgradeCost: 1500, reputationRequired: 5  },
  { level: 4, gridSize: 6, maxPlots: 36, upgradeCost: 4000, reputationRequired: 10 },
];
```

---

## 2. Экономическая система

### 2.1 Валюта

В MVP используется единственная валюта -- **Монеты (Coins)**. Звёзды (Stars) -- премиум/событийная валюта -- откладываются до Phase 2.

| Параметр | Значение |
|----------|----------|
| Стартовый баланс | 100 монет |
| Хранение | PostgreSQL, таблица `player_economy` |
| Синхронизация | Colyseus-схема `InventoryState.coins` |
| Максимум | 999 999 (int32) |

### 2.2 Транзакции

```typescript
// libs/shared/src/types/economy.ts

export interface MarketTransaction {
  id: string;                  // UUID v4
  playerId: string;
  itemId: string;
  quantity: number;
  pricePerUnit: number;        // Базовая цена за единицу
  npcId: string;               // Какой NPC покупает
  bonusApplied: number;        // NPC-бонус (1.0 = без бонуса)
  totalPrice: number;          // pricePerUnit * quantity * bonusApplied
  transactionType: 'sell' | 'buy';
  timestamp: Date;
  serverId: string;
}
```

### 2.3 Расчёт цены продажи

В MVP нет динамического ценообразования. Цены фиксированы, но NPC-бонусы создают стимул продавать определённые товары конкретным персонажам.

```typescript
// apps/server/src/systems/economy/PriceCalculator.ts

import { CROP_CONFIGS } from '@nookstead/shared/config/crops';
import { ITEM_DEFINITIONS } from '@nookstead/shared/config/items';

export interface PriceResult {
  basePrice: number;
  npcBonus: number;           // Множитель (1.0 - 1.5)
  goldenMultiplier: number;   // 1.0 или 3.0
  finalPrice: number;
}

/**
 * Рассчитывает цену продажи предмета конкретному NPC.
 * Формула: basePrice * npcBonus * goldenMultiplier
 */
export function calculateSellPrice(
  itemId: string,
  npcId: string,
): PriceResult {
  const isGolden = itemId.endsWith('_golden');
  const baseItemId = isGolden ? itemId.replace('_golden', '') : itemId;

  // Ищем базовую цену (из CropConfig или ItemDefinition)
  const cropConfig = CROP_CONFIGS[baseItemId];
  const itemDef = ITEM_DEFINITIONS[baseItemId];

  const basePrice = cropConfig?.sellPrice ?? itemDef?.sellPrice ?? 0;

  // NPC-бонус
  const npcBonus = cropConfig?.npcBonus?.[npcId] ?? 1.0;

  // Золотой множитель
  const goldenMultiplier = isGolden ? 3.0 : 1.0;

  const finalPrice = Math.floor(basePrice * npcBonus * goldenMultiplier);

  return { basePrice, npcBonus, goldenMultiplier, finalPrice };
}
```

### 2.4 NPC-бонусы при продаже

Каждый NPC-торговец платит больше за товары, которые им "нужны" по персоне. Это стимулирует игрока взаимодействовать с разными NPC.

| NPC | Бонусная категория | Множитель | Пример |
|-----|--------------------|-----------|--------|
| Марко (пекарь) | Зерновые, ягоды | x1.2 | Картофель 25 * 1.2 = 30 монет |
| Лена (садовник) | Цветы, ягоды | x1.5 | Клубника 40 * 1.5 = 60 монет |
| Ира (кафе) | Все продукты питания | x1.15 | Помидоры 35 * 1.15 = 40 монет |
| Сара (кондитер) | Ягоды, молоко, яйца | x1.3 | Клубника 40 * 1.3 = 52 монеты |
| Олег (рыбак) | Базовая цена | x1.0 | Не торгует продуктами |
| Торговец (рынок) | Все товары | x1.0 | Базовая цена без бонуса |

### 2.5 Система магазинов

```typescript
// libs/shared/src/types/shop.ts

export interface ShopInventory {
  npcId: string;
  shopName: string;
  items: ShopItem[];
  openHour: number;            // Час открытия (реальное время)
  closeHour: number;           // Час закрытия
}

export interface ShopItem {
  itemId: string;
  name: string;
  price: number;
  category: 'seed' | 'tool' | 'gift' | 'decoration' | 'recipe';
  /** -1 = безлимитный запас, >0 = ограниченный */
  stock: number;
  /** Интервал пополнения запаса в мс (0 = без пополнения) */
  restockIntervalMs: number;
}
```

#### Конфигурация магазинов MVP

```typescript
// libs/shared/src/config/shops.ts

import { ShopInventory } from '../types/shop';

const DAY = 86_400_000;

export const SHOP_CONFIGS: Record<string, ShopInventory> = {
  market: {
    npcId: 'merchant',
    shopName: 'Фермерский рынок',
    openHour: 8,
    closeHour: 18,
    items: [
      // Семена (безлимитно)
      { itemId: 'seed_radish',      name: 'Семена редиса',     price: 5,   category: 'seed', stock: -1, restockIntervalMs: 0 },
      { itemId: 'seed_potato',      name: 'Семена картофеля',  price: 8,   category: 'seed', stock: -1, restockIntervalMs: 0 },
      { itemId: 'seed_strawberry',  name: 'Семена клубники',   price: 12,  category: 'seed', stock: -1, restockIntervalMs: 0 },
      { itemId: 'seed_tomato',      name: 'Семена помидоров',  price: 10,  category: 'seed', stock: -1, restockIntervalMs: 0 },
      { itemId: 'seed_pumpkin',     name: 'Семена тыквы',      price: 15,  category: 'seed', stock: -1, restockIntervalMs: 0 },
      // Удобрение (ограничено)
      { itemId: 'fertilizer',       name: 'Удобрение',         price: 20,  category: 'tool', stock: 5,  restockIntervalMs: DAY },
    ],
  },

  egor_workshop: {
    npcId: 'egor',
    shopName: 'Мастерская Егора',
    openHour: 9,
    closeHour: 17,
    items: [
      { itemId: 'watering_can_2',  name: 'Улучшенная лейка',    price: 300,  category: 'tool', stock: 1,  restockIntervalMs: 0 },
      { itemId: 'watering_can_3',  name: 'Мастерская лейка',    price: 1200, category: 'tool', stock: 1,  restockIntervalMs: 0 },
      { itemId: 'hoe_2',           name: 'Улучшенная мотыга',   price: 300,  category: 'tool', stock: 1,  restockIntervalMs: 0 },
      { itemId: 'hoe_3',           name: 'Мастерская мотыга',   price: 1200, category: 'tool', stock: 1,  restockIntervalMs: 0 },
      { itemId: 'sickle_2',        name: 'Улучшенный серп',     price: 300,  category: 'tool', stock: 1,  restockIntervalMs: 0 },
      { itemId: 'sickle_3',        name: 'Мастерский серп',     price: 1200, category: 'tool', stock: 1,  restockIntervalMs: 0 },
    ],
  },

  lena_flowers: {
    npcId: 'lena',
    shopName: 'Цветочная лавка Лены',
    openHour: 7,
    closeHour: 17,
    items: [
      { itemId: 'seed_daisy',      name: 'Семена ромашки',     price: 8,   category: 'seed', stock: 10, restockIntervalMs: DAY },
      { itemId: 'seed_lavender',   name: 'Семена лаванды',     price: 15,  category: 'seed', stock: 5,  restockIntervalMs: DAY },
      { itemId: 'seed_sunflower',  name: 'Семена подсолнуха',  price: 10,  category: 'seed', stock: 10, restockIntervalMs: DAY },
      { itemId: 'bouquet_mixed',   name: 'Смешанный букет',    price: 50,  category: 'gift', stock: 3,  restockIntervalMs: DAY },
    ],
  },
};
```

### 2.6 Экономический баланс

#### Доход игрока по дням

| День | Действия | Примерный доход | Примерные траты | Баланс |
|------|---------|----------------|-----------------|--------|
| 0 | Старт, 100 монет, бесплатные семена | 0 | 0 | 100 |
| 0.5 | Собрал 3 редиса | +45 | 0 | 145 |
| 1 | Купил семена картофеля и клубники | 0 | -40 | 105 |
| 2 | Картофель (4 шт) | +100 | -20 (семена) | 185 |
| 3 | Клубника (5 шт) Марко x1.2 | +240 | -30 (семена) | 395 |
| 7 | Стабильный цикл | ~100/день | ~30/день | ~500-600 |
| 14 | Можно купить расширение (500) | | | ~800 |

#### Ключевые milestone

| Milestone | Примерный день | Стоимость | Что разблокирует |
|-----------|---------------|-----------|-----------------|
| Первый инструмент Lv2 | 4-5 | 300 | Быстрее полив/сбор |
| Расширение фермы Lv2 | 10-14 | 500 | 16 грядок |
| Все инструменты Lv2 | 14-18 | 900 | Эффективность |
| Расширение фермы Lv3 | 21-28 | 1500 | 25 грядок |
| Первый инструмент Lv3 | 28-35 | 1200 | Зона 3x3 |

---

## 3. Система осведомленности NPC о действиях игрока

### 3.1 Архитектура Event Bus

Это ядро уникальности Nookstead: NPC не просто отвечают на вопросы -- они **замечают** действия игрока и **реагируют**. Технически это event-driven пайплайн: действия игрока создают события, события маршрутизируются к NPC-наблюдателям, и шаблонные описания записываются в память NPC.

```typescript
// apps/server/src/systems/awareness/PlayerActionEvent.ts

/**
 * Все типы событий, которые NPC могут наблюдать.
 * Каждое событие содержит данные для формирования записи в памяти.
 */
export type PlayerActionEvent =
  | {
      type: 'crop_planted';
      playerId: string;
      playerName: string;
      cropType: string;
      plotX: number;
      plotY: number;
    }
  | {
      type: 'crop_harvested';
      playerId: string;
      playerName: string;
      cropType: string;
      quantity: number;
      isGolden: boolean;
    }
  | {
      type: 'item_sold';
      playerId: string;
      playerName: string;
      itemId: string;
      quantity: number;
      toNpcId: string;
      totalPrice: number;
    }
  | {
      type: 'npc_visited';
      playerId: string;
      playerName: string;
      npcId: string;
      visitCount: number;      // Общее количество визитов
    }
  | {
      type: 'player_absent';
      playerId: string;
      playerName: string;
      daysMissed: number;
    }
  | {
      type: 'homestead_changed';
      playerId: string;
      playerName: string;
      changeType: 'flowers' | 'expansion' | 'decoration' | 'building';
      detail: string;          // Например: "sunflower" или "level_3"
    }
  | {
      type: 'gift_given';
      playerId: string;
      playerName: string;
      npcId: string;
      itemId: string;
      itemName: string;
    }
  | {
      type: 'quest_completed';
      playerId: string;
      playerName: string;
      questId: string;
      npcId: string;
      questTitle: string;
    }
  | {
      type: 'player_helped_player';
      playerId: string;
      playerName: string;
      helpedPlayerId: string;
      helpedPlayerName: string;
      action: string;
    }
  | {
      type: 'repeat_sell_pattern';
      playerId: string;
      playerName: string;
      itemId: string;
      consecutiveDays: number;
    }
  | {
      type: 'first_crop';
      playerId: string;
      playerName: string;
      cropType: string;
    }
  | {
      type: 'player_returned';
      playerId: string;
      playerName: string;
      daysAway: number;
    };
```

### 3.2 Пайплайн: событие -> память NPC

Ключевой принцип: **90%+ наблюдений стоят $0 LLM**. Механизм:

1. Действие игрока создаёт **событие** (PlayerActionEvent)
2. `ActionAwarenessService` маршрутизирует событие к NPC-наблюдателям
3. Шаблонный генератор формирует **текстовое описание** на русском
4. Описание записывается в `memories` таблицу соответствующего NPC
5. При следующем диалоге `MemoryRetrieval` подтянет запись, и LLM сам решит, упомянуть её или нет

```typescript
// apps/server/src/systems/awareness/ActionAwarenessService.ts

import { PlayerActionEvent } from './PlayerActionEvent';
import { MemoryStream } from '../../npc-service/memory/MemoryStream';

/**
 * Маршрутизирует действия игрока к соответствующим NPC-наблюдателям.
 * Инжектит шаблонные записи в память -- без LLM-вызовов.
 */
export class ActionAwarenessService {
  private memoryStream: MemoryStream;
  private observerMap: Map<PlayerActionEvent['type'], NpcObserverConfig[]>;

  constructor(memoryStream: MemoryStream) {
    this.memoryStream = memoryStream;
    this.observerMap = this.buildObserverMap();
  }

  /**
   * Обрабатывает событие.
   * Для каждого NPC-наблюдателя генерирует описание по шаблону
   * и записывает в его поток памяти.
   */
  async processEvent(event: PlayerActionEvent): Promise<void> {
    const observers = this.observerMap.get(event.type) ?? [];

    for (const observer of observers) {
      // Проверяем условие наблюдения (threshold, фильтры)
      if (!observer.condition(event)) continue;

      const description = this.generateDescription(event, observer);
      const importance = observer.importance;

      await this.memoryStream.record({
        agentId: observer.npcId,
        serverId: 'current',
        gameTimestamp: this.getCurrentGameTimestamp(),
        description,
        memoryType: 'observation',
        relatedEntities: [event.playerId],
        importanceOverride: importance,    // Без вызова Haiku -- фиксированный балл
      });
    }
  }

  /**
   * Генерирует описание по шаблону. НЕ вызывает LLM.
   * Шаблоны на русском, чтобы LLM воспринимал их как
   * естественные воспоминания NPC.
   */
  private generateDescription(
    event: PlayerActionEvent,
    observer: NpcObserverConfig,
  ): string {
    return observer.template(event);
  }

  private getCurrentGameTimestamp(): string {
    // Делегируем к GameTimeService
    return ''; // Заполняется при интеграции
  }

  /**
   * Карта: тип события -> список NPC-наблюдателей.
   * Определяет, кто что видит.
   */
  private buildObserverMap(): Map<PlayerActionEvent['type'], NpcObserverConfig[]> {
    const map = new Map<PlayerActionEvent['type'], NpcObserverConfig[]>();

    // --- ПОСАДКА КУЛЬТУРЫ ---
    map.set('crop_planted', [
      {
        npcId: 'lena',
        importance: 4,
        condition: () => true,
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'crop_planted' }>;
          return `Видела, что ${ev.playerName} посадил(а) ${getCropNameRu(ev.cropType)} на своём участке.`;
        },
      },
      {
        npcId: 'marko',
        importance: 4,
        condition: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'crop_planted' }>;
          return ['strawberry', 'potato'].includes(ev.cropType);
        },
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'crop_planted' }>;
          return `Слышал, что ${ev.playerName} посадил(а) ${getCropNameRu(ev.cropType)}. Можно будет использовать в выпечке!`;
        },
      },
      {
        npcId: 'stepan',
        importance: 3,
        condition: () => true,
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'crop_planted' }>;
          return `${ev.playerName} посадил(а) ${getCropNameRu(ev.cropType)}. Хорошо, что молодёжь занимается землёй.`;
        },
      },
    ]);

    // --- СБОР УРОЖАЯ ---
    map.set('crop_harvested', [
      {
        npcId: 'lena',
        importance: 3,
        condition: () => true,
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'crop_harvested' }>;
          const golden = ev.isGolden ? ' Говорят, качество отменное!' : '';
          return `${ev.playerName} собрал(а) урожай ${getCropNameRu(ev.cropType)} (${ev.quantity} шт.).${golden}`;
        },
      },
      {
        npcId: 'merchant',
        importance: 2,
        condition: () => true,
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'crop_harvested' }>;
          return `${ev.playerName} собрал(а) ${ev.quantity} ${getCropNameRu(ev.cropType)}. Наверное, принесёт на рынок.`;
        },
      },
    ]);

    // --- ПРОДАЖА ПРЕДМЕТА ---
    map.set('item_sold', [
      {
        npcId: 'ira',
        importance: 2,
        condition: () => true,
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'item_sold' }>;
          return `${ev.playerName} продал(а) ${ev.quantity} ${getItemNameRu(ev.itemId)} на рынке за ${ev.totalPrice} монет.`;
        },
      },
    ]);

    // --- ЧАСТЫЕ ВИЗИТЫ К NPC ---
    map.set('npc_visited', [
      {
        npcId: '__self__',     // Подставляется npcId из события
        importance: 5,
        condition: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'npc_visited' }>;
          return ev.visitCount >= 5 && ev.visitCount % 5 === 0;
        },
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'npc_visited' }>;
          return `${ev.playerName} заходит ко мне уже ${ev.visitCount}-й раз. Это приятно -- значит, ему здесь нравится.`;
        },
      },
    ]);

    // --- ОТСУТСТВИЕ ИГРОКА ---
    map.set('player_absent', [
      {
        npcId: 'marko',
        importance: 6,
        condition: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'player_absent' }>;
          return ev.daysMissed >= 3;
        },
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'player_absent' }>;
          return `${ev.playerName} не появлялся ${ev.daysMissed} дней. Надеюсь, с ним всё хорошо. Надо спросить при встрече.`;
        },
      },
      {
        npcId: 'lena',
        importance: 6,
        condition: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'player_absent' }>;
          return ev.daysMissed >= 3;
        },
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'player_absent' }>;
          return `Давно не видела ${ev.playerName}. Грядки, наверное, подсохли... Волнуюсь немного.`;
        },
      },
    ]);

    // --- ПОДАРОК NPC ---
    map.set('gift_given', [
      {
        npcId: '__recipient__',
        importance: 7,
        condition: () => true,
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'gift_given' }>;
          return `${ev.playerName} подарил(а) мне ${ev.itemName}. Очень приятно! Нужно запомнить это.`;
        },
      },
      {
        npcId: 'ira',          // Ира узнаёт обо всём (gossip)
        importance: 5,
        condition: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'gift_given' }>;
          return ev.npcId !== 'ira'; // Не дублировать, если подарили самой Ире
        },
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'gift_given' }>;
          return `Слышала, что ${ev.playerName} подарил(а) ${ev.itemName} ${getNpcNameRu(ev.npcId)}. Это мило!`;
        },
      },
    ]);

    // --- ВЫПОЛНЕН КВЕСТ ---
    map.set('quest_completed', [
      {
        npcId: '__quest_npc__',
        importance: 6,
        condition: () => true,
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'quest_completed' }>;
          return `${ev.playerName} помог(ла) мне с "${ev.questTitle}". Я очень благодарен(на).`;
        },
      },
      {
        npcId: 'viktor',
        importance: 5,
        condition: () => true,
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'quest_completed' }>;
          return `${ev.playerName} помог(ла) ${getNpcNameRu(ev.npcId)} с заданием. Активный житель -- это хорошо для города.`;
        },
      },
    ]);

    // --- ИЗМЕНЕНИЕ УЧАСТКА ---
    map.set('homestead_changed', [
      {
        npcId: 'lena',
        importance: 4,
        condition: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'homestead_changed' }>;
          return ['flowers', 'decoration'].includes(ev.changeType);
        },
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'homestead_changed' }>;
          if (ev.changeType === 'flowers') {
            return `Заметила, что ${ev.playerName} посадил(а) цветы на участке. Как красиво!`;
          }
          return `${ev.playerName} украсил(а) свой участок новым декором. Приятно видеть заботу о доме.`;
        },
      },
      {
        npcId: 'viktor',
        importance: 5,
        condition: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'homestead_changed' }>;
          return ev.changeType === 'expansion';
        },
        template: (e) => {
          const ev = e as Extract<PlayerActionEvent, { type: 'homestead_changed' }>;
          return `${ev.playerName} расширил(а) свой участок. Город растёт -- это хорошо!`;
        },
      },
    ]);

    return map;
  }
}

interface NpcObserverConfig {
  npcId: string;               // ID NPC-наблюдателя
  importance: number;          // Фиксированный балл важности (1-10)
  condition: (event: PlayerActionEvent) => boolean;
  template: (event: PlayerActionEvent) => string;
}

// --- Вспомогательные функции ---

function getCropNameRu(cropType: string): string {
  const names: Record<string, string> = {
    radish: 'редис', potato: 'картофель', strawberry: 'клубнику',
    tomato: 'помидоры', pumpkin: 'тыкву',
  };
  return names[cropType] ?? cropType;
}

function getItemNameRu(itemId: string): string {
  // Расширяется с каталогом предметов
  return getCropNameRu(itemId.replace('_golden', ''));
}

function getNpcNameRu(npcId: string): string {
  const names: Record<string, string> = {
    marko: 'Марко', lena: 'Лена', ira: 'Ира', oleg: 'Олег',
    anna: 'Анна', sara: 'Сара', viktor: 'Виктор', stepan: 'Степан',
    zoya: 'Зоя', egor: 'Егор',
  };
  return names[npcId] ?? npcId;
}
```

### 3.3 Таблица маршрутизации наблюдений

| Тип события | Основной наблюдатель | Дополнительные наблюдатели | Важность | Стоимость LLM |
|-------------|---------------------|--------------------------|----------|---------------|
| `crop_planted` | Лена (садовник) | Марко (если еда), Степан | 4 | $0 (inject) |
| `crop_harvested` | Лена, торговец | Любой NPC рядом | 3 | $0 (inject) |
| `item_sold` | Торговец | Ира (gossip) | 2 | $0 (inject) |
| `npc_visited` (5+ раз) | Сам NPC | -- | 5 | $0 (inject) |
| `player_absent` (3+ дней) | Все дружественные NPC | -- | 6 | $0 (inject) |
| `gift_given` | NPC-получатель | Ира (gossip) | 7 | $0 (inject) |
| `quest_completed` | NPC-заказчик | Виктор | 6 | $0 (inject) |
| `homestead_changed` (цветы) | Лена | -- | 4 | $0 (inject) |
| `homestead_changed` (расширение) | Виктор | Лена | 5 | $0 (inject) |
| `repeat_sell_pattern` | Торговец | Ира | 3 | $0 (inject) |
| `first_crop` | Степан | -- | 4 | $0 (inject) |

### 3.4 Система сплетен (Gossip Propagation)

Когда NPC A узнаёт что-то интересное об игроке, он может рассказать это NPC B во время NPC-NPC разговора.

```typescript
// apps/server/src/systems/awareness/GossipService.ts

import { MemoryStream } from '../../npc-service/memory/MemoryStream';

interface SocialConnection {
  npcId: string;
  strength: number;            // 0.0 - 1.0 (сила связи)
}

/**
 * Распространяет информацию между NPC через сплетни.
 * Вызывается после спонтанных NPC-NPC разговоров.
 */
export class GossipService {
  private memoryStream: MemoryStream;

  /** Социальный граф NPC */
  private socialGraph: Map<string, SocialConnection[]> = new Map([
    ['marko', [
      { npcId: 'ira',    strength: 0.9 },   // Лучший друг
      { npcId: 'lena',   strength: 0.5 },   // Тёплая знакомая
      { npcId: 'oleg',   strength: 0.3 },   // Уважение
    ]],
    ['ira', [
      { npcId: 'marko',  strength: 0.9 },
      { npcId: 'sara',   strength: 0.7 },
      { npcId: 'viktor', strength: 0.8 },   // Неофициальный информатор
      { npcId: 'lena',   strength: 0.6 },
    ]],
    ['lena', [
      { npcId: 'anna',   strength: 0.7 },   // Тихая дружба
      { npcId: 'sara',   strength: 0.5 },
      { npcId: 'ira',    strength: 0.6 },
    ]],
    ['oleg', [
      { npcId: 'anna',   strength: 0.7 },
      { npcId: 'viktor', strength: 0.6 },   // Старая дружба
    ]],
    ['anna', [
      { npcId: 'oleg',   strength: 0.7 },
      { npcId: 'lena',   strength: 0.7 },
      { npcId: 'zoya',   strength: 0.4 },   // Любопытство
    ]],
    ['viktor', [
      { npcId: 'ira',    strength: 0.8 },
      { npcId: 'oleg',   strength: 0.6 },
    ]],
  ]);

  constructor(memoryStream: MemoryStream) {
    this.memoryStream = memoryStream;
  }

  /**
   * Пробует распространить важную информацию.
   * Вызывается после того, как NPC получил новое наблюдение с importance >= 5.
   */
  async propagateGossip(
    sourceNpcId: string,
    memory: { description: string; importance: number; relatedEntities: string[] },
  ): Promise<void> {
    // Не распространяем малозначимые события
    if (memory.importance < 5) return;

    const connections = this.socialGraph.get(sourceNpcId) ?? [];

    // Выбираем 1-2 связи для передачи
    const targets = connections
      .filter((c) => Math.random() < c.strength * 0.6) // Вероятность пропорциональна силе связи
      .slice(0, 2);

    for (const target of targets) {
      const gossipDescription =
        `${getNpcNameRu(sourceNpcId)} рассказал(а) мне: "${memory.description}"`;

      await this.memoryStream.record({
        agentId: target.npcId,
        serverId: 'current',
        gameTimestamp: this.getCurrentGameTimestamp(),
        description: gossipDescription,
        memoryType: 'observation',
        relatedEntities: memory.relatedEntities,
        importanceOverride: Math.max(memory.importance - 2, 1), // Снижаем важность при передаче
      });
    }
  }

  private getCurrentGameTimestamp(): string {
    return '';
  }
}

function getNpcNameRu(npcId: string): string {
  const names: Record<string, string> = {
    marko: 'Марко', lena: 'Лена', ira: 'Ира', oleg: 'Олег',
    anna: 'Анна', sara: 'Сара', viktor: 'Виктор', stepan: 'Степан',
    zoya: 'Зоя', egor: 'Егор',
  };
  return names[npcId] ?? npcId;
}
```

#### Правила распространения сплетен

| Путь | Вероятность передачи | Снижение важности | Пример |
|------|---------------------|-------------------|--------|
| Свидетель -> Первый круг | 60% (при сильной связи) | -2 балла | "Марко рассказал, что CoolFarmer принёс клубнику" |
| Первый круг -> Второй круг | 30% | -2 балла | "Ира говорила, что CoolFarmer дружит с Марко" |
| Второй круг -> Третий | 10% | -3 балла | "Говорят, CoolFarmer -- хороший человек" |

---

## 4. Система инвентаря

### 4.1 Colyseus-схема инвентаря

```typescript
// libs/shared/src/schemas/InventoryState.ts
import { Schema, ArraySchema, type } from '@colyseus/schema';

export class InventorySlot extends Schema {
  /** ID предмета (пустая строка = пустой слот) */
  @type('string') itemId: string = '';

  /** Количество предметов в стаке */
  @type('uint16') quantity: number = 0;
}

/**
 * Инвентарь игрока.
 * НЕ синхронизируется другим игрокам -- приватные данные.
 * Colyseus фильтрует по ownerSessionId.
 */
export class InventoryState extends Schema {
  @type([InventorySlot]) slots = new ArraySchema<InventorySlot>();

  /** Максимальное количество слотов */
  @type('uint8') maxSlots: number = 20;

  /** Баланс монет */
  @type('uint32') coins: number = 100;
}
```

### 4.2 Определение предметов

```typescript
// libs/shared/src/config/items.ts

export interface ItemDefinition {
  id: string;
  name: string;
  nameRu: string;
  category: 'crop' | 'seed' | 'tool' | 'gift' | 'material' | 'special';
  /** Можно ли складывать в стак */
  stackable: boolean;
  /** Максимальный размер стака */
  maxStack: number;
  /** Ключ спрайта для отображения в инвентаре */
  spriteKey: string;
  description: string;
  /** Базовая цена продажи (0 = нельзя продать) */
  sellPrice: number;
  /**
   * Предпочтения NPC при получении в подарок.
   * Ключ -- npcId, значение -- множитель реакции (0.5 = не нравится, 1.0 = нейтрально, 2.0 = любит).
   */
  giftValue: Record<string, number>;
}

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  // ==========================================
  // СЕМЕНА (5 типов)
  // ==========================================
  seed_radish: {
    id: 'seed_radish',
    name: 'Radish Seeds',
    nameRu: 'Семена редиса',
    category: 'seed',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_seed_radish',
    description: 'Быстрорастущие семена. Урожай через 12 часов.',
    sellPrice: 2,
    giftValue: { lena: 1.2, stepan: 1.5 },
  },
  seed_potato: {
    id: 'seed_potato',
    name: 'Potato Seeds',
    nameRu: 'Семена картофеля',
    category: 'seed',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_seed_potato',
    description: 'Надёжная культура. Урожай через 2 дня.',
    sellPrice: 3,
    giftValue: { stepan: 1.3 },
  },
  seed_strawberry: {
    id: 'seed_strawberry',
    name: 'Strawberry Seeds',
    nameRu: 'Семена клубники',
    category: 'seed',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_seed_strawberry',
    description: 'Сладкие ягоды. Требуют двойного полива. Урожай через 3 дня.',
    sellPrice: 5,
    giftValue: { marko: 1.5, lena: 1.3 },
  },
  seed_tomato: {
    id: 'seed_tomato',
    name: 'Tomato Seeds',
    nameRu: 'Семена помидоров',
    category: 'seed',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_seed_tomato',
    description: 'Летняя классика. Урожай через 4 дня.',
    sellPrice: 4,
    giftValue: { ira: 1.3 },
  },
  seed_pumpkin: {
    id: 'seed_pumpkin',
    name: 'Pumpkin Seeds',
    nameRu: 'Семена тыквы',
    category: 'seed',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_seed_pumpkin',
    description: 'Терпеливый фермер будет вознаграждён. Урожай через 6 дней.',
    sellPrice: 6,
    giftValue: { lena: 1.5, oleg: 1.3 },
  },

  // ==========================================
  // УРОЖАЙ (5 типов + 5 золотых)
  // ==========================================
  radish: {
    id: 'radish',
    name: 'Radish',
    nameRu: 'Редис',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_radish',
    description: 'Свежий хрустящий редис.',
    sellPrice: 15,
    giftValue: { ira: 1.3, stepan: 1.2 },
  },
  radish_golden: {
    id: 'radish_golden',
    name: 'Golden Radish',
    nameRu: 'Золотой редис',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_radish_golden',
    description: 'Идеальный экземпляр! Сияет на солнце.',
    sellPrice: 45,
    giftValue: { ira: 2.0, stepan: 2.0, sara: 2.0 },
  },
  potato: {
    id: 'potato',
    name: 'Potato',
    nameRu: 'Картофель',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_potato',
    description: 'Основа кухни Quiet Haven.',
    sellPrice: 25,
    giftValue: { marko: 1.5, ira: 1.5 },
  },
  potato_golden: {
    id: 'potato_golden',
    name: 'Golden Potato',
    nameRu: 'Золотой картофель',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_potato_golden',
    description: 'Картофелина мечты.',
    sellPrice: 75,
    giftValue: { marko: 2.0, ira: 2.0 },
  },
  strawberry: {
    id: 'strawberry',
    name: 'Strawberry',
    nameRu: 'Клубника',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_strawberry',
    description: 'Сочная клубника. Марко мечтает о пироге!',
    sellPrice: 40,
    giftValue: { marko: 2.0, lena: 1.8, sara: 1.5 },
  },
  strawberry_golden: {
    id: 'strawberry_golden',
    name: 'Golden Strawberry',
    nameRu: 'Золотая клубника',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_strawberry_golden',
    description: 'Идеальная ягода. Сара будет в восторге.',
    sellPrice: 120,
    giftValue: { marko: 2.5, sara: 3.0, lena: 2.0 },
  },
  tomato: {
    id: 'tomato',
    name: 'Tomato',
    nameRu: 'Помидоры',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_tomato',
    description: 'Летний помидор с собственной грядки.',
    sellPrice: 35,
    giftValue: { ira: 1.5 },
  },
  tomato_golden: {
    id: 'tomato_golden',
    name: 'Golden Tomato',
    nameRu: 'Золотые помидоры',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_tomato_golden',
    description: 'Помидоры идеальной формы и цвета.',
    sellPrice: 105,
    giftValue: { ira: 2.5 },
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Pumpkin',
    nameRu: 'Тыква',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_pumpkin',
    description: 'Огромная оранжевая тыква.',
    sellPrice: 60,
    giftValue: { lena: 1.8, oleg: 1.5 },
  },
  pumpkin_golden: {
    id: 'pumpkin_golden',
    name: 'Golden Pumpkin',
    nameRu: 'Золотая тыква',
    category: 'crop',
    stackable: true,
    maxStack: 99,
    spriteKey: 'item_pumpkin_golden',
    description: 'Легендарная тыква. Олег скажет: "Кто ждёт -- тот получает."',
    sellPrice: 180,
    giftValue: { lena: 2.5, oleg: 2.5, viktor: 2.0 },
  },

  // ==========================================
  // ПОДАРКИ (5 типов)
  // ==========================================
  bouquet_mixed: {
    id: 'bouquet_mixed',
    name: 'Mixed Bouquet',
    nameRu: 'Смешанный букет',
    category: 'gift',
    stackable: false,
    maxStack: 1,
    spriteKey: 'item_bouquet',
    description: 'Букет из полевых цветов.',
    sellPrice: 25,
    giftValue: { lena: 2.0, anna: 1.8, sara: 1.5, ira: 1.5, marko: 1.0, oleg: 0.8 },
  },
  bread_rosemary: {
    id: 'bread_rosemary',
    name: 'Rosemary Bread',
    nameRu: 'Хлеб с розмарином',
    category: 'gift',
    stackable: true,
    maxStack: 10,
    spriteKey: 'item_bread',
    description: 'Фирменный хлеб Марко. Ароматный и тёплый.',
    sellPrice: 30,
    giftValue: { anna: 2.0, oleg: 1.5, ira: 1.5, marko: 0.5 },
  },
  chocolate_eclair: {
    id: 'chocolate_eclair',
    name: 'Chocolate Eclair',
    nameRu: 'Шоколадный эклер',
    category: 'gift',
    stackable: true,
    maxStack: 10,
    spriteKey: 'item_eclair',
    description: 'Творение Сары. Идеальный десерт.',
    sellPrice: 35,
    giftValue: { marko: 1.5, anna: 1.5, ira: 1.8, sara: 0.5 },
  },
  fishing_bait: {
    id: 'fishing_bait',
    name: 'Premium Bait',
    nameRu: 'Отборная наживка',
    category: 'gift',
    stackable: true,
    maxStack: 20,
    spriteKey: 'item_bait',
    description: 'Олег оценит.',
    sellPrice: 10,
    giftValue: { oleg: 2.5, marko: 0.5 },
  },
  rare_book: {
    id: 'rare_book',
    name: 'Rare Book',
    nameRu: 'Редкая книга',
    category: 'gift',
    stackable: false,
    maxStack: 1,
    spriteKey: 'item_rare_book',
    description: 'Найдена в лесу. Анна будет в восторге.',
    sellPrice: 50,
    giftValue: { anna: 3.0, zoya: 2.0, oleg: 1.5 },
  },

  // ==========================================
  // МАТЕРИАЛЫ (разное)
  // ==========================================
  fertilizer: {
    id: 'fertilizer',
    name: 'Fertilizer',
    nameRu: 'Удобрение',
    category: 'material',
    stackable: true,
    maxStack: 20,
    spriteKey: 'item_fertilizer',
    description: 'Ускоряет рост на 15%. Одноразовое.',
    sellPrice: 10,
    giftValue: { stepan: 1.5, lena: 1.3 },
  },
  wild_herb: {
    id: 'wild_herb',
    name: 'Wild Herb',
    nameRu: 'Дикие травы',
    category: 'material',
    stackable: true,
    maxStack: 50,
    spriteKey: 'item_herb',
    description: 'Собраны в лесу. Зоя что-то варит из них.',
    sellPrice: 5,
    giftValue: { zoya: 2.0, lena: 1.3 },
  },
  wood: {
    id: 'wood',
    name: 'Wood',
    nameRu: 'Дерево',
    category: 'material',
    stackable: true,
    maxStack: 50,
    spriteKey: 'item_wood',
    description: 'Крепкое дерево для строительства.',
    sellPrice: 8,
    giftValue: { egor: 1.5 },
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    nameRu: 'Камень',
    category: 'material',
    stackable: true,
    maxStack: 50,
    spriteKey: 'item_stone',
    description: 'Обычный камень. Пригодится.',
    sellPrice: 5,
    giftValue: { egor: 1.3 },
  },

  // ==========================================
  // ОСОБЫЕ ПРЕДМЕТЫ
  // ==========================================
  town_key: {
    id: 'town_key',
    name: 'Town Key',
    nameRu: 'Ключ от города',
    category: 'special',
    stackable: false,
    maxStack: 1,
    spriteKey: 'item_town_key',
    description: 'Символический ключ от Quiet Haven. Подарок мэра.',
    sellPrice: 0,
    giftValue: {},
  },
  notebook_page: {
    id: 'notebook_page',
    name: 'Notebook Page',
    nameRu: 'Страница из блокнота',
    category: 'special',
    stackable: false,
    maxStack: 1,
    spriteKey: 'item_notebook_page',
    description: 'Странные записи... Формулы и чертежи. Чей это почерк?',
    sellPrice: 0,
    giftValue: { zoya: 3.0, anna: 2.0 },
  },
};
```

### 4.3 Серверная логика инвентаря

```typescript
// apps/server/src/systems/inventory/InventoryManager.ts

import { InventoryState, InventorySlot } from '@nookstead/shared/schemas';
import { ITEM_DEFINITIONS } from '@nookstead/shared/config/items';

export class InventoryManager {
  /**
   * Добавляет предмет в инвентарь.
   * Возвращает количество, которое НЕ удалось добавить (0 = всё добавлено).
   */
  addItem(inventory: InventoryState, itemId: string, quantity: number): number {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return quantity;

    const maxStack = def.stackable ? def.maxStack : 1;
    let remaining = quantity;

    // Фаза 1: дополнить существующие стаки
    if (def.stackable) {
      for (const slot of inventory.slots) {
        if (remaining <= 0) break;
        if (slot.itemId === itemId && slot.quantity < maxStack) {
          const canAdd = Math.min(remaining, maxStack - slot.quantity);
          slot.quantity += canAdd;
          remaining -= canAdd;
        }
      }
    }

    // Фаза 2: занять пустые слоты
    for (const slot of inventory.slots) {
      if (remaining <= 0) break;
      if (slot.itemId === '') {
        const canAdd = Math.min(remaining, maxStack);
        slot.itemId = itemId;
        slot.quantity = canAdd;
        remaining -= canAdd;
      }
    }

    return remaining;
  }

  /**
   * Удаляет предмет из инвентаря.
   * Возвращает количество, которое реально удалили.
   */
  removeItem(inventory: InventoryState, itemId: string, quantity: number): number {
    let removed = 0;

    for (const slot of inventory.slots) {
      if (removed >= quantity) break;
      if (slot.itemId === itemId) {
        const canRemove = Math.min(quantity - removed, slot.quantity);
        slot.quantity -= canRemove;
        removed += canRemove;
        if (slot.quantity <= 0) {
          slot.itemId = '';
          slot.quantity = 0;
        }
      }
    }

    return removed;
  }

  /**
   * Проверяет, есть ли нужное количество предмета.
   */
  hasItem(inventory: InventoryState, itemId: string, quantity: number): boolean {
    let total = 0;
    for (const slot of inventory.slots) {
      if (slot.itemId === itemId) {
        total += slot.quantity;
        if (total >= quantity) return true;
      }
    }
    return false;
  }

  /**
   * Считает общее количество предмета.
   */
  countItem(inventory: InventoryState, itemId: string): number {
    let total = 0;
    for (const slot of inventory.slots) {
      if (slot.itemId === itemId) total += slot.quantity;
    }
    return total;
  }

  /**
   * Количество свободных слотов.
   */
  freeSlots(inventory: InventoryState): number {
    let free = 0;
    for (const slot of inventory.slots) {
      if (slot.itemId === '') free++;
    }
    return free;
  }
}
```

---

## 5. Система отношений

### 5.1 Философия

В Nookstead **нет числовых шкал дружбы**, видимых игроку. Нет "полоски отношений +5". Вместо этого уровень отношений выводится из анализа памяти NPC -- из того, сколько раз игрок приходил, что дарил, о чём говорили. Для игрока это выглядит органично: NPC просто ведёт себя теплее, делится большим, предлагает помощь.

Для сервера мы используем структурированный `RelationshipState`, который обновляется по событиям и определяет уровень отношений детерминированно (без LLM).

### 5.2 Серверная модель отношений

```typescript
// libs/shared/src/types/relationship.ts

export type RelationshipLevel =
  | 'stranger'
  | 'acquaintance'
  | 'casual_friend'
  | 'good_friend'
  | 'close_friend';

export interface RelationshipState {
  npcId: string;
  playerId: string;
  level: RelationshipLevel;

  // --- Счётчики взаимодействий ---
  totalConversations: number;
  giftsGiven: number;
  questsCompleted: number;
  daysSinceFirstMet: number;
  totalVisits: number;

  // --- Метаданные ---
  firstMetAt: Date;
  lastInteraction: Date;

  /**
   * Сентимент (-1.0 до 1.0).
   * Вычисляется из рефлексий NPC, не из числовой шкалы.
   * -1.0 = крайне негативное отношение
   *  0.0 = нейтральное
   *  1.0 = максимально позитивное
   */
  sentiment: number;
}
```

### 5.3 Правила перехода между уровнями

Переходы проверяются при каждом значимом взаимодействии (разговор, подарок, квест). Все условия должны выполняться одновременно (AND).

```typescript
// apps/server/src/systems/relationship/RelationshipCalculator.ts

import { RelationshipLevel, RelationshipState } from '@nookstead/shared/types/relationship';

interface LevelThreshold {
  level: RelationshipLevel;
  minConversations: number;
  minGifts: number;
  minQuests: number;
  minDaysKnown: number;
  minSentiment: number;
}

/**
 * Пороги перехода между уровнями.
 * Проверяются в порядке от высшего к низшему.
 */
const THRESHOLDS: LevelThreshold[] = [
  {
    level: 'close_friend',
    minConversations: 50,
    minGifts: 10,
    minQuests: 5,
    minDaysKnown: 30,
    minSentiment: 0.7,
  },
  {
    level: 'good_friend',
    minConversations: 20,
    minGifts: 3,
    minQuests: 2,
    minDaysKnown: 14,
    minSentiment: 0.4,
  },
  {
    level: 'casual_friend',
    minConversations: 8,
    minGifts: 1,             // 1 подарок ИЛИ 1 квест
    minQuests: 0,            // (обрабатывается отдельно, см. ниже)
    minDaysKnown: 5,
    minSentiment: 0.1,
  },
  {
    level: 'acquaintance',
    minConversations: 3,
    minGifts: 0,
    minQuests: 0,
    minDaysKnown: 0,
    minSentiment: -0.3,
  },
  {
    level: 'stranger',
    minConversations: 0,
    minGifts: 0,
    minQuests: 0,
    minDaysKnown: 0,
    minSentiment: -1.0,
  },
];

/**
 * Вычисляет уровень отношений на основе счётчиков.
 * Возвращает наивысший уровень, все условия которого выполнены.
 */
export function calculateRelationshipLevel(
  state: RelationshipState,
): RelationshipLevel {
  for (const threshold of THRESHOLDS) {
    const conversationsOk = state.totalConversations >= threshold.minConversations;
    const daysOk = state.daysSinceFirstMet >= threshold.minDaysKnown;
    const sentimentOk = state.sentiment >= threshold.minSentiment;

    // Для casual_friend: нужен 1 подарок ИЛИ 1 квест
    let socialOk: boolean;
    if (threshold.level === 'casual_friend') {
      socialOk = state.giftsGiven >= 1 || state.questsCompleted >= 1;
    } else {
      socialOk = state.giftsGiven >= threshold.minGifts
        && state.questsCompleted >= threshold.minQuests;
    }

    if (conversationsOk && socialOk && daysOk && sentimentOk) {
      return threshold.level;
    }
  }

  return 'stranger';
}

/**
 * Обновляет счётчик и пересчитывает уровень.
 * Вызывается при каждом значимом взаимодействии.
 */
export function updateRelationship(
  state: RelationshipState,
  event: RelationshipEvent,
): { levelChanged: boolean; oldLevel: RelationshipLevel; newLevel: RelationshipLevel } {
  const oldLevel = state.level;

  switch (event.type) {
    case 'conversation':
      state.totalConversations++;
      state.lastInteraction = new Date();
      break;
    case 'gift':
      state.giftsGiven++;
      state.lastInteraction = new Date();
      break;
    case 'quest':
      state.questsCompleted++;
      state.lastInteraction = new Date();
      break;
    case 'visit':
      state.totalVisits++;
      state.lastInteraction = new Date();
      break;
    case 'sentiment_update':
      state.sentiment = Math.max(-1, Math.min(1, event.newSentiment));
      break;
  }

  // Пересчитываем дни
  state.daysSinceFirstMet = Math.floor(
    (Date.now() - state.firstMetAt.getTime()) / 86_400_000,
  );

  const newLevel = calculateRelationshipLevel(state);
  state.level = newLevel;

  return { levelChanged: oldLevel !== newLevel, oldLevel, newLevel };
}

export type RelationshipEvent =
  | { type: 'conversation' }
  | { type: 'gift' }
  | { type: 'quest' }
  | { type: 'visit' }
  | { type: 'sentiment_update'; newSentiment: number };
```

### 5.4 Влияние уровня отношений на поведение NPC

Уровень отношений передаётся в промпт NPC при диалоге через модификаторы.

```typescript
// apps/server/src/systems/relationship/DialogueModifiers.ts

import { RelationshipLevel } from '@nookstead/shared/types/relationship';

export interface DialogueModifiers {
  /** Насколько тёплый тон (0.0 - 1.0) */
  warmth: number;
  /** Готовность делиться личным (0.0 - 1.0) */
  personalSharing: number;
  /** Обращается ли по имени */
  usePlayerName: boolean;
  /** Предлагает ли помощь */
  offerHelp: boolean;
  /** Доступна ли скидка в магазине */
  shopDiscount: number;
  /** Может ли NPC прийти на участок */
  canVisitHomestead: boolean;
  /** Может ли NPC приглашать к себе домой */
  canInviteHome: boolean;
  /** Доступны ли signature moments */
  signatureMomentsUnlocked: boolean;
}

export function getDialogueModifiers(level: RelationshipLevel): DialogueModifiers {
  switch (level) {
    case 'stranger':
      return {
        warmth: 0.3,
        personalSharing: 0.0,
        usePlayerName: false,
        offerHelp: false,
        shopDiscount: 0,
        canVisitHomestead: false,
        canInviteHome: false,
        signatureMomentsUnlocked: false,
      };
    case 'acquaintance':
      return {
        warmth: 0.5,
        personalSharing: 0.2,
        usePlayerName: true,
        offerHelp: false,
        shopDiscount: 0,
        canVisitHomestead: false,
        canInviteHome: false,
        signatureMomentsUnlocked: false,
      };
    case 'casual_friend':
      return {
        warmth: 0.7,
        personalSharing: 0.4,
        usePlayerName: true,
        offerHelp: true,
        shopDiscount: 0.05,         // 5% скидка
        canVisitHomestead: true,
        canInviteHome: false,
        signatureMomentsUnlocked: true,
      };
    case 'good_friend':
      return {
        warmth: 0.85,
        personalSharing: 0.7,
        usePlayerName: true,
        offerHelp: true,
        shopDiscount: 0.10,         // 10% скидка
        canVisitHomestead: true,
        canInviteHome: true,
        signatureMomentsUnlocked: true,
      };
    case 'close_friend':
      return {
        warmth: 1.0,
        personalSharing: 1.0,
        usePlayerName: true,
        offerHelp: true,
        shopDiscount: 0.15,         // 15% скидка
        canVisitHomestead: true,
        canInviteHome: true,
        signatureMomentsUnlocked: true,
      };
  }
}
```

### 5.5 Деградация отношений

Отношения могут ухудшиться, но **не ниже acquaintance** (однажды знакомый -- всегда знакомый). Причины деградации:

| Причина | Эффект на сентимент | Условие |
|---------|--------------------|-|
| Грубость (модерация NPC) | -0.15 за инцидент | NPC отклонил токсичный ввод |
| Длительное отсутствие | -0.02/день (после 7 дней) | Не заходил > 7 дней |
| Отказ от квеста (истёк) | -0.05 | Принял квест, не выполнил |
| Подарил нелюбимый предмет | -0.05 | giftValue < 0.5 |

```typescript
// apps/server/src/systems/relationship/SentimentDecay.ts

/**
 * Вызывается раз в день для каждой пары NPC-игрок.
 * Применяет decay к сентименту при длительном отсутствии.
 */
export function applySentimentDecay(
  state: RelationshipState,
  daysSinceLastInteraction: number,
): void {
  if (daysSinceLastInteraction <= 7) return;

  const decayPerDay = 0.02;
  const daysOverThreshold = daysSinceLastInteraction - 7;
  const totalDecay = daysOverThreshold * decayPerDay;

  state.sentiment = Math.max(-0.5, state.sentiment - totalDecay);

  // Никогда не опускаем ниже acquaintance
  if (state.level !== 'stranger') {
    const newLevel = calculateRelationshipLevel(state);
    if (newLevel === 'stranger') {
      state.sentiment = Math.max(state.sentiment, -0.3);
    }
  }
}
```

---

## 6. Органическая система квестов

### 6.1 Философия

Квесты в Nookstead не берутся из скриптовых таблиц. Они **возникают** из рефлексий NPC. Если Марко в своей ежедневной рефлексии подумал "крыша течёт", система может превратить это в квест для дружественного игрока. Это создаёт ощущение живого мира: NPC не "выдаёт квест" -- он просит о помощи, потому что ему действительно нужна помощь.

### 6.2 Генерация квестов из рефлексий

```typescript
// apps/server/src/systems/quests/OrganicQuestGenerator.ts

import { Reflection } from '../../npc-service/memory/ReflectionEngine';
import { RelationshipState, RelationshipLevel } from '@nookstead/shared/types/relationship';

export interface Quest {
  id: string;
  npcId: string;
  playerId: string;             // Целевой игрок (на основе отношений)
  template: QuestTemplate;
  title: string;                // Краткое название
  description: string;          // AI-сгенерированное описание от лица NPC
  objective: QuestObjective;
  reward: QuestReward;
  createdAt: Date;
  expiresAt: Date;              // Квесты истекают через 3 реальных дня
  status: 'offered' | 'accepted' | 'completed' | 'expired' | 'declined';
}

export type QuestTemplate =
  | 'bring_item'                // Принеси предмет
  | 'help_task'                 // Помоги с задачей (триггерится по месту)
  | 'deliver_message'           // Передай сообщение другому NPC
  | 'investigate'               // Найди/исследуй что-то
  | 'visit_tomorrow';           // Приходи завтра (самый простой)

export interface QuestObjective {
  type: 'bring_item' | 'visit_location' | 'talk_to_npc' | 'find_item' | 'visit_npc';
  targetItemId?: string;
  targetQuantity?: number;
  targetNpcId?: string;
  targetLocation?: { x: number; y: number };
  description: string;
}

export interface QuestReward {
  coins: number;
  items: { itemId: string; quantity: number }[];
  reputationBonus: number;
  /** Дополнительная награда: NPC поделится чем-то личным */
  narrativeReward: boolean;
}

const DAY = 86_400_000;

/**
 * Анализирует рефлексию NPC и (может быть) создаёт квест.
 * Вызывается ReflectionEngine после генерации ежедневных рефлексий.
 */
export class OrganicQuestGenerator {
  /** Вероятность генерации квеста из одной рефлексии */
  private readonly QUEST_CHANCE = 0.30;  // 30%

  /**
   * Пытается сгенерировать квест из рефлексии.
   * Возвращает null, если квест не был создан.
   */
  async maybeGenerateQuest(
    npcId: string,
    reflection: Reflection,
    relationships: RelationshipState[],
  ): Promise<Quest | null> {
    // Бросаем монетку
    if (Math.random() > this.QUEST_CHANCE) return null;

    // Находим подходящего игрока (минимум casual_friend)
    const eligiblePlayers = relationships
      .filter((r) => r.npcId === npcId)
      .filter((r) => this.isEligibleForQuest(r.level))
      .sort((a, b) => b.sentiment - a.sentiment); // Сначала самые близкие

    if (eligiblePlayers.length === 0) return null;

    const targetPlayer = eligiblePlayers[0];

    // Определяем шаблон квеста по ключевым словам в рефлексии
    const template = this.matchTemplate(reflection.text);
    if (!template) return null;

    // Генерируем конкретный квест
    const quest = this.buildQuest(npcId, targetPlayer.playerId, template, reflection);
    return quest;
  }

  private isEligibleForQuest(level: RelationshipLevel): boolean {
    return level === 'casual_friend'
      || level === 'good_friend'
      || level === 'close_friend';
  }

  /**
   * Определяет шаблон квеста на основе содержания рефлексии.
   * Использует простое сопоставление ключевых слов.
   */
  private matchTemplate(reflectionText: string): QuestTemplate | null {
    const text = reflectionText.toLowerCase();

    if (text.includes('нужн') && (text.includes('принес') || text.includes('ингредиент') || text.includes('предмет'))) {
      return 'bring_item';
    }
    if (text.includes('помо') && (text.includes('починить') || text.includes('сделать') || text.includes('задач'))) {
      return 'help_task';
    }
    if (text.includes('передать') || text.includes('сказать') || text.includes('сообщ')) {
      return 'deliver_message';
    }
    if (text.includes('найти') || text.includes('исследова') || text.includes('загадк')) {
      return 'investigate';
    }
    if (text.includes('приходи') || text.includes('завтра') || text.includes('навести')) {
      return 'visit_tomorrow';
    }

    return null; // Рефлексия не подходит для квеста
  }

  private buildQuest(
    npcId: string,
    playerId: string,
    template: QuestTemplate,
    reflection: Reflection,
  ): Quest {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * DAY);

    // Базовая структура -- конкретное содержание определяется шаблоном
    const questConfigs: Record<QuestTemplate, () => Partial<Quest>> = {
      bring_item: () => ({
        title: 'Принеси ингредиент',
        objective: {
          type: 'bring_item',
          targetItemId: this.pickRandomNeededItem(npcId),
          targetQuantity: this.pickRandomQuantity(3, 10),
          description: 'Принеси указанный предмет NPC.',
        },
        reward: { coins: 50, items: [], reputationBonus: 1, narrativeReward: false },
      }),
      help_task: () => ({
        title: 'Помоги с задачей',
        objective: {
          type: 'visit_npc',
          targetNpcId: npcId,
          description: 'Поговори с NPC, чтобы помочь.',
        },
        reward: { coins: 75, items: [], reputationBonus: 2, narrativeReward: true },
      }),
      deliver_message: () => ({
        title: 'Передай сообщение',
        objective: {
          type: 'talk_to_npc',
          targetNpcId: this.pickRandomOtherNpc(npcId),
          description: 'Передай сообщение другому NPC.',
        },
        reward: { coins: 30, items: [], reputationBonus: 1, narrativeReward: false },
      }),
      investigate: () => ({
        title: 'Расследование',
        objective: {
          type: 'find_item',
          targetItemId: 'wild_herb',
          targetQuantity: 5,
          description: 'Найди указанные предметы в лесу.',
        },
        reward: { coins: 100, items: [{ itemId: 'rare_book', quantity: 1 }], reputationBonus: 3, narrativeReward: true },
      }),
      visit_tomorrow: () => ({
        title: 'Приходи завтра',
        objective: {
          type: 'visit_npc',
          targetNpcId: npcId,
          description: 'Навести NPC завтра.',
        },
        reward: { coins: 20, items: [], reputationBonus: 1, narrativeReward: true },
      }),
    };

    const config = questConfigs[template]();

    return {
      id: crypto.randomUUID(),
      npcId,
      playerId,
      template,
      title: config.title ?? 'Задание',
      description: reflection.text, // AI-рефлексия как описание
      objective: config.objective as QuestObjective,
      reward: config.reward as QuestReward,
      createdAt: now,
      expiresAt,
      status: 'offered',
    };
  }

  private pickRandomNeededItem(npcId: string): string {
    const npcNeeds: Record<string, string[]> = {
      marko: ['strawberry', 'potato', 'wild_herb'],
      lena: ['seed_lavender', 'wild_herb'],
      ira: ['tomato', 'potato', 'strawberry'],
      sara: ['strawberry', 'strawberry_golden'],
      oleg: ['fishing_bait', 'wood'],
    };
    const items = npcNeeds[npcId] ?? ['wild_herb'];
    return items[Math.floor(Math.random() * items.length)];
  }

  private pickRandomOtherNpc(excludeNpcId: string): string {
    const allNpcs = ['marko', 'lena', 'ira', 'sara', 'oleg', 'anna', 'viktor', 'stepan'];
    const others = allNpcs.filter((id) => id !== excludeNpcId);
    return others[Math.floor(Math.random() * others.length)];
  }

  private pickRandomQuantity(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
}
```

### 6.3 Жизненный цикл квеста

```
  Рефлексия NPC
       |
       v
  OrganicQuestGenerator.maybeGenerateQuest() -- 30% шанс
       |
       v
  Quest (status: 'offered')
       |
       v
  NPC предлагает квест при следующем диалоге
       |
       +---> Игрок принимает -> 'accepted' -> Выполняет цель -> 'completed' -> Награда
       |
       +---> Игрок отклоняет -> 'declined' -> NPC спрашивает другого игрока
       |
       +---> 3 дня прошло -> 'expired' -> NPC сам справляется / просит другого NPC
```

### 6.4 PostgreSQL-таблица квестов

```sql
CREATE TABLE quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR(64) NOT NULL,
  npc_id VARCHAR(64) NOT NULL,
  player_id UUID NOT NULL,
  template VARCHAR(32) NOT NULL,
  title VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  objective JSONB NOT NULL,
  reward JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'offered',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,

  CONSTRAINT fk_quest_npc FOREIGN KEY (npc_id) REFERENCES npc_agents(id)
);

CREATE INDEX idx_quests_player ON quests(player_id, status);
CREATE INDEX idx_quests_npc ON quests(npc_id, status);
CREATE INDEX idx_quests_expires ON quests(expires_at) WHERE status IN ('offered', 'accepted');
```

---

## 7. Цикл дня/ночи и погода

### 7.1 Система игрового времени

Nookstead использует **реальное время** по умолчанию (1:1). Серверный администратор может настроить множитель скорости.

```typescript
// apps/server/src/systems/time/GameTimeService.ts

export interface GameTime {
  /** Текущий час (0-23) */
  hour: number;
  /** Текущая минута (0-59) */
  minute: number;
  /** День недели (0=Пн, 6=Вс) */
  dayOfWeek: number;
  /** Текущий сезон */
  season: Season;
  /** Номер дня с начала сервера */
  dayNumber: number;
  /** Период суток */
  period: 'dawn' | 'day' | 'dusk' | 'night';
  /** Множитель скорости */
  speedMultiplier: number;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Сервис игрового времени.
 * Вычисляет текущее игровое время на основе реального времени
 * и серверного множителя скорости.
 */
export class GameTimeService {
  /** Множитель скорости (1.0 = реальное время, 2.0 = 2x) */
  private speedMultiplier: number;

  /** Длительность одного сезона в реальных мс */
  private seasonDurationMs: number;

  /** Timestamp запуска сервера (точка отсчёта) */
  private serverStartTime: number;

  /** Длительность реального дня в мс */
  private static readonly REAL_DAY_MS = 86_400_000;

  constructor(config: {
    speedMultiplier?: number;
    seasonDurationDays?: number;
    serverStartTime?: number;
  } = {}) {
    this.speedMultiplier = config.speedMultiplier ?? 1.0;
    this.seasonDurationMs = (config.seasonDurationDays ?? 7) * GameTimeService.REAL_DAY_MS;
    this.serverStartTime = config.serverStartTime ?? Date.now();
  }

  getCurrentGameTime(): GameTime {
    const realNow = Date.now();
    const elapsedMs = (realNow - this.serverStartTime) * this.speedMultiplier;

    // Вычисляем игровое время суток
    const gameDayMs = GameTimeService.REAL_DAY_MS; // 24 часа в мс
    const timeInDay = elapsedMs % gameDayMs;
    const hour = Math.floor(timeInDay / 3_600_000) % 24;
    const minute = Math.floor((timeInDay % 3_600_000) / 60_000);

    // Номер дня
    const dayNumber = Math.floor(elapsedMs / gameDayMs);

    // День недели
    const dayOfWeek = dayNumber % 7;

    // Сезон (4 сезона по seasonDurationMs каждый)
    const yearMs = this.seasonDurationMs * 4;
    const timeInYear = elapsedMs % yearMs;
    const seasonIndex = Math.floor(timeInYear / this.seasonDurationMs);
    const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
    const season = seasons[seasonIndex];

    // Период суток
    const period = this.calculatePeriod(hour);

    return {
      hour,
      minute,
      dayOfWeek,
      season,
      dayNumber,
      period,
      speedMultiplier: this.speedMultiplier,
    };
  }

  private calculatePeriod(hour: number): GameTime['period'] {
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 7 && hour < 18) return 'day';
    if (hour >= 18 && hour < 20) return 'dusk';
    return 'night';
  }

  /**
   * Проверяет, наступил ли новый игровой день.
   * Используется для сброса полива, генерации планов и рефлексий.
   */
  isNewGameDay(previousDayNumber: number): boolean {
    return this.getCurrentGameTime().dayNumber > previousDayNumber;
  }

  /**
   * Проверяет, наступил ли новый сезон.
   */
  isNewSeason(previousSeason: Season): boolean {
    return this.getCurrentGameTime().season !== previousSeason;
  }
}
```

### 7.2 Освещение

Клиентская система. Применяет цветовой тинт к камере Phaser в зависимости от периода суток.

```typescript
// apps/game/src/lib/phaser/systems/LightingSystem.ts

/**
 * Параметры освещения по периодам суток.
 * Применяются как Camera.setBackgroundColor + тинт на overlay.
 */
export const LIGHTING_CONFIGS = {
  dawn: {
    startHour: 5,
    endHour: 7,
    tintColor: 0xffa040,        // Тёплый оранжевый
    tintAlpha: 0.25,            // Полупрозрачный
    ambientBrightness: 0.6,     // Постепенно нарастает
  },
  day: {
    startHour: 7,
    endHour: 18,
    tintColor: 0xffffff,        // Без тинта
    tintAlpha: 0.0,
    ambientBrightness: 1.0,
  },
  dusk: {
    startHour: 18,
    endHour: 20,
    tintColor: 0xff8020,        // Тёплый оранжевый
    tintAlpha: 0.3,
    ambientBrightness: 0.5,
  },
  night: {
    startHour: 20,
    endHour: 5,
    tintColor: 0x2020a0,        // Сине-фиолетовый
    tintAlpha: 0.45,
    ambientBrightness: 0.25,
  },
} as const;
```

Переход между периодами плавный: интерполяция `tintAlpha` и `ambientBrightness` в течение 1 игрового часа.

### 7.3 Система погоды

```typescript
// apps/server/src/systems/weather/WeatherService.ts

export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'thunderstorm' | 'snow';

export interface WeatherState {
  current: WeatherType;
  /** Timestamp начала текущей погоды */
  startedAt: number;
  /** Длительность в мс */
  durationMs: number;
  /** Следующая запланированная погода */
  nextWeather: WeatherType;
  nextChangeAt: number;
}

const HOUR = 3_600_000;

/**
 * Определяет погоду на основе сезона и случайности.
 * Погода меняется каждые 2-6 реальных часов.
 */
export class WeatherService {
  private state: WeatherState;

  /** Вероятности погоды по сезонам */
  private static readonly WEATHER_PROBABILITIES: Record<string, Record<WeatherType, number>> = {
    spring: { sunny: 0.40, cloudy: 0.25, rain: 0.30, thunderstorm: 0.05, snow: 0.00 },
    summer: { sunny: 0.50, cloudy: 0.20, rain: 0.15, thunderstorm: 0.15, snow: 0.00 },
    autumn: { sunny: 0.25, cloudy: 0.35, rain: 0.35, thunderstorm: 0.05, snow: 0.00 },
    winter: { sunny: 0.20, cloudy: 0.30, rain: 0.10, thunderstorm: 0.00, snow: 0.40 },
  };

  constructor() {
    this.state = this.generateInitialWeather('spring');
  }

  getCurrentWeather(): WeatherState {
    const now = Date.now();

    // Проверяем, пора ли менять погоду
    if (now >= this.state.nextChangeAt) {
      this.transitionWeather();
    }

    return this.state;
  }

  /** Дождь ли сейчас? (для бонуса роста культур) */
  isRaining(): boolean {
    return this.state.current === 'rain' || this.state.current === 'thunderstorm';
  }

  /** Снег ли сейчас? (для визуалов) */
  isSnowing(): boolean {
    return this.state.current === 'snow';
  }

  private transitionWeather(): void {
    this.state.current = this.state.nextWeather;
    this.state.startedAt = Date.now();
    this.state.durationMs = this.randomDuration();
    this.state.nextChangeAt = this.state.startedAt + this.state.durationMs;
    this.state.nextWeather = this.pickWeather(this.getCurrentSeason());
  }

  private pickWeather(season: string): WeatherType {
    const probs = WeatherService.WEATHER_PROBABILITIES[season]
      ?? WeatherService.WEATHER_PROBABILITIES['spring'];
    const roll = Math.random();
    let cumulative = 0;
    for (const [weather, prob] of Object.entries(probs)) {
      cumulative += prob;
      if (roll <= cumulative) return weather as WeatherType;
    }
    return 'sunny';
  }

  /** Случайная длительность: 2-6 часов */
  private randomDuration(): number {
    return (2 + Math.random() * 4) * HOUR;
  }

  private generateInitialWeather(season: string): WeatherState {
    const now = Date.now();
    const duration = this.randomDuration();
    return {
      current: this.pickWeather(season),
      startedAt: now,
      durationMs: duration,
      nextWeather: this.pickWeather(season),
      nextChangeAt: now + duration,
    };
  }

  private getCurrentSeason(): string {
    // Делегируем к GameTimeService при интеграции
    return 'spring';
  }
}
```

### 7.4 Влияние погоды на NPC

| Погода | Эффект на NPC |
|--------|--------------|
| Солнечно | Нормальное расписание |
| Облачно | Нормальное расписание |
| Дождь | NPC с `umbrella: false` уходят в помещения. Лена остаётся в парке. |
| Гроза | ВСЕ NPC уходят в помещения. Пересматривают дневной план. |
| Снег | NPC двигаются на 20% медленнее. Зимние диалоги. |

### 7.5 Влияние погоды на фермерство

| Погода | Эффект |
|--------|--------|
| Дождь | Автополив + бонус роста 25% |
| Гроза | Автополив + бонус роста 25% |
| Снег | Рост зимних культур нормальный. Остальные не растут (не сезон). |
| Солнечно/облачно | Стандартные условия |

---

## 8. Мультиплеерная синхронизация

### 8.1 Архитектура комнат Colyseus

```
  ┌─────────────────────────────────────────────┐
  │                TownRoom                     │
  │  Общее пространство города                  │
  │  Вместимость: 100 игроков + 25-50 NPC       │
  │                                             │
  │  Синхронизирует:                            │
  │  - Позиции всех игроков                     │
  │  - Позиции и анимации NPC                   │
  │  - Состояние диалогов (кто с кем говорит)   │
  │  - Погоду и время суток                     │
  │  - NPC-NPC разговоры (пузыри текста)        │
  └──────────────┬──────────────────────────────┘
                 │
  ┌──────────────┴──────────────────────────────┐
  │           HomesteadRoom (per player)         │
  │  Личное пространство игрока                 │
  │  Вместимость: 1 владелец + 5 гостей         │
  │                                             │
  │  Синхронизирует:                            │
  │  - Состояние грядок (FarmPlotState)         │
  │  - Позиции гостей                           │
  │  - Декор и постройки                        │
  │  - NPC-визитёры (если пришли на участок)    │
  └─────────────────────────────────────────────┘
```

### 8.2 Colyseus-схема мирового состояния

```typescript
// apps/server/src/rooms/schemas/WorldState.ts
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

// --- Позиция ---

export class Position extends Schema {
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
}

// --- Состояние игрока (видимое другим) ---

export class PlayerState extends Schema {
  @type('string') sessionId: string = '';
  @type('string') displayName: string = '';
  @type(Position) position = new Position();
  @type('string') animation: string = 'idle_down';
  @type('string') direction: string = 'down';
  @type('boolean') isMoving: boolean = false;
  @type('string') currentTool: string = '';        // '' если не использует
  @type('boolean') inDialogue: boolean = false;
}

// --- Состояние NPC (видимое всем) ---

export class NPCState extends Schema {
  @type('string') npcId: string = '';
  @type('string') displayName: string = '';
  @type(Position) position = new Position();
  @type('string') animation: string = 'idle_down';
  @type('string') direction: string = 'down';
  @type('boolean') isMoving: boolean = false;
  @type('string') currentAction: string = '';      // Иконка действия (bread, book...)
  @type('string') emotion: string = '';            // Эмоция (happy, sad, surprised)
  @type('boolean') inDialogue: boolean = false;
  @type('string') dialogueWithPlayer: string = ''; // sessionId говорящего
  @type('string') fsmState: string = 'idle';       // IDLE, WALKING, WORKING, TALKING, SLEEPING
}

// --- Состояние погоды ---

export class WeatherStateSchema extends Schema {
  @type('string') current: string = 'sunny';
  @type('float64') nextChangeAt: number = 0;
}

// --- Состояние времени ---

export class TimeStateSchema extends Schema {
  @type('uint8') hour: number = 12;
  @type('uint8') minute: number = 0;
  @type('string') season: string = 'spring';
  @type('string') period: string = 'day';
  @type('uint32') dayNumber: number = 0;
}

// --- Мировое состояние (TownRoom) ---

export class WorldState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: NPCState }) npcs = new MapSchema<NPCState>();
  @type(WeatherStateSchema) weather = new WeatherStateSchema();
  @type(TimeStateSchema) time = new TimeStateSchema();
}

// --- Состояние хозяйства (HomesteadRoom) ---

export class HomesteadState extends Schema {
  @type('string') ownerId: string = '';
  @type('string') ownerName: string = '';
  @type('uint8') farmLevel: number = 1;
  @type([FarmPlotState]) plots = new ArraySchema<FarmPlotState>();
  @type({ map: PlayerState }) visitors = new MapSchema<PlayerState>();
  @type({ map: NPCState }) npcVisitors = new MapSchema<NPCState>();
}
```

### 8.3 Что синхронизируется / что нет

#### Синхронизируется ВСЕМ клиентам

| Данные | Частота | Метод |
|--------|---------|-------|
| Позиции игроков + анимации | 10 тиков/сек (100 мс) | Colyseus state patch |
| Позиции NPC + анимации | 10 тиков/сек | Colyseus state patch |
| Состояние диалога NPC (кто говорит) | При изменении | Colyseus state patch |
| Иконка текущего действия NPC | При смене действия | Colyseus state patch |
| Время суток + сезон | Каждую игровую минуту | Colyseus state patch |
| Погода | При смене | Colyseus state patch |
| NPC-NPC текстовые пузыри | При генерации | Colyseus message broadcast |

#### Синхронизируется ТОЛЬКО владельцу

| Данные | Метод |
|--------|-------|
| Инвентарь | Colyseus filtered state |
| Баланс монет | Colyseus filtered state |
| Состояние грядок (в HomesteadRoom) | Colyseus state patch (видно гостям) |
| Активные квесты | Colyseus message (только владельцу) |

#### НЕ синхронизируется (server-only)

| Данные | Причина |
|--------|---------|
| Поток памяти NPC | Приватные данные NPC-агента |
| Рефлексии NPC | Приватные данные |
| LLM-вызовы | Серверная логика |
| Рассчёт отношений | Серверная логика |
| Квест-генерация | Серверная логика |

### 8.4 Colyseus-сообщения (клиент -> сервер)

```typescript
// libs/shared/src/types/messages.ts

/** Сообщения от клиента к серверу */
export type ClientMessage =
  // --- Движение ---
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right'; speed: number }
  | { type: 'stop' }

  // --- Фермерство ---
  | { type: 'action_till'; targetX: number; targetY: number }
  | { type: 'action_water'; targetX: number; targetY: number }
  | { type: 'action_plant'; targetX: number; targetY: number; seedId: string }
  | { type: 'action_harvest'; targetX: number; targetY: number }

  // --- Диалог ---
  | { type: 'dialogue_start'; npcId: string }
  | { type: 'dialogue_message'; sessionId: string; message: string; inputType: 'quick_reply' | 'free_text' }
  | { type: 'dialogue_end'; sessionId: string }

  // --- Торговля ---
  | { type: 'shop_buy'; npcId: string; itemId: string; quantity: number }
  | { type: 'shop_sell'; npcId: string; itemId: string; quantity: number }

  // --- Подарки ---
  | { type: 'gift_give'; npcId: string; itemId: string }

  // --- Квесты ---
  | { type: 'quest_accept'; questId: string }
  | { type: 'quest_decline'; questId: string }
  | { type: 'quest_complete'; questId: string }

  // --- Перемещение между комнатами ---
  | { type: 'travel_to_town' }
  | { type: 'travel_to_homestead' }
  | { type: 'visit_homestead'; ownerId: string };

/** Сообщения от сервера к клиенту */
export type ServerMessage =
  | { type: 'dialogue_response'; npcId: string; text: string; emotion: string; quickReplies: string[] }
  | { type: 'dialogue_ended'; npcId: string; farewell: string }
  | { type: 'notification'; title: string; body: string; icon?: string }
  | { type: 'quest_offered'; quest: Quest }
  | { type: 'quest_update'; questId: string; status: string }
  | { type: 'harvest_result'; success: boolean; itemId: string; quantity: number; isGolden: boolean }
  | { type: 'trade_result'; success: boolean; totalPrice: number; newBalance: number }
  | { type: 'npc_gossip'; npc1Id: string; npc2Id: string; lines: string[] }
  | { type: 'season_changed'; season: string }
  | { type: 'weather_changed'; weather: string }
  | { type: 'error'; code: string; message: string };
```

### 8.5 Обработка тиков

```typescript
// apps/server/src/rooms/TownRoom.ts (псевдокод структуры)

export class TownRoom extends Room<WorldState> {
  private npcService: NPCService;
  private gameTime: GameTimeService;
  private weather: WeatherService;
  private awareness: ActionAwarenessService;

  async onCreate(options: RoomCreateOptions) {
    this.setState(new WorldState());

    // Инициализация подсистем
    this.gameTime = new GameTimeService(options);
    this.weather = new WeatherService();
    this.npcService = new NPCService(/* ... */);
    this.awareness = new ActionAwarenessService(/* ... */);

    await this.npcService.initialize();

    // Главный тик: 10 раз в секунду
    this.setSimulationInterval((deltaTime) => {
      this.tick(deltaTime);
    }, 100);

    // Регистрация обработчиков сообщений
    this.registerMessageHandlers();
  }

  private tick(deltaTime: number): void {
    const now = Date.now();
    const gameTime = this.gameTime.getCurrentGameTime();

    // 1. Обновляем NPC (движение, FSM, тиры)
    this.npcService.tick(deltaTime, gameTime);

    // 2. Синхронизируем состояние NPC в схему
    this.syncNPCStates();

    // 3. Обновляем время и погоду
    this.syncTimeAndWeather(gameTime);
  }

  private syncNPCStates(): void {
    const states = this.npcService.getNPCStates();
    for (const [id, state] of states) {
      const npc = this.state.npcs.get(id);
      if (npc) {
        npc.position.x = state.x;
        npc.position.y = state.y;
        npc.animation = state.animation;
        npc.direction = state.direction;
        npc.isMoving = state.isMoving;
        npc.currentAction = state.activityIcon;
        npc.emotion = state.emotion;
        npc.inDialogue = state.inDialogue;
        npc.fsmState = state.fsmState;
      }
    }
  }

  private syncTimeAndWeather(gameTime: GameTime): void {
    this.state.time.hour = gameTime.hour;
    this.state.time.minute = gameTime.minute;
    this.state.time.season = gameTime.season;
    this.state.time.period = gameTime.period;
    this.state.time.dayNumber = gameTime.dayNumber;

    const weather = this.weather.getCurrentWeather();
    this.state.weather.current = weather.current;
    this.state.weather.nextChangeAt = weather.nextChangeAt;
  }
}
```

---

## 9. Схема базы данных

### 9.1 PostgreSQL

```sql
-- =============================================
-- ИГРОК
-- =============================================

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  server_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ЭКОНОМИКА ИГРОКА
-- =============================================

CREATE TABLE player_economy (
  player_id UUID PRIMARY KEY REFERENCES players(id),
  coins INTEGER NOT NULL DEFAULT 100,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ИНВЕНТАРЬ (персистентный)
-- =============================================

CREATE TABLE player_inventory (
  id BIGSERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id),
  slot_index SMALLINT NOT NULL,
  item_id VARCHAR(64) NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0,

  UNIQUE(player_id, slot_index)
);

CREATE INDEX idx_inventory_player ON player_inventory(player_id);

-- =============================================
-- ФЕРМА
-- =============================================

CREATE TABLE player_farm (
  player_id UUID PRIMARY KEY REFERENCES players(id),
  farm_level SMALLINT NOT NULL DEFAULT 1,
  grid_size SMALLINT NOT NULL DEFAULT 3
);

CREATE TABLE farm_plots (
  id BIGSERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id),
  x SMALLINT NOT NULL,
  y SMALLINT NOT NULL,
  crop_type VARCHAR(32) NOT NULL DEFAULT '',
  growth_stage SMALLINT NOT NULL DEFAULT 0,
  planted_at TIMESTAMPTZ,
  watered BOOLEAN NOT NULL DEFAULT FALSE,
  last_watered_at TIMESTAMPTZ,
  effective_growth_ms BIGINT NOT NULL DEFAULT 0,
  last_growth_update TIMESTAMPTZ,
  harvest_ready BOOLEAN NOT NULL DEFAULT FALSE,

  UNIQUE(player_id, x, y)
);

CREATE INDEX idx_farm_plots_player ON farm_plots(player_id);

-- =============================================
-- ОТНОШЕНИЯ ИГРОК-NPC
-- =============================================

CREATE TABLE relationships (
  id BIGSERIAL PRIMARY KEY,
  npc_id VARCHAR(64) NOT NULL REFERENCES npc_agents(id),
  player_id UUID NOT NULL REFERENCES players(id),
  level VARCHAR(16) NOT NULL DEFAULT 'stranger',
  total_conversations INTEGER NOT NULL DEFAULT 0,
  gifts_given INTEGER NOT NULL DEFAULT 0,
  quests_completed INTEGER NOT NULL DEFAULT 0,
  total_visits INTEGER NOT NULL DEFAULT 0,
  sentiment NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
  first_met_at TIMESTAMPTZ DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(npc_id, player_id)
);

CREATE INDEX idx_relationships_player ON relationships(player_id);
CREATE INDEX idx_relationships_npc ON relationships(npc_id);

-- =============================================
-- КВЕСТЫ
-- =============================================

CREATE TABLE quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR(64) NOT NULL,
  npc_id VARCHAR(64) NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id),
  template VARCHAR(32) NOT NULL,
  title VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  objective JSONB NOT NULL,
  reward JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'offered',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_quests_player_status ON quests(player_id, status);
CREATE INDEX idx_quests_npc ON quests(npc_id, status);
CREATE INDEX idx_quests_expires ON quests(expires_at)
  WHERE status IN ('offered', 'accepted');

-- =============================================
-- ТРАНЗАКЦИИ (лог экономики)
-- =============================================

CREATE TABLE market_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR(64) NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id),
  item_id VARCHAR(64) NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_unit INTEGER NOT NULL,
  npc_id VARCHAR(64),
  bonus_applied NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  total_price INTEGER NOT NULL,
  transaction_type VARCHAR(8) NOT NULL,  -- 'sell' | 'buy'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_player ON market_transactions(player_id, created_at DESC);
CREATE INDEX idx_transactions_server ON market_transactions(server_id, created_at DESC);

-- =============================================
-- NPC (из npc-service spec, повторяем для полноты)
-- =============================================

-- npc_agents, memories, llm_cost_log
-- (см. docs/documentation/design/systems/npc-service.md)

-- =============================================
-- РЕПУТАЦИЯ
-- =============================================

CREATE TABLE player_reputation (
  player_id UUID PRIMARY KEY REFERENCES players(id),
  reputation_level INTEGER NOT NULL DEFAULT 1,
  reputation_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9.2 Redis-структура

```
# --- Игровое состояние ---
server:{serverId}:weather       → JSON WeatherState              TTL: none (обновляется)
server:{serverId}:time          → JSON GameTime                  TTL: none (обновляется)
server:{serverId}:season        → string (spring|summer|...)     TTL: none

# --- Состояние игрока (кэш) ---
player:{playerId}:inventory     → JSON InventoryState            TTL: 30 min (обновляется при изменении)
player:{playerId}:coins         → number                         TTL: 30 min
player:{playerId}:last_login    → timestamp                      TTL: none
player:{playerId}:farm_plots    → JSON FarmPlotState[]           TTL: 30 min

# --- NPC (из npc-service) ---
npc:{npcId}:plan                → JSON daily plan                TTL: 24h
npc:{npcId}:state               → JSON FSM state                 TTL: none
npc:{npcId}:greeting:{hour}     → cached greeting text           TTL: 1h
npc:{npcId}:dialogue_lock       → player sessionId               TTL: 5 min
npc:{npcId}:tier                → FULL|NEARBY|BACKGROUND         TTL: 5s

# --- Квесты ---
quests:active:{playerId}        → JSON Quest[]                   TTL: none (обновляется при изменении)
quests:offered:{playerId}       → JSON Quest[]                   TTL: 3 days

# --- Экономика ---
market:daily_sales:{itemId}     → number (количество за день)    TTL: 24h
```

---

## 10. Приложение: сводная таблица предметов

### 10.1 Полный каталог MVP

| ID | Название | Категория | Стакается | Макс. стак | Цена продажи | Цена покупки |
|---|---|---|---|---|---|---|
| **Семена** | | | | | | |
| seed_radish | Семена редиса | seed | Да | 99 | 2 | 5 |
| seed_potato | Семена картофеля | seed | Да | 99 | 3 | 8 |
| seed_strawberry | Семена клубники | seed | Да | 99 | 5 | 12 |
| seed_tomato | Семена помидоров | seed | Да | 99 | 4 | 10 |
| seed_pumpkin | Семена тыквы | seed | Да | 99 | 6 | 15 |
| **Урожай** | | | | | | |
| radish | Редис | crop | Да | 99 | 15 | -- |
| radish_golden | Золотой редис | crop | Да | 99 | 45 | -- |
| potato | Картофель | crop | Да | 99 | 25 | -- |
| potato_golden | Золотой картофель | crop | Да | 99 | 75 | -- |
| strawberry | Клубника | crop | Да | 99 | 40 | -- |
| strawberry_golden | Золотая клубника | crop | Да | 99 | 120 | -- |
| tomato | Помидоры | crop | Да | 99 | 35 | -- |
| tomato_golden | Золотые помидоры | crop | Да | 99 | 105 | -- |
| pumpkin | Тыква | crop | Да | 99 | 60 | -- |
| pumpkin_golden | Золотая тыква | crop | Да | 99 | 180 | -- |
| **Инструменты** | | | | | | |
| watering_can_1 | Лейка | tool | Нет | 1 | 0 | 0 (старт) |
| watering_can_2 | Улучшенная лейка | tool | Нет | 1 | 0 | 300 |
| watering_can_3 | Мастерская лейка | tool | Нет | 1 | 0 | 1200 |
| hoe_1 | Мотыга | tool | Нет | 1 | 0 | 0 (старт) |
| hoe_2 | Улучшенная мотыга | tool | Нет | 1 | 0 | 300 |
| hoe_3 | Мастерская мотыга | tool | Нет | 1 | 0 | 1200 |
| sickle_1 | Серп | tool | Нет | 1 | 0 | 0 (старт) |
| sickle_2 | Улучшенный серп | tool | Нет | 1 | 0 | 300 |
| sickle_3 | Мастерский серп | tool | Нет | 1 | 0 | 1200 |
| **Подарки** | | | | | | |
| bouquet_mixed | Смешанный букет | gift | Нет | 1 | 25 | 50 |
| bread_rosemary | Хлеб с розмарином | gift | Да | 10 | 30 | -- |
| chocolate_eclair | Шоколадный эклер | gift | Да | 10 | 35 | -- |
| fishing_bait | Отборная наживка | gift | Да | 20 | 10 | 25 |
| rare_book | Редкая книга | gift | Нет | 1 | 50 | -- |
| **Материалы** | | | | | | |
| fertilizer | Удобрение | material | Да | 20 | 10 | 20 |
| wild_herb | Дикие травы | material | Да | 50 | 5 | -- |
| wood | Дерево | material | Да | 50 | 8 | -- |
| stone | Камень | material | Да | 50 | 5 | -- |
| **Особые** | | | | | | |
| town_key | Ключ от города | special | Нет | 1 | 0 | -- |
| notebook_page | Страница из блокнота | special | Нет | 1 | 0 | -- |

### 10.2 Сводная таблица культур

| Культура | Сезон | Рост (реальн.) | Полив/день | Семена | Продажа | Урожай/грядка | Золотой шанс | Ключевой NPC |
|----------|-------|---------------|------------|--------|---------|---------------|-------------|-------------|
| Редис | Весна, Лето | 12 ч | 1x | 5 | 15 | 3 | 5% | Степан, Ира |
| Картофель | Весна | 2 дня | 1x | 8 | 25 | 4 | 3% | Марко, Ира |
| Клубника | Весна, Лето | 3 дня | 2x | 12 | 40 | 5 | 4% | Марко, Лена |
| Помидоры | Лето | 4 дня | 2x | 10 | 35 | 6 | 3% | Ира |
| Тыква | Осень | 6 дней | 2x | 15 | 60 | 2 | 8% | Лена, Олег |

---

**Конец документа**

*Этот документ является техническим руководством для имплементации. Все интерфейсы, схемы и алгоритмы реализуемы напрямую. Для уточнения геймдизайнерских решений -- см. Core Mechanics Analysis и Responsive World Design. Для NPC-специфичных систем (диалог, память, рефлексии) -- см. NPC Service Spec.*
