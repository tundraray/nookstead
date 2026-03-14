# Design-012: NPC Responsive World — Дизайн системы "Отзывчивый мир"

## Overview

Расширение NPC Service для поддержки архитектуры "Отзывчивый мир" (Responsive World) — стратегического пивота, при котором NPC не только ведут диалоги, но **замечают, запоминают и реагируют** на все действия игрока. Документ определяет четыре новых подсистемы: ActionAwarenessService, GossipService, OrganicQuestGenerator и NPCInitiativeService, а также обновлённый PromptBuilder с поддержкой наблюдений и сплетен.

## Design Summary (Meta)

```yaml
design_type: "extension"
risk_level: "medium"
complexity_level: "high"
complexity_rationale: >
  (1) AC требуют координации 5+ асинхронных процессов (event aggregation,
  gossip propagation, quest generation, initiative scheduling, prompt assembly),
  управления 4+ состояниями (quest FSM, gossip hop tracking, initiative cooldowns,
  observation deduplication).
  (2) Ограничения: LLM-бюджет < 5% прироста, шаблонная генерация 90%+ наблюдений,
  gossip max 2 хопа, quest max 1/2 дня — требуют точной калибровки параметров.
main_constraints:
  - "LLM-расходы новых систем < 5% от общих расходов NPC Service"
  - "90%+ наблюдений генерируются шаблонами (zero LLM cost)"
  - "Gossip propagation max 2 хопа, importance decay -2 на хоп"
  - "Quest frequency max 1 на NPC за 2 реальных дня"
  - "Обратная совместимость с текущим BotManager / DialogueService"
biggest_risks:
  - "Перегрузка памяти NPC наблюдениями (слишком много low-value memories)"
  - "Gossip создаёт несогласованную информацию между NPC"
  - "Organic quests не соответствуют текущему состоянию мира"
  - "NPC initiative раздражает игроков, если слишком частая"
unknowns:
  - "Оптимальный баланс между шаблонными и LLM-generated наблюдениями"
  - "Порог importance для gossip propagation (5 может быть слишком низким)"
  - "Влияние дополнительных 300 токенов (observations+gossip) на качество диалогов"
```

## Background and Context

### Prerequisite ADRs

- **ADR-0013-npc-bot-entity-architecture.md**: Архитектура NPC-сущностей, BotManager
- **ADR-0014-ai-dialogue-openai-sdk.md**: Интеграция AI-диалогов через Vercel AI SDK
- **ADR-0015-npc-prompt-architecture.md**: Архитектура промптов NPC
- **LLM Cost Optimization Strategy v1.0**: Стратегия оптимизации LLM-расходов (prompt caching, Haiku routing, шаблоны)
- **Responsive World Design v2.0**: Каталог 70+ событий, NPC Personality Bible, эмерджентные арки

### Agreement Checklist

#### Scope (что меняем)
- [x] Новый модуль `ActionAwarenessService` — наблюдение за действиями игроков
- [x] Новый модуль `GossipService` — распространение информации между NPC
- [x] Новый модуль `OrganicQuestGenerator` — генерация квестов из рефлексий
- [x] Новый модуль `NPCInitiativeService` — NPC инициирует взаимодействия
- [x] Обновлённый `SystemPromptBuilder` — секции observations и gossip
- [x] Новые таблицы БД для events, gossip, quests, letters
- [x] Обновление `memories` table (новые типы: observation, gossip)

#### Non-Scope (что НЕ меняем)
- [x] Существующий `BotManager` — движение, wander, interaction validation
- [x] Существующий `DialogueService` — streaming, model routing
- [x] Colyseus room lifecycle и ChunkRoom
- [x] Memory retrieval algorithm (recency + importance + relevance)
- [x] NPC State Machine (idle/walking/interacting)
- [x] Клиентский код (Phaser, Next.js)

#### Constraints
- [x] Параллельная работа: Да — новые модули работают параллельно с существующими
- [x] Обратная совместимость: Да — все существующие API сохраняются
- [x] Performance: LLM budget increase < 5%, observation processing < 10ms/event

### Problem to Solve

Текущий NPC Service (`BotManager` + `DialogueService` + `SystemPromptBuilder`) поддерживает только **реактивные диалоги**: игрок подходит к NPC, NPC отвечает на основе персоны и истории разговоров. NPC не знают, что игрок делал между разговорами — не видят, что он посадил клубнику, продал урожай, построил дом или пропал на неделю.

Это создаёт разрыв: NPC "оживают" только в момент диалога, а между диалогами — "пустые". Стратегический пивот проекта ("мир, который замечает тебя") требует, чтобы NPC:

1. **Замечали** действия игрока (фермерство, торговля, социализация)
2. **Обсуждали** игрока между собой (gossip)
3. **Предлагали** квесты на основе своих наблюдений и рефлексий
4. **Инициировали** взаимодействия (письма, визиты, подходы)

### Current Challenges

1. `SystemPromptBuilder` не имеет секции наблюдений — NPC не знает о действиях игрока
2. Нет механизма передачи информации между NPC (gossip)
3. Квесты отсутствуют как механика — нет генерации из рефлексий
4. NPC полностью пассивны — никогда не инициируют контакт
5. Memory system записывает только dialogue-related events

### Requirements

#### Functional Requirements

- FR-1: NPC автоматически создают наблюдения (memories) при значимых действиях игрока
- FR-2: NPC обмениваются наблюдениями при совпадении в локации (gossip)
- FR-3: Система генерирует квесты из рефлексий NPC
- FR-4: NPC инициируют взаимодействия (письма, визиты, подходы)
- FR-5: Обновлённый промпт включает наблюдения и gossip

#### Non-Functional Requirements

- **Performance**: Обработка event < 10ms, gossip round < 100ms на 50 NPC
- **Cost**: Новые системы < 5% от общих LLM-расходов ($0.36/день при 50 DAU)
- **Scalability**: Линейное масштабирование с количеством NPC и игроков
- **Reliability**: Graceful degradation — если ActionAwareness упал, диалоги продолжают работать

---

## Acceptance Criteria (AC) — EARS Format

### FR-1: Action Awareness

- [x] **When** игрок совершает значимое действие (посадка, сбор урожая, продажа, подарок, строительство), the system shall создать observation memory для ближайших NPC с описанием на основе шаблона
- [x] **When** действие повторяется (тот же тип, тот же игрок, тот же NPC), the system shall агрегировать в одну запись вместо создания дубликатов
- [x] **If** действие является "особым" (первый подарок, первый визит после отсутствия, редкий предмет), **then** the system shall вызвать Haiku для importance scoring
- [x] The system shall присвоить статический importance score для 90%+ рутинных событий без вызова LLM
- [x] **While** cooldown для event type + player + NPC активен (1 реальный день), the system shall не создавать повторных наблюдений того же типа

### FR-2: Gossip Service

- [x] **When** два NPC находятся в одной локации по расписанию, the system shall с определённой вероятностью передать high-importance наблюдения от одного NPC другому
- [x] The system shall создать gossip memory для получателя с пометкой источника и importance = original - 2
- [x] **While** gossip hop count >= 2, the system shall не распространять информацию далее
- [x] **If** NPC уже получил данное наблюдение (по hash), **then** the system shall не создавать дубликат
- [x] The system shall учитывать gossip_rate NPC (Ира: 80%, Олег: 20%, Анна: 40%)

### FR-3: Organic Quest Generator

- [x] **When** daily reflection содержит ключевые слова потребности ("нужна помощь", "хочу", "не хватает"), the system shall проверить соответствие quest template
- [x] **If** подходящий template найден и cooldown (2 реальных дня на NPC) истёк, **then** the system shall сгенерировать квест через Haiku
- [x] The system shall предложить квест игроку с наивысшим уровнем отношений
- [x] **When** игрок принимает квест, the system shall создать quest record в БД со статусом ACTIVE
- [x] **When** условия квеста выполнены, the system shall перевести квест в COMPLETED и начислить награду

### FR-4: NPC Initiative Service

- [x] **When** NPC имеет 3+ наблюдений об участке игрока, the system shall с вероятностью запланировать визит на участок (max 1 раз в 3 реальных дня)
- [x] **When** reflection NPC упоминает игрока, the system shall с вероятностью сгенерировать письмо через Haiku
- [x] **When** NPC имеет срочную информацию (quest, gossip, reaction), the system shall запланировать approach к игроку при нахождении в одной локации
- [x] **If** relationship >= casual_friend И игрок дарил подарок недавно, **then** the system shall запланировать ответный подарок

### FR-5: Updated Prompt Builder

- [x] The system shall включать до 5 recent observations в секцию "ЧТО ТЫ ЗАМЕТИЛ(А)" промпта
- [x] The system shall включать до 3 gossip items в секцию "СЛУХИ" промпта
- [x] The system shall укладываться в общий token budget ~1900 токенов input
- [x] **When** observations или gossip отсутствуют, the system shall опустить соответствующие секции

---

## Existing Codebase Analysis

### Implementation Path Mapping

| Type | Path | Description |
|------|------|-------------|
| Existing | `apps/server/src/npc-service/index.ts` | Entry point, exports BotManager |
| Existing | `apps/server/src/npc-service/lifecycle/BotManager.ts` | Bot lifecycle, movement, interaction |
| Existing | `apps/server/src/npc-service/ai/DialogueService.ts` | Streaming dialogue via Vercel AI SDK + OpenAI |
| Existing | `apps/server/src/npc-service/ai/SystemPromptBuilder.ts` | System prompt assembly |
| Existing | `apps/server/src/npc-service/types/bot-types.ts` | ServerBot, BotUpdate, InteractionResult types |
| New | `apps/server/src/npc-service/awareness/ActionAwarenessService.ts` | Event observation + template system |
| New | `apps/server/src/npc-service/awareness/ObservationTemplates.ts` | Template definitions |
| New | `apps/server/src/npc-service/awareness/EventAggregator.ts` | Deduplication + cooldown |
| New | `apps/server/src/npc-service/social/GossipService.ts` | Inter-NPC gossip propagation |
| New | `apps/server/src/npc-service/social/GossipRules.ts` | Per-NPC gossip rates, hop limits |
| New | `apps/server/src/npc-service/quests/OrganicQuestGenerator.ts` | Quest generation from reflections |
| New | `apps/server/src/npc-service/quests/QuestTemplates.ts` | Quest template definitions |
| New | `apps/server/src/npc-service/initiative/NPCInitiativeService.ts` | NPC-initiated actions |
| New | `apps/server/src/npc-service/initiative/LetterGenerator.ts` | Letter content generation |
| New | `apps/server/src/npc-service/types/responsive-types.ts` | New type definitions |

### Integration Points

- **ActionAwarenessService -> Memory System**: Writes observation memories to DB
- **ActionAwarenessService -> SystemPromptBuilder**: Provides recent observations for prompt
- **GossipService -> Memory System**: Creates gossip memories
- **GossipService -> SystemPromptBuilder**: Provides gossip items for prompt
- **OrganicQuestGenerator -> ReflectionEngine**: Reads daily reflections
- **OrganicQuestGenerator -> DialogueEngine**: Quest offered during dialogue
- **NPCInitiativeService -> BotManager**: Schedules NPC movement to player
- **NPCInitiativeService -> Colyseus Room**: Sends letter/approach events to client

### Code Inspection Evidence

| File Inspected | Key Finding | Design Impact |
|---------------|-------------|---------------|
| `BotManager.ts` (574 lines) | Simple IDLE/WALKING/INTERACTING FSM, no schedule system | Initiative visits need schedule extension or separate movement queue |
| `DialogueService.ts` (98 lines) | Uses Vercel AI SDK (`streamText`), not Anthropic SDK directly | Prompt caching needs adapter or SDK switch for awareness features |
| `SystemPromptBuilder.ts` (196 lines) | Modular section-based architecture (identity, world, relationship, memory, guardrails, format) | Easy to add observations and gossip sections — follow existing pattern |
| `bot-types.ts` (125 lines) | `ServerBot` has persona fields but no memory/observation storage | Runtime observation cache needs separate data structure |
| `SystemPromptBuilder.ts:119` | `buildMemorySection()` returns hardcoded "(Пока нет воспоминаний)" | Memory integration not yet implemented — our observations will be the first real memory content |

### Similar Functionality Search

- **Observation templates**: No existing template system found. New implementation.
- **Gossip**: No inter-NPC communication exists. New implementation.
- **Quests**: No quest system exists. New implementation.
- **NPC initiative**: No proactive NPC behavior exists. BotManager only does random wander. New implementation.
- **Event aggregation**: No existing event aggregation. New implementation.

**Decision**: All four subsystems are genuinely new functionality with no existing implementations to reuse or extend. They integrate with existing modules through well-defined interfaces.

---

## Design

### Architecture Overview — До и После

#### Текущая архитектура (dialogue-only)

```
┌──────────────────────────────────────────────┐
│                NPC SERVICE (текущее)           │
│                                                │
│  ┌────────────┐  ┌──────────────┐              │
│  │ BotManager │  │ Dialogue     │              │
│  │            │  │ Service      │              │
│  │ - wander   │  │ - streamText │              │
│  │ - interact │  │ - persona    │              │
│  │ - movement │  │   prompt     │              │
│  └─────┬──────┘  └──────┬───────┘              │
│        │                │                      │
│  ┌─────┴────────────────┴───────┐              │
│  │     SystemPromptBuilder       │              │
│  │  identity + world + rules     │              │
│  │  (NO memories, NO observations)│             │
│  └───────────────────────────────┘              │
└──────────────────────────────────────────────────┘
```

**Проблема**: NPC знает только свою персону. Не знает, что делает игрок. Не обменивается информацией с другими NPC. Не инициирует контакт. Не предлагает квесты.

#### Новая архитектура (responsive world)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NPC SERVICE (responsive world)                     │
│                                                                       │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────────┐               │
│  │ BotManager │ │ Dialogue     │ │ ActionAwareness   │  ◄── NEW     │
│  │            │ │ Service      │ │ Service            │               │
│  │ - wander   │ │ - streamText │ │ - event templates │               │
│  │ - interact │ │ - persona    │ │ - deduplication   │               │
│  │ - movement │ │   prompt     │ │ - importance      │               │
│  └─────┬──────┘ └──────┬───────┘ └────────┬─────────┘               │
│        │               │                   │                         │
│  ┌─────┴───────────────┴───────────────────┴────────┐               │
│  │          SystemPromptBuilder (UPDATED)             │               │
│  │  identity + world + OBSERVATIONS + memories +      │               │
│  │  reflections + GOSSIP + rules                      │               │
│  └───────────────────────────────────────────────────┘               │
│                                                                       │
│  ┌──────────────┐ ┌──────────────────┐ ┌──────────────────┐         │
│  │ Gossip       │ │ OrganicQuest     │ │ NPCInitiative    │  ◄── NEW│
│  │ Service      │ │ Generator        │ │ Service           │         │
│  │              │ │                  │ │                   │         │
│  │ - propagate  │ │ - reflection     │ │ - visit homestead│         │
│  │ - hop limit  │ │   analysis       │ │ - send letter    │         │
│  │ - npc rates  │ │ - quest template │ │ - approach player│         │
│  │              │ │ - Haiku generate │ │ - gift return    │         │
│  └──────┬───────┘ └────────┬─────────┘ └────────┬────────┘         │
│         │                  │                     │                   │
│  ┌──────┴──────────────────┴─────────────────────┴──────┐           │
│  │                     Data Layer                         │           │
│  │  PostgreSQL: memories, player_action_events,           │           │
│  │              npc_gossip_log, organic_quests, npc_letters│          │
│  │  Redis: observation cache, gossip cooldowns,           │           │
│  │         quest state, initiative schedule                │           │
│  └────────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────┘
        │                    │                    │
   Colyseus Room        Client (Phaser)      Game Events Bus
   (state sync)         (UI: letters,        (farming, trade,
                         quests, bubble)       social actions)
```

### Data Flow

```
Game Event (player plants crop)
    │
    ▼
ActionAwarenessService.onPlayerAction(event)
    │
    ├─ [1] Check cooldown (Redis) ──► skip if active
    │
    ├─ [2] Check deduplication ──► aggregate if duplicate
    │
    ├─ [3] Select template ──► OBSERVATION_TEMPLATES[event.type]
    │        │
    │        ├─ Template found → generate description (zero cost)
    │        └─ No template → skip (unknown event type)
    │
    ├─ [4] Score importance
    │        │
    │        ├─ Static score (90%) → STATIC_IMPORTANCE[event.type]
    │        └─ Special event (10%) → Haiku call ($0.0002)
    │
    ├─ [5] Create observation memory ──► PostgreSQL (memories table)
    │
    └─ [6] Update Redis cache (per NPC, per player)


GossipService.processGossipRound() [every 4 hours]
    │
    ├─ [1] Find co-located NPC pairs (same location in schedule)
    │
    ├─ [2] For each pair: check if source has high-importance memories
    │
    ├─ [3] Roll gossip probability (based on source NPC gossip_rate)
    │
    ├─ [4] Create gossip memory for target NPC
    │        │
    │        ├─ description: "NPC_A рассказал мне, что {observation}"
    │        ├─ importance: original_importance - 2
    │        ├─ hop_count: original_hop_count + 1
    │        └─ memory_type: 'gossip'
    │
    └─ [5] Log to npc_gossip_log


OrganicQuestGenerator.checkForQuests() [daily, after reflections]
    │
    ├─ [1] Read today's reflections for all NPC
    │
    ├─ [2] Detect "need" keywords (regex: нужна помощь|хочу|не хватает|проблема)
    │
    ├─ [3] Match to quest template
    │
    ├─ [4] Generate quest via Haiku ($0.001)
    │
    └─ [5] Store in organic_quests table, status: PENDING


NPCInitiativeService.processInitiatives() [hourly]
    │
    ├─ [1] Check each NPC for initiative triggers
    │        │
    │        ├─ 3+ farming observations → schedule homestead visit
    │        ├─ Reflection mentions player → generate letter (Haiku)
    │        ├─ Urgent info (quest/gossip) → schedule approach
    │        └─ Relationship + recent gift → schedule gift return
    │
    ├─ [2] Apply cooldowns (max 1 visit / 3 days, max 1 letter / 2 days)
    │
    └─ [3] Queue actions for execution
```

### Change Impact Map

```yaml
Change Target: NPC Service — новые модули "Отзывчивого мира"
Direct Impact:
  - apps/server/src/npc-service/ai/SystemPromptBuilder.ts (добавление секций observations, gossip)
  - apps/server/src/npc-service/index.ts (экспорт новых модулей)
  - apps/server/src/npc-service/types/ (новые типы)
  - Database schema (4 новых таблицы, 1 обновление)
Indirect Impact:
  - Colyseus Room (получает events для quest UI, letter notifications, NPC approach bubbles)
  - Prompt token budget (рост с ~1500 до ~1900 токенов)
  - LLM cost (рост < 5%)
No Ripple Effect:
  - BotManager (движение, wander, interaction validation — без изменений)
  - DialogueService (streaming, model routing — без изменений)
  - Клиентский код (Phaser rendering, Next.js pages)
  - Authentication, map system, player movement
```

### Integration Point Map

```yaml
Integration Point 1:
  Existing Component: Game Events Bus (Colyseus onMessage handlers)
  Integration Method: ActionAwarenessService подписывается на game events
  Impact Level: Medium (новые данные создаются, существующие не меняются)
  Required Test Coverage: Verify events are captured and observations created

Integration Point 2:
  Existing Component: SystemPromptBuilder.buildSystemPrompt()
  Integration Method: Добавление новых секций (observations, gossip) в существующую цепочку
  Impact Level: Medium (изменение prompt content, но не structure)
  Required Test Coverage: Verify token budget, verify prompt quality with new sections

Integration Point 3:
  Existing Component: Memory System (будущий, пока hardcoded)
  Integration Method: ActionAwareness и Gossip пишут в memories table
  Impact Level: Low (новые записи, не изменение существующих)
  Required Test Coverage: Verify memory records are correct, importance scores valid

Integration Point 4:
  Existing Component: Colyseus Room (ChunkRoom)
  Integration Method: Новые message types для quests, letters, NPC approach
  Impact Level: Medium (новые message handlers)
  Required Test Coverage: Verify client receives notifications correctly
```

### Integration Boundary Contracts

```yaml
Boundary: GameEventBus -> ActionAwarenessService
  Input: PlayerActionEvent { playerId, actionType, data, timestamp, location }
  Output: void (side effect: observation memory created in DB)
  On Error: Log warning, skip observation. Never block game event processing.

Boundary: ActionAwarenessService -> MemorySystem
  Input: NewObservation { agentId, description, importance, memoryType: 'observation', relatedEntities }
  Output: Promise<void> (async, non-blocking)
  On Error: Queue for retry (Redis). Log error. Do not block.

Boundary: GossipService -> MemorySystem
  Input: NewGossipMemory { agentId, description, importance, memoryType: 'gossip', sourceNpc, hopCount }
  Output: Promise<void>
  On Error: Skip gossip creation. Log warning.

Boundary: OrganicQuestGenerator -> LLM (Haiku)
  Input: Quest generation prompt (NPC reflection + context + template)
  Output: QuestDefinition { type, description, objective, reward }
  On Error: Skip quest generation for this NPC. Retry next day.

Boundary: NPCInitiativeService -> Colyseus Room
  Input: InitiativeAction { type: 'letter'|'visit'|'approach'|'gift', npcId, playerId, data }
  Output: Client notification via Colyseus message
  On Error: Queue for retry. NPC continues normal schedule.
```

---

## Part 2: ActionAwarenessService — Детальный дизайн

### Назначение

ActionAwarenessService — мост между игровыми событиями и системой памяти NPC. Сервис наблюдает за значимыми действиями игроков и создаёт observation memories для NPC, которые находятся поблизости или чья "линза" совпадает с типом события.

**Ключевой принцип**: 90%+ наблюдений генерируются шаблонами (zero LLM cost). Только "особые" события (первый подарок, редкий предмет, возврат после отсутствия) требуют Haiku scoring.

### Event Types & Observers

```typescript
// apps/server/src/npc-service/types/responsive-types.ts

/** Типы игровых событий, которые NPC могут заметить */
export enum PlayerActionType {
  // Фермерские
  CROP_PLANTED = 'crop_planted',
  CROP_WATERED = 'crop_watered',
  CROP_HARVESTED = 'crop_harvested',
  CROP_NEGLECTED = 'crop_neglected',         // не поливал 2+ дня
  ALL_CROPS_TENDED = 'all_crops_tended',     // все грядки политы 7 дней подряд
  FIRST_CROP_TYPE = 'first_crop_type',       // первая посадка нового типа культуры
  GOLD_HARVEST = 'gold_harvest',             // редкий "золотой" урожай

  // Экономические
  ITEM_SOLD = 'item_sold',
  ITEM_BOUGHT = 'item_bought',
  ITEM_SOLD_TO_NPC = 'item_sold_to_npc',     // продал конкретному NPC
  SAME_ITEM_STREAK = 'same_item_streak',     // продаёт одно и то же 3+ дня
  EARNINGS_MILESTONE = 'earnings_milestone', // заработал 500/1000/2000 монет

  // Социальные
  NPC_VISITED = 'npc_visited',
  NPC_GIFTED = 'npc_gifted',
  QUEST_COMPLETED = 'quest_completed',
  FRIENDSHIP_MILESTONE = 'friendship_milestone',
  PLAYER_RETURNED = 'player_returned',       // вернулся после 3+/7+/14+ дней
  MULTIPLE_NPC_VISITED = 'multiple_npc_visited', // поговорил с 5+ NPC за сессию

  // Строительство / декор
  HOMESTEAD_EXPANDED = 'homestead_expanded',
  DECORATION_PLACED = 'decoration_placed',
  FLOWERS_PLANTED = 'flowers_planted',
  TREE_PLANTED = 'tree_planted',

  // Мировые
  SEASON_CHANGED = 'season_changed',
  WEATHER_CHANGED = 'weather_changed',
  FESTIVAL_STARTED = 'festival_started',
  NIGHT_WALK = 'night_walk',                 // гуляет ночью
}

/** Контекст игрового события */
export interface PlayerActionEvent {
  playerId: string;
  playerName: string;
  actionType: PlayerActionType;
  timestamp: number;
  location?: { x: number; y: number };
  data: Record<string, unknown>;  // actionType-specific data
  // Примеры data:
  // crop_planted:   { cropName: 'клубника', quantity: 3 }
  // item_sold:      { itemName: 'помидоры', quantity: 15, totalPrice: 45 }
  // npc_gifted:     { npcId: 'marko', itemName: 'клубника', itemQuality: 'gold' }
  // player_returned: { daysAbsent: 7 }
}

/** Какой NPC замечает какие типы событий */
export interface NpcObserverConfig {
  npcId: string;
  /** Типы событий, которые этот NPC замечает (его "линза") */
  observedEvents: PlayerActionType[];
  /** Множитель importance для событий этого типа (линза усиливает) */
  importanceMultiplier?: Partial<Record<PlayerActionType, number>>;
}
```

### NPC Observer Configuration (кто что замечает)

```typescript
// apps/server/src/npc-service/awareness/NpcObserverConfig.ts

import { PlayerActionType as A } from '../types/responsive-types';
import type { NpcObserverConfig } from '../types/responsive-types';

/**
 * Конфигурация "линз" NPC — кто какие типы событий замечает.
 * Основано на NPC Personality Bible (responsive-world-design.md).
 *
 * Принцип: каждый NPC замечает 5-10 типов событий, релевантных его личности.
 * Мировые события (сезон, погода, фестиваль) замечают все.
 */
export const NPC_OBSERVER_CONFIGS: NpcObserverConfig[] = [
  {
    npcId: 'marko',
    // Марко: еда, щедрость, человеческое тепло
    observedEvents: [
      A.CROP_HARVESTED, A.ITEM_SOLD_TO_NPC, A.NPC_GIFTED,
      A.NPC_VISITED, A.PLAYER_RETURNED, A.QUEST_COMPLETED,
      A.GOLD_HARVEST, A.FESTIVAL_STARTED, A.SEASON_CHANGED,
    ],
    importanceMultiplier: {
      [A.CROP_HARVESTED]: 1.5,   // Марко особенно интересуют ингредиенты
      [A.NPC_GIFTED]: 2.0,       // щедрость резонирует
    },
  },
  {
    npcId: 'lena',
    // Лена: красота, рост, забота — главный наблюдатель за участком
    observedEvents: [
      A.CROP_PLANTED, A.CROP_HARVESTED, A.CROP_NEGLECTED,
      A.ALL_CROPS_TENDED, A.FLOWERS_PLANTED, A.TREE_PLANTED,
      A.DECORATION_PLACED, A.HOMESTEAD_EXPANDED,
      A.SEASON_CHANGED, A.WEATHER_CHANGED,
    ],
    importanceMultiplier: {
      [A.FLOWERS_PLANTED]: 2.0,
      [A.CROP_NEGLECTED]: 1.5,
      [A.TREE_PLANTED]: 2.0,
    },
  },
  {
    npcId: 'oleg',
    // Олег: терпение, время, скрытые глубины
    observedEvents: [
      A.ALL_CROPS_TENDED, A.CROP_HARVESTED, A.NPC_VISITED,
      A.PLAYER_RETURNED, A.NIGHT_WALK, A.TREE_PLANTED,
      A.SEASON_CHANGED, A.FESTIVAL_STARTED,
    ],
    importanceMultiplier: {
      [A.ALL_CROPS_TENDED]: 2.0,  // Олег ценит терпение
      [A.NIGHT_WALK]: 1.5,
    },
  },
  {
    npcId: 'anna',
    // Анна: знания, истории, метафоры
    observedEvents: [
      A.FIRST_CROP_TYPE, A.QUEST_COMPLETED, A.NPC_VISITED,
      A.PLAYER_RETURNED, A.FRIENDSHIP_MILESTONE,
      A.SEASON_CHANGED,
    ],
  },
  {
    npcId: 'sara',
    // Сара: совершенство, эстетика, мастерство
    observedEvents: [
      A.GOLD_HARVEST, A.CROP_HARVESTED, A.DECORATION_PLACED,
      A.FLOWERS_PLANTED, A.ITEM_SOLD_TO_NPC,
      A.SEASON_CHANGED, A.FESTIVAL_STARTED,
    ],
    importanceMultiplier: {
      [A.GOLD_HARVEST]: 2.0,     // Сара ценит совершенство
      [A.DECORATION_PLACED]: 1.5,
    },
  },
  {
    npcId: 'victor',
    // Виктор: общество, порядок, ответственность
    observedEvents: [
      A.HOMESTEAD_EXPANDED, A.EARNINGS_MILESTONE,
      A.QUEST_COMPLETED, A.FRIENDSHIP_MILESTONE,
      A.MULTIPLE_NPC_VISITED, A.FESTIVAL_STARTED,
      A.SEASON_CHANGED,
    ],
  },
  {
    npcId: 'zoya',
    // Зоя: фрагменты, ощущения, дежавю
    observedEvents: [
      A.NIGHT_WALK, A.CROP_HARVESTED, A.PLAYER_RETURNED,
      A.SEASON_CHANGED, A.WEATHER_CHANGED,
    ],
  },
  {
    npcId: 'ira',
    // Ира: люди, связи, забота — центр информационной сети
    observedEvents: [
      A.NPC_VISITED, A.NPC_GIFTED, A.PLAYER_RETURNED,
      A.MULTIPLE_NPC_VISITED, A.QUEST_COMPLETED,
      A.FRIENDSHIP_MILESTONE, A.ITEM_SOLD,
      A.FESTIVAL_STARTED, A.SEASON_CHANGED,
    ],
    importanceMultiplier: {
      [A.NPC_VISITED]: 1.5,      // Ира замечает социальную активность
      [A.PLAYER_RETURNED]: 2.0,
    },
  },
];
```

### Template System (zero LLM cost)

```typescript
// apps/server/src/npc-service/awareness/ObservationTemplates.ts

import { PlayerActionType as A } from '../types/responsive-types';

interface EventContext {
  playerName: string;
  [key: string]: unknown;
}

/**
 * Шаблоны наблюдений — описания на русском языке.
 * Каждый шаблон принимает контекст события и возвращает текст наблюдения.
 *
 * ПРИНЦИП: шаблоны генерируют 90%+ наблюдений без вызова LLM.
 * Стоимость: $0.00 за шаблонное наблюдение.
 */
export const OBSERVATION_TEMPLATES: Record<string, (ctx: EventContext) => string> = {
  // ─── Фермерские ───────────────────────────────────────────────
  [A.CROP_PLANTED]: (ctx) =>
    `Видел(а), что ${ctx.playerName} посадил(а) ${ctx.cropName} на своём участке.`,

  [A.CROP_HARVESTED]: (ctx) =>
    `${ctx.playerName} собрал(а) урожай ${ctx.cropName} (${ctx.quantity} шт.).`,

  [A.CROP_NEGLECTED]: (ctx) =>
    `Заметил(а), что грядки ${ctx.playerName} подсохли — давно не поливал(а).`,

  [A.ALL_CROPS_TENDED]: (ctx) =>
    `${ctx.playerName} ухаживает за грядками каждый день уже ${ctx.days} дней подряд. Настоящий хозяин.`,

  [A.FIRST_CROP_TYPE]: (ctx) =>
    `${ctx.playerName} впервые посадил(а) ${ctx.cropName}. Новый опыт!`,

  [A.GOLD_HARVEST]: (ctx) =>
    `${ctx.playerName} вырастил(а) идеальный экземпляр ${ctx.cropName} — золотое качество!`,

  // ─── Экономические ────────────────────────────────────────────
  [A.ITEM_SOLD]: (ctx) =>
    `${ctx.playerName} продал(а) ${ctx.itemName} (${ctx.quantity} шт.) на рынке.`,

  [A.ITEM_SOLD_TO_NPC]: (ctx) =>
    `${ctx.playerName} принёс(ла) мне ${ctx.itemName}. ${ctx.quantity > 5 ? 'Целую корзину!' : 'Приятно.'}`,

  [A.SAME_ITEM_STREAK]: (ctx) =>
    `${ctx.playerName} уже ${ctx.days} дней подряд продаёт только ${ctx.itemName}. Рынок завален!`,

  [A.EARNINGS_MILESTONE]: (ctx) =>
    `Слышал(а), что ${ctx.playerName} заработал(а) уже ${ctx.amount} монет. Дела идут!`,

  [A.ITEM_BOUGHT]: (ctx) =>
    `${ctx.playerName} купил(а) ${ctx.itemName} в магазине.`,

  // ─── Социальные ───────────────────────────────────────────────
  [A.NPC_VISITED]: (ctx) =>
    `${ctx.playerName} заходил(а) ко мне. ${ctx.visitCount > 5 ? 'Частый гость!' : ''}`,

  [A.NPC_GIFTED]: (ctx) =>
    `${ctx.playerName} подарил(а) мне ${ctx.itemName}. ${ctx.itemQuality === 'gold' ? 'Потрясающее качество!' : 'Приятный жест.'}`,

  [A.QUEST_COMPLETED]: (ctx) =>
    `${ctx.playerName} помог(ла) ${ctx.npcName} с заданием. Молодец!`,

  [A.FRIENDSHIP_MILESTONE]: (ctx) =>
    `Мы с ${ctx.playerName} стали ближе. ${ctx.level === 'friend' ? 'Настоящая дружба.' : 'Приятно.'}`,

  [A.PLAYER_RETURNED]: (ctx) => {
    const days = ctx.daysAbsent as number;
    if (days >= 14) return `${ctx.playerName} вернулся(ась) после долгого отсутствия (${days} дней). Я волновался(ась).`;
    if (days >= 7) return `${ctx.playerName} вернулся(ась) — не видел(а) уже ${days} дней.`;
    return `${ctx.playerName} снова здесь — пропадал(а) ${days} дня.`;
  },

  [A.MULTIPLE_NPC_VISITED]: (ctx) =>
    `${ctx.playerName} сегодня поговорил(а) с ${ctx.count} жителями. Общительный человек!`,

  // ─── Строительство / декор ────────────────────────────────────
  [A.HOMESTEAD_EXPANDED]: (ctx) =>
    `${ctx.playerName} расширил(а) свой участок! Город растёт.`,

  [A.DECORATION_PLACED]: (ctx) =>
    `${ctx.playerName} украсил(а) участок: поставил(а) ${ctx.itemName}.`,

  [A.FLOWERS_PLANTED]: (ctx) =>
    `${ctx.playerName} посадил(а) цветы (${ctx.flowerName}) на участке!`,

  [A.TREE_PLANTED]: (ctx) =>
    `${ctx.playerName} посадил(а) дерево на участке. Хороший выбор.`,

  // ─── Мировые ──────────────────────────────────────────────────
  [A.SEASON_CHANGED]: (ctx) =>
    `Наступил(а) ${ctx.season}. Новый сезон, новые возможности.`,

  [A.WEATHER_CHANGED]: (ctx) =>
    `Погода изменилась: ${ctx.weather}.`,

  [A.FESTIVAL_STARTED]: (ctx) =>
    `Сегодня фестиваль: ${ctx.festivalName}!`,

  [A.NIGHT_WALK]: (ctx) =>
    `Видел(а) ${ctx.playerName} на улице ночью.`,
};
```

### Importance Scoring

```typescript
// apps/server/src/npc-service/awareness/ImportanceRules.ts

import { PlayerActionType as A } from '../types/responsive-types';

/**
 * Статические оценки важности событий.
 * 90%+ событий получают фиксированный score без вызова LLM.
 *
 * Шкала 1-10:
 * 1-2: Рутина (погода, обычная покупка)
 * 3-4: Заметное (визит, продажа, посадка)
 * 5-6: Значимое (подарок, квест, расширение)
 * 7-8: Важное (первый подарок, редкий предмет, milestone)
 * 9-10: Ключевое (возврат после долгого отсутствия, gold harvest)
 */
export const STATIC_IMPORTANCE: Partial<Record<PlayerActionType, number>> = {
  // Фермерские
  [A.CROP_PLANTED]: 3,
  [A.CROP_WATERED]: 1,
  [A.CROP_HARVESTED]: 4,
  [A.CROP_NEGLECTED]: 5,
  [A.ALL_CROPS_TENDED]: 6,
  [A.FIRST_CROP_TYPE]: 5,
  [A.GOLD_HARVEST]: 8,

  // Экономические
  [A.ITEM_SOLD]: 3,
  [A.ITEM_BOUGHT]: 2,
  [A.ITEM_SOLD_TO_NPC]: 4,
  [A.SAME_ITEM_STREAK]: 5,
  [A.EARNINGS_MILESTONE]: 6,

  // Социальные
  [A.NPC_VISITED]: 3,
  [A.NPC_GIFTED]: 7,
  [A.QUEST_COMPLETED]: 7,
  [A.FRIENDSHIP_MILESTONE]: 8,
  [A.MULTIPLE_NPC_VISITED]: 4,

  // Строительство
  [A.HOMESTEAD_EXPANDED]: 6,
  [A.DECORATION_PLACED]: 3,
  [A.FLOWERS_PLANTED]: 4,
  [A.TREE_PLANTED]: 5,

  // Мировые
  [A.SEASON_CHANGED]: 2,
  [A.WEATHER_CHANGED]: 2,
  [A.FESTIVAL_STARTED]: 5,
  [A.NIGHT_WALK]: 3,
};

/**
 * Типы событий, которые требуют LLM scoring (Haiku).
 * Это "особые" случаи, где контекст влияет на importance:
 * - Первый подарок конкретному NPC (зависит от предмета)
 * - Возврат после длительного отсутствия (зависит от длительности)
 * - Редкий предмет (зависит от редкости)
 */
export const NEEDS_LLM_SCORING: Set<PlayerActionType> = new Set([
  // Пустой набор — все события покрыты статическим scoring.
  // LLM scoring вызывается только когда NPC importanceMultiplier > 1
  // и итоговый score попадает в диапазон 6-7 (граничный случай).
]);

/** Вычислить importance с учётом NPC multiplier */
export function calculateImportance(
  baseImportance: number,
  npcMultiplier: number | undefined
): number {
  const multiplied = baseImportance * (npcMultiplier ?? 1.0);
  return Math.min(10, Math.round(multiplied));
}
```

### Deduplication & Cooldown

```typescript
// apps/server/src/npc-service/awareness/EventAggregator.ts

/**
 * Предотвращает дублирование наблюдений:
 *
 * 1. Cooldown: один тип события + один игрок + один NPC = max 1 наблюдение в день
 * 2. Aggregation: "Player sold 15 tomatoes today" вместо 15 отдельных memories
 * 3. Dedup by hash: одинаковое описание не создаётся повторно
 */

/** Redis key format: awareness:cooldown:{npcId}:{playerId}:{actionType} */
const COOLDOWN_KEY_PREFIX = 'awareness:cooldown';

/** Cooldown duration: 24 реальных часа */
const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Redis key format: awareness:aggregate:{npcId}:{playerId}:{actionType}:{date} */
const AGGREGATE_KEY_PREFIX = 'awareness:aggregate';

export interface AggregateState {
  count: number;
  totalQuantity: number;
  lastItemName: string;
  createdAt: number;
}

/** Типы событий, которые агрегируются вместо создания отдельных записей */
const AGGREGATABLE_EVENTS = new Set([
  'item_sold',
  'crop_harvested',
  'crop_planted',
  'crop_watered',
]);

export class EventAggregator {
  constructor(private readonly redis: RedisClient) {}

  /**
   * Проверить, нужно ли создавать наблюдение для данного события.
   * Returns: 'create' | 'aggregate' | 'skip'
   */
  async checkEvent(
    npcId: string,
    playerId: string,
    actionType: string
  ): Promise<'create' | 'aggregate' | 'skip'> {
    const cooldownKey = `${COOLDOWN_KEY_PREFIX}:${npcId}:${playerId}:${actionType}`;

    // Check cooldown
    const exists = await this.redis.exists(cooldownKey);
    if (exists) {
      // Cooldown active — check if aggregatable
      if (AGGREGATABLE_EVENTS.has(actionType)) {
        return 'aggregate';
      }
      return 'skip';
    }

    // No cooldown — create new observation and set cooldown
    await this.redis.set(cooldownKey, '1', 'PX', DEFAULT_COOLDOWN_MS);
    return 'create';
  }

  /**
   * Обновить агрегированное состояние.
   * При достижении порога (end of day) — генерирует summary observation.
   */
  async aggregate(
    npcId: string,
    playerId: string,
    actionType: string,
    quantity: number,
    itemName: string
  ): Promise<string | null> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${AGGREGATE_KEY_PREFIX}:${npcId}:${playerId}:${actionType}:${today}`;

    const current = await this.redis.get(key);
    const state: AggregateState = current
      ? JSON.parse(current)
      : { count: 0, totalQuantity: 0, lastItemName: itemName, createdAt: Date.now() };

    state.count += 1;
    state.totalQuantity += quantity;
    state.lastItemName = itemName;

    await this.redis.set(key, JSON.stringify(state), 'EX', 86400); // TTL: 24h

    // Генерируем summary каждые 5 агрегированных событий
    if (state.count % 5 === 0) {
      return `${state.lastItemName}: ${state.totalQuantity} шт. за сегодня`;
    }

    return null; // ещё не время для summary
  }
}
```

### ActionAwarenessService — основной класс

```typescript
// apps/server/src/npc-service/awareness/ActionAwarenessService.ts

import { OBSERVATION_TEMPLATES } from './ObservationTemplates';
import { STATIC_IMPORTANCE, calculateImportance } from './ImportanceRules';
import { NPC_OBSERVER_CONFIGS } from './NpcObserverConfig';
import { EventAggregator } from './EventAggregator';
import type { PlayerActionEvent, NpcObserverConfig } from '../types/responsive-types';

export class ActionAwarenessService {
  private observerMap: Map<string, NpcObserverConfig>;

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly eventAggregator: EventAggregator,
    private readonly redis: RedisClient
  ) {
    // Индексируем конфигурацию по npcId
    this.observerMap = new Map(
      NPC_OBSERVER_CONFIGS.map((c) => [c.npcId, c])
    );
  }

  /**
   * Обработать игровое событие.
   * Для каждого NPC, чья "линза" включает этот тип события:
   * 1. Проверить cooldown/dedup
   * 2. Сгенерировать описание из шаблона
   * 3. Вычислить importance (статически)
   * 4. Создать observation memory
   *
   * Полностью async, non-blocking.
   */
  async onPlayerAction(event: PlayerActionEvent): Promise<void> {
    const template = OBSERVATION_TEMPLATES[event.actionType];
    if (!template) {
      // Неизвестный тип события — пропускаем
      return;
    }

    // Найти всех NPC, которые замечают этот тип события
    const observers = NPC_OBSERVER_CONFIGS.filter((config) =>
      config.observedEvents.includes(event.actionType)
    );

    for (const observer of observers) {
      try {
        await this.processForNpc(observer, event, template);
      } catch (error) {
        console.warn(
          `[ActionAwareness] Error processing event for NPC ${observer.npcId}:`,
          error
        );
        // Не блокируем обработку остальных NPC
      }
    }
  }

  private async processForNpc(
    observer: NpcObserverConfig,
    event: PlayerActionEvent,
    template: (ctx: Record<string, unknown>) => string
  ): Promise<void> {
    // 1. Cooldown / dedup check
    const decision = await this.eventAggregator.checkEvent(
      observer.npcId,
      event.playerId,
      event.actionType
    );

    if (decision === 'skip') return;

    if (decision === 'aggregate') {
      const summary = await this.eventAggregator.aggregate(
        observer.npcId,
        event.playerId,
        event.actionType,
        (event.data.quantity as number) ?? 1,
        (event.data.itemName as string) ?? event.actionType
      );
      if (!summary) return; // ещё не время для summary observation
      // Создаём агрегированное наблюдение
      const description = `${event.playerName} сегодня: ${summary}`;
      await this.createObservation(observer, event, description, 4);
      return;
    }

    // 2. Генерируем описание из шаблона
    const context = { playerName: event.playerName, ...event.data };
    const description = template(context);

    // 3. Вычисляем importance
    const baseImportance = STATIC_IMPORTANCE[event.actionType] ?? 3;
    const multiplier = observer.importanceMultiplier?.[event.actionType];
    const importance = calculateImportance(baseImportance, multiplier);

    // 4. Создаём observation memory
    await this.createObservation(observer, event, description, importance);
  }

  private async createObservation(
    observer: NpcObserverConfig,
    event: PlayerActionEvent,
    description: string,
    importance: number
  ): Promise<void> {
    await this.memoryRepository.createMemory({
      agentId: observer.npcId,
      description,
      importance,
      memoryType: 'observation',
      relatedEntities: [event.playerId],
      createdAt: new Date(event.timestamp),
    });
  }

  /**
   * Получить последние наблюдения NPC о конкретном игроке.
   * Используется SystemPromptBuilder для секции "ЧТО ТЫ ЗАМЕТИЛ(А)".
   */
  async getRecentObservations(
    npcId: string,
    playerId: string,
    limit: number = 5
  ): Promise<Array<{ description: string; createdAt: Date }>> {
    return this.memoryRepository.getMemoriesByType(
      npcId,
      'observation',
      playerId,
      limit
    );
  }
}
```

---

## Part 3: GossipService — Детальный дизайн

### Назначение

GossipService создаёт живую социальную сеть между NPC. Когда NPC A имеет наблюдение об игроке с importance >= 5 и встречается с NPC B (оба в одной локации по расписанию), A может "рассказать" B об этом наблюдении. Это создаёт эффект "город знает о тебе" — Ира может упомянуть, что Марко рассказывал о подарке игрока, даже если игрок никогда не говорил с Ирой об этом.

### Gossip Propagation Rules

```
Правила распространения:

1. ИСТОЧНИК: NPC A имеет memory с importance >= 5 и memoryType = 'observation'
2. УСЛОВИЕ: NPC A и NPC B находятся в одной локации по расписанию
3. ВЕРОЯТНОСТЬ: gossip_rate[A] × relationship_factor[A,B]
4. СОЗДАНИЕ: новая memory для NPC B:
   - description: "{NPC_A.name} рассказал мне, что {original_description}"
   - importance: original_importance - 2 (минимум 1)
   - memoryType: 'gossip'
   - hopCount: original_hopCount + 1
5. ОГРАНИЧЕНИЯ:
   - Max 2 хопа (A→B→C, дальше не распространяется)
   - Один gossip на пару NPC в 4 часа
   - Один gossip на memory (не повторять одно и то же)
   - NPC с gossip_rate = 0 не распространяют

NPC gossip rates (из NPC Personality Bible):
  - Ира:    80% (центр информационной сети)
  - Марко:  60% (экстраверт, делится новостями)
  - Лена:   40% (делится наблюдениями о природе/участках)
  - Анна:   40% (делится интересными фактами)
  - Сара:   30% (сдержанная, но делится мнениями)
  - Виктор: 50% (следит за жизнью города)
  - Зоя:    10% (почти не общается)
  - Олег:   20% (молчалив, но иногда роняет фразу)
```

### NPC Co-location Schedule

```typescript
// apps/server/src/npc-service/social/GossipRules.ts

/** Gossip rates для каждого NPC (вероятность поделиться наблюдением) */
export const NPC_GOSSIP_RATES: Record<string, number> = {
  ira: 0.80,
  marko: 0.60,
  victor: 0.50,
  lena: 0.40,
  anna: 0.40,
  sara: 0.30,
  oleg: 0.20,
  zoya: 0.10,
};

/**
 * Расписание совместного нахождения NPC в одной локации.
 * Gossip может произойти только когда два NPC "встретились".
 *
 * Источник: NPC Personality Bible, ежедневные расписания.
 */
export const NPC_COLOCATION_SCHEDULE: Array<{
  npcA: string;
  npcB: string;
  location: string;
  timeRange: [string, string]; // ["12:00", "13:00"]
}> = [
  // Обед в кафе Иры (12:00-13:00)
  { npcA: 'marko', npcB: 'ira', location: 'cafe', timeRange: ['12:00', '13:00'] },
  { npcA: 'victor', npcB: 'ira', location: 'cafe', timeRange: ['12:00', '13:00'] },

  // Вечер в баре (18:30-21:00)
  { npcA: 'marko', npcB: 'oleg', location: 'bar', timeRange: ['18:30', '21:00'] },
  { npcA: 'marko', npcB: 'victor', location: 'bar', timeRange: ['18:30', '20:00'] },
  { npcA: 'oleg', npcB: 'victor', location: 'bar', timeRange: ['18:30', '20:00'] },

  // Парк (15:00-17:00)
  { npcA: 'anna', npcB: 'lena', location: 'park', timeRange: ['15:00', '16:00'] },

  // Рыночная улица (13:00-17:00) — Марко и Сара напротив
  { npcA: 'marko', npcB: 'sara', location: 'market', timeRange: ['13:00', '17:00'] },
];

/** Максимальное количество хопов gossip */
export const MAX_GOSSIP_HOPS = 2;

/** Минимальная importance для начала gossip */
export const MIN_GOSSIP_IMPORTANCE = 5;

/** Снижение importance на каждый хоп */
export const IMPORTANCE_DECAY_PER_HOP = 2;

/** Cooldown между gossip rounds (4 реальных часа) */
export const GOSSIP_ROUND_COOLDOWN_MS = 4 * 60 * 60 * 1000;
```

### GossipService Implementation

```typescript
// apps/server/src/npc-service/social/GossipService.ts

import {
  NPC_GOSSIP_RATES,
  NPC_COLOCATION_SCHEDULE,
  MAX_GOSSIP_HOPS,
  MIN_GOSSIP_IMPORTANCE,
  IMPORTANCE_DECAY_PER_HOP,
  GOSSIP_ROUND_COOLDOWN_MS,
} from './GossipRules';

interface GossipableMemory {
  id: string;
  agentId: string;       // NPC, который имеет это наблюдение
  description: string;
  importance: number;
  memoryType: 'observation' | 'gossip';
  hopCount: number;
  relatedEntities: string[];
  createdAt: Date;
}

export class GossipService {
  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly gossipLogRepository: GossipLogRepository,
    private readonly redis: RedisClient
  ) {}

  /**
   * Обработать раунд сплетен.
   * Вызывается по расписанию каждые 4 реальных часа.
   *
   * Для каждой пары NPC, находящихся в одной локации:
   * 1. Получить high-importance memories источника
   * 2. Отфильтровать уже переданные
   * 3. Roll вероятность на основе gossip_rate
   * 4. Создать gossip memory для получателя
   */
  async processGossipRound(): Promise<number> {
    // Check global cooldown
    const lastRound = await this.redis.get('gossip:last_round');
    if (lastRound && Date.now() - parseInt(lastRound) < GOSSIP_ROUND_COOLDOWN_MS) {
      return 0;
    }

    let gossipCount = 0;
    const currentHour = new Date().getHours();
    const currentTime = `${String(currentHour).padStart(2, '0')}:00`;

    // Найти активные пары NPC (в одной локации сейчас)
    const activePairs = NPC_COLOCATION_SCHEDULE.filter((pair) =>
      this.isTimeInRange(currentTime, pair.timeRange)
    );

    for (const pair of activePairs) {
      // Gossip в обе стороны
      gossipCount += await this.tryGossip(pair.npcA, pair.npcB);
      gossipCount += await this.tryGossip(pair.npcB, pair.npcA);
    }

    // Update global cooldown
    await this.redis.set('gossip:last_round', String(Date.now()));

    console.log(
      `[GossipService] Round complete: ${gossipCount} gossip items created`
    );
    return gossipCount;
  }

  private async tryGossip(sourceId: string, targetId: string): Promise<number> {
    // 1. Проверить gossip rate источника
    const gossipRate = NPC_GOSSIP_RATES[sourceId] ?? 0;
    if (Math.random() > gossipRate) return 0;

    // 2. Получить high-importance memories источника
    const memories = await this.memoryRepository.getGossipableMemories(
      sourceId,
      MIN_GOSSIP_IMPORTANCE,
      MAX_GOSSIP_HOPS
    );

    let count = 0;
    for (const memory of memories) {
      // 3. Проверить, не передавали ли уже это наблюдение этому NPC
      const alreadyShared = await this.gossipLogRepository.wasShared(
        memory.id,
        sourceId,
        targetId
      );
      if (alreadyShared) continue;

      // 4. Создать gossip memory для получателя
      const gossipDescription = this.createGossipDescription(
        sourceId,
        memory.description
      );
      const gossipImportance = Math.max(
        1,
        memory.importance - IMPORTANCE_DECAY_PER_HOP
      );

      await this.memoryRepository.createMemory({
        agentId: targetId,
        description: gossipDescription,
        importance: gossipImportance,
        memoryType: 'gossip',
        hopCount: (memory.hopCount ?? 0) + 1,
        relatedEntities: memory.relatedEntities,
        sourceMemoryId: memory.id,
        createdAt: new Date(),
      });

      // 5. Записать в лог
      await this.gossipLogRepository.logGossip({
        sourceNpcId: sourceId,
        targetNpcId: targetId,
        memoryId: memory.id,
        createdAt: new Date(),
      });

      count++;
      // Max 1 gossip per pair per round
      break;
    }

    return count;
  }

  /**
   * Создать описание gossip memory.
   * Формат: "{NPC_name} рассказал мне, что {observation}"
   */
  private createGossipDescription(sourceNpcId: string, originalDescription: string): string {
    const npcNames: Record<string, string> = {
      marko: 'Марко', anna: 'Анна', sara: 'Сара', oleg: 'Олег',
      lena: 'Лена', victor: 'Виктор', zoya: 'Зоя', ira: 'Ира',
    };
    const sourceName = npcNames[sourceNpcId] ?? sourceNpcId;

    // Убираем "Видел(а), что" из начала, если есть
    const cleaned = originalDescription
      .replace(/^Видел\(а\),?\s*что\s*/i, '')
      .replace(/^Заметил\(а\),?\s*что\s*/i, '')
      .replace(/^Слышал\(а\),?\s*что\s*/i, '');

    return `${sourceName} рассказал(а) мне, что ${cleaned}`;
  }

  /**
   * Получить gossip items для конкретного NPC и игрока.
   * Используется SystemPromptBuilder для секции "СЛУХИ".
   */
  async getRecentGossip(
    npcId: string,
    playerId: string,
    limit: number = 3
  ): Promise<Array<{ description: string; createdAt: Date }>> {
    return this.memoryRepository.getMemoriesByType(
      npcId,
      'gossip',
      playerId,
      limit
    );
  }

  private isTimeInRange(current: string, range: [string, string]): boolean {
    return current >= range[0] && current <= range[1];
  }
}
```

---

## Part 4: OrganicQuestGenerator — Детальный дизайн

### Назначение

OrganicQuestGenerator создаёт квесты органически из рефлексий NPC, а не из скриптовой базы данных. Когда ежедневная рефлексия NPC содержит "потребность" или "желание", система проверяет соответствие с шаблоном квеста и, при совпадении, генерирует квест через Haiku. Квест предлагается игроку с наивысшим уровнем отношений.

### Quest State Machine

```
                ┌─────────┐
                │ PENDING │ (сгенерирован, ожидает предложения)
                └────┬────┘
                     │ NPC встречает подходящего игрока
                     ▼
                ┌─────────┐
                │ OFFERED │ (предложен игроку в диалоге)
                └────┬────┘
              ┌──────┼──────┐
              │      │      │
          принял  отклонил  timeout (3 дня)
              │      │      │
              ▼      ▼      ▼
         ┌────────┐ ┌──────────┐ ┌─────────┐
         │ ACTIVE │ │ DECLINED │ │ EXPIRED │
         └────┬───┘ └──────────┘ └─────────┘
              │
        ┌─────┼─────┐
        │           │
    выполнен    timeout (deadline)
        │           │
        ▼           ▼
   ┌───────────┐ ┌─────────┐
   │ COMPLETED │ │ FAILED  │
   └───────────┘ └─────────┘
```

### Quest Templates

```typescript
// apps/server/src/npc-service/quests/QuestTemplates.ts

export enum QuestTemplate {
  /** "Можешь принести мне клубнику?" */
  BRING_ITEM = 'bring_item',
  /** "Помоги починить полку в магазине" */
  HELP_TASK = 'help_task',
  /** "Передай Марко, что я жду его в библиотеке" */
  DELIVER_MESSAGE = 'deliver_msg',
  /** "Проверь, почему в лесу странные огни" */
  INVESTIGATE = 'investigate',
  /** "Приходи завтра утром, покажу кое-что" */
  VISIT_TOMORROW = 'visit',
}

export type QuestStatus =
  | 'pending'
  | 'offered'
  | 'active'
  | 'completed'
  | 'failed'
  | 'declined'
  | 'expired';

export interface QuestDefinition {
  template: QuestTemplate;
  npcId: string;
  title: string;
  description: string;
  objective: string;
  reward: QuestReward;
  deadlineHours: number; // в реальных часах
}

export interface QuestReward {
  coins: number;
  friendshipPoints: number;
  item?: { name: string; quantity: number };
}

/**
 * Ключевые слова в рефлексиях, которые сигнализируют о потребности.
 * Regex patterns для русского языка.
 */
export const NEED_KEYWORDS: Array<{
  pattern: RegExp;
  template: QuestTemplate;
  priority: number;
}> = [
  {
    pattern: /(?:нужн[аоы]|мне бы|принеси|не хватает)\s+(\S+)/i,
    template: QuestTemplate.BRING_ITEM,
    priority: 1,
  },
  {
    pattern: /(?:помо[гч]и|нужна помощь|не справля)/i,
    template: QuestTemplate.HELP_TASK,
    priority: 2,
  },
  {
    pattern: /(?:перед[ай]|скажи|сообщи)\s+(\S+)/i,
    template: QuestTemplate.DELIVER_MESSAGE,
    priority: 3,
  },
  {
    pattern: /(?:стран(?:но|ные)|что-то не так|проверь|разузнай)/i,
    template: QuestTemplate.INVESTIGATE,
    priority: 4,
  },
  {
    pattern: /(?:приходи|загляни|покажу|завтра)/i,
    template: QuestTemplate.VISIT_TOMORROW,
    priority: 5,
  },
];

/** Настройки генерации квестов */
export const QUEST_CONFIG = {
  /** Cooldown между квестами от одного NPC (в реальных часах) */
  cooldownHours: 48,
  /** Максимум активных квестов на игрока */
  maxActivePerPlayer: 3,
  /** Максимум pending квестов на NPC */
  maxPendingPerNpc: 1,
  /** Deadline по умолчанию (в реальных часах) */
  defaultDeadlineHours: 72,
};
```

### Quest Generation via Haiku

```typescript
// apps/server/src/npc-service/quests/OrganicQuestGenerator.ts

import { NEED_KEYWORDS, QUEST_CONFIG, QuestTemplate } from './QuestTemplates';
import type { QuestDefinition, QuestStatus, QuestReward } from './QuestTemplates';

export class OrganicQuestGenerator {
  constructor(
    private readonly questRepository: QuestRepository,
    private readonly memoryRepository: MemoryRepository,
    private readonly llmClient: LLMClient, // Haiku
    private readonly redis: RedisClient
  ) {}

  /**
   * Проверить рефлексии всех NPC и сгенерировать квесты при обнаружении потребностей.
   * Вызывается ежедневно, после генерации рефлексий.
   */
  async checkForQuests(npcIds: string[]): Promise<number> {
    let generated = 0;

    for (const npcId of npcIds) {
      try {
        const quest = await this.tryGenerateQuest(npcId);
        if (quest) generated++;
      } catch (error) {
        console.warn(`[QuestGenerator] Error for NPC ${npcId}:`, error);
      }
    }

    console.log(`[QuestGenerator] Generated ${generated} quests`);
    return generated;
  }

  private async tryGenerateQuest(npcId: string): Promise<QuestDefinition | null> {
    // 1. Проверить cooldown
    const cooldownKey = `quest:cooldown:${npcId}`;
    const lastGeneration = await this.redis.get(cooldownKey);
    if (lastGeneration) return null;

    // 2. Проверить лимит pending квестов
    const pendingCount = await this.questRepository.countByStatus(npcId, 'pending');
    if (pendingCount >= QUEST_CONFIG.maxPendingPerNpc) return null;

    // 3. Получить последние рефлексии
    const reflections = await this.memoryRepository.getMemoriesByType(
      npcId,
      'reflection',
      null, // не фильтруем по игроку
      5
    );

    if (reflections.length === 0) return null;

    // 4. Найти ключевые слова потребности
    const reflectionText = reflections.map((r) => r.description).join(' ');
    const matchedKeyword = NEED_KEYWORDS.find((kw) =>
      kw.pattern.test(reflectionText)
    );

    if (!matchedKeyword) return null;

    // 5. Выбрать игрока с наивысшим уровнем отношений
    const bestPlayer = await this.questRepository.findBestQuestTarget(npcId);
    if (!bestPlayer) return null;

    // 6. Сгенерировать квест через Haiku
    const quest = await this.generateQuestViaLLM(
      npcId,
      matchedKeyword.template,
      reflectionText,
      bestPlayer.playerName
    );

    if (!quest) return null;

    // 7. Сохранить квест
    await this.questRepository.create({
      ...quest,
      npcId,
      targetPlayerId: bestPlayer.playerId,
      status: 'pending' as QuestStatus,
      createdAt: new Date(),
      deadline: new Date(Date.now() + quest.deadlineHours * 3600 * 1000),
    });

    // 8. Установить cooldown
    await this.redis.set(
      cooldownKey,
      '1',
      'EX',
      QUEST_CONFIG.cooldownHours * 3600
    );

    return quest;
  }

  /**
   * Генерация квеста через Haiku.
   * Input: ~200 tokens (reflection + template + context)
   * Output: ~100 tokens (title, description, objective, reward)
   * Cost: ~$0.001 per quest
   */
  private async generateQuestViaLLM(
    npcId: string,
    template: QuestTemplate,
    reflectionText: string,
    playerName: string
  ): Promise<QuestDefinition | null> {
    const npcNames: Record<string, string> = {
      marko: 'Марко', anna: 'Анна', sara: 'Сара', oleg: 'Олег',
      lena: 'Лена', victor: 'Виктор', zoya: 'Зоя', ira: 'Ира',
    };

    const prompt = `Ты — система генерации квестов для NPC в игре.
NPC: ${npcNames[npcId] ?? npcId}
Рефлексия NPC: "${reflectionText}"
Тип квеста: ${template}
Игрок: ${playerName}

Сгенерируй квест в формате JSON:
{"title":"...","description":"...","objective":"...","reward":{"coins":N,"friendshipPoints":N},"deadlineHours":N}

Правила:
- title: 3-5 слов, от лица NPC
- description: 1-2 предложения, что NPC скажет игроку
- objective: конкретное задание (принести N предметов / поговорить с X / сходить в Y)
- reward: coins 50-200, friendshipPoints 1-3
- deadlineHours: 24-72
Ответь только JSON, без пояснений.`;

    try {
      const response = await this.llmClient.complete({
        model: 'haiku',
        prompt,
        maxTokens: 150,
      });

      return JSON.parse(response.text) as QuestDefinition;
    } catch (error) {
      console.warn(`[QuestGenerator] LLM generation failed:`, error);
      return null;
    }
  }

  /**
   * Проверить, выполнен ли квест (вызывается при game events).
   */
  async checkQuestCompletion(
    playerId: string,
    event: PlayerActionEvent
  ): Promise<void> {
    const activeQuests = await this.questRepository.getActiveByPlayer(playerId);

    for (const quest of activeQuests) {
      if (this.isQuestFulfilled(quest, event)) {
        await this.questRepository.updateStatus(quest.id, 'completed');
        // NPC запоминает выполнение квеста
        await this.memoryRepository.createMemory({
          agentId: quest.npcId,
          description: `${event.playerName} помог(ла) мне с заданием "${quest.title}". Я очень благодарен(а)!`,
          importance: 7,
          memoryType: 'observation',
          relatedEntities: [playerId],
          createdAt: new Date(),
        });
      }
    }
  }

  private isQuestFulfilled(
    quest: QuestRecord,
    event: PlayerActionEvent
  ): boolean {
    // Simplified matching — full implementation would check objective specifics
    switch (quest.template) {
      case QuestTemplate.BRING_ITEM:
        return event.actionType === 'item_sold_to_npc' &&
               event.data.npcId === quest.npcId;
      case QuestTemplate.DELIVER_MESSAGE:
        return event.actionType === 'npc_visited' &&
               event.data.npcId === quest.objectiveNpcId;
      case QuestTemplate.VISIT_TOMORROW:
        return event.actionType === 'npc_visited' &&
               event.data.npcId === quest.npcId;
      default:
        return false;
    }
  }
}
```

---

## Part 5: NPCInitiativeService — Детальный дизайн

### Назначение

NPCInitiativeService переворачивает стандартную модель "игрок подходит к NPC". Теперь NPC **сами** инициируют взаимодействия: посещают участок игрока, отправляют письма, подходят в городе и дарят ответные подарки. Это создаёт ощущение, что NPC — живые существа со своей волей.

### Initiative Types

```typescript
// apps/server/src/npc-service/initiative/NPCInitiativeService.ts

export enum InitiativeType {
  /** NPC идёт на участок игрока, чтобы прокомментировать / проверить */
  VISIT_HOMESTEAD = 'visit_homestead',
  /** NPC отправляет письмо в почтовый ящик */
  SEND_LETTER = 'send_letter',
  /** NPC подходит к игроку в городе и показывает "!" */
  APPROACH_PLAYER = 'approach_player',
  /** NPC дарит ответный подарок */
  GIFT_RETURN = 'gift_return',
}

export interface InitiativeAction {
  type: InitiativeType;
  npcId: string;
  targetPlayerId: string;
  priority: number;        // 1 = low, 5 = high
  data: Record<string, unknown>;
  scheduledFor: Date;
  expiresAt: Date;
}

/** Cooldown настройки для каждого типа инициативы */
const INITIATIVE_COOLDOWNS: Record<InitiativeType, number> = {
  [InitiativeType.VISIT_HOMESTEAD]: 3 * 24 * 60 * 60 * 1000,  // 3 реальных дня
  [InitiativeType.SEND_LETTER]: 2 * 24 * 60 * 60 * 1000,      // 2 реальных дня
  [InitiativeType.APPROACH_PLAYER]: 4 * 60 * 60 * 1000,        // 4 часа
  [InitiativeType.GIFT_RETURN]: 5 * 24 * 60 * 60 * 1000,       // 5 реальных дней
};
```

### Initiative Trigger Logic

```typescript
export class NPCInitiativeService {
  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly initiativeRepository: InitiativeRepository,
    private readonly letterGenerator: LetterGenerator,
    private readonly redis: RedisClient
  ) {}

  /**
   * Обработать инициативы для всех NPC.
   * Вызывается каждый реальный час.
   */
  async processInitiatives(npcIds: string[]): Promise<InitiativeAction[]> {
    const actions: InitiativeAction[] = [];

    for (const npcId of npcIds) {
      const initiatives = await this.checkNpcInitiatives(npcId);
      actions.push(...initiatives);
    }

    // Сохранить и запланировать
    for (const action of actions) {
      await this.initiativeRepository.schedule(action);
    }

    console.log(
      `[NPCInitiative] Scheduled ${actions.length} initiatives`
    );
    return actions;
  }

  private async checkNpcInitiatives(npcId: string): Promise<InitiativeAction[]> {
    const actions: InitiativeAction[] = [];

    // ─── 1. Visit Homestead ─────────────────────────────────────
    // Триггер: NPC имеет 3+ наблюдений об участке игрока (farming events)
    const farmingObservations = await this.memoryRepository.countByTypeAndCategory(
      npcId,
      'observation',
      ['crop_planted', 'crop_harvested', 'flowers_planted', 'tree_planted']
    );

    for (const { playerId, count } of farmingObservations) {
      if (count >= 3) {
        const canVisit = await this.checkCooldown(
          npcId,
          playerId,
          InitiativeType.VISIT_HOMESTEAD
        );
        if (canVisit) {
          actions.push({
            type: InitiativeType.VISIT_HOMESTEAD,
            npcId,
            targetPlayerId: playerId,
            priority: 2,
            data: { reason: 'farming_interest', observationCount: count },
            scheduledFor: this.nextMorning(), // визит утром
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
        }
      }
    }

    // ─── 2. Send Letter ─────────────────────────────────────────
    // Триггер: рефлексия NPC упоминает игрока
    const reflections = await this.memoryRepository.getMemoriesByType(
      npcId,
      'reflection',
      null,
      3
    );

    for (const reflection of reflections) {
      const mentionedPlayers = this.extractPlayerMentions(reflection.description);
      for (const playerId of mentionedPlayers) {
        const canSend = await this.checkCooldown(
          npcId,
          playerId,
          InitiativeType.SEND_LETTER
        );
        if (canSend) {
          actions.push({
            type: InitiativeType.SEND_LETTER,
            npcId,
            targetPlayerId: playerId,
            priority: 3,
            data: { reflectionId: reflection.id },
            scheduledFor: new Date(), // сразу
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
        }
      }
    }

    // ─── 3. Approach Player ─────────────────────────────────────
    // Триггер: NPC имеет срочную информацию (pending quest, new gossip, reaction)
    const pendingQuests = await this.questRepository?.countByStatus(npcId, 'pending') ?? 0;
    if (pendingQuests > 0) {
      // Подход к игроку при нахождении в одной локации
      const questTarget = await this.questRepository?.getPendingTarget(npcId);
      if (questTarget) {
        const canApproach = await this.checkCooldown(
          npcId,
          questTarget.playerId,
          InitiativeType.APPROACH_PLAYER
        );
        if (canApproach) {
          actions.push({
            type: InitiativeType.APPROACH_PLAYER,
            npcId,
            targetPlayerId: questTarget.playerId,
            priority: 4, // высокий приоритет — есть квест
            data: { reason: 'quest_offer', questId: questTarget.questId },
            scheduledFor: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
        }
      }
    }

    // ─── 4. Gift Return ─────────────────────────────────────────
    // Триггер: relationship >= casual_friend И игрок дарил подарок недавно
    const recentGifts = await this.memoryRepository.getRecentGiftsToNpc(npcId, 7); // 7 дней
    for (const gift of recentGifts) {
      const relationship = await this.getRelationshipLevel(npcId, gift.playerId);
      if (relationship >= 'casual_friend') {
        const canGift = await this.checkCooldown(
          npcId,
          gift.playerId,
          InitiativeType.GIFT_RETURN
        );
        if (canGift) {
          actions.push({
            type: InitiativeType.GIFT_RETURN,
            npcId,
            targetPlayerId: gift.playerId,
            priority: 2,
            data: {
              reason: 'gift_reciprocity',
              originalGift: gift.itemName,
              returnItem: this.selectReturnGift(npcId),
            },
            scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // на следующий день
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          });
        }
      }
    }

    return actions;
  }

  /**
   * Выбрать ответный подарок на основе профессии NPC.
   */
  private selectReturnGift(npcId: string): { name: string; quantity: number } {
    const NPC_GIFTS: Record<string, Array<{ name: string; quantity: number }>> = {
      marko: [
        { name: 'Свежий хлеб', quantity: 3 },
        { name: 'Булочка с корицей', quantity: 2 },
        { name: 'Тыквенный пирог', quantity: 1 },
      ],
      sara: [
        { name: 'Шоколадный эклер', quantity: 2 },
        { name: 'Пирожное', quantity: 3 },
      ],
      lena: [
        { name: 'Семена редких цветов', quantity: 1 },
        { name: 'Букет полевых цветов', quantity: 1 },
      ],
      oleg: [
        { name: 'Свежая рыба', quantity: 3 },
        { name: 'Рыбацкая приманка', quantity: 5 },
      ],
      anna: [
        { name: 'Книга рецептов', quantity: 1 },
        { name: 'Старая карта', quantity: 1 },
      ],
      ira: [
        { name: 'Особый кофе', quantity: 3 },
        { name: 'Тыквенный латте', quantity: 2 },
      ],
      victor: [
        { name: 'Официальная грамота', quantity: 1 },
      ],
      zoya: [
        { name: 'Лечебные травы', quantity: 5 },
        { name: 'Странный гриб', quantity: 1 },
      ],
    };

    const gifts = NPC_GIFTS[npcId] ?? [{ name: 'Небольшой подарок', quantity: 1 }];
    return gifts[Math.floor(Math.random() * gifts.length)];
  }

  private async checkCooldown(
    npcId: string,
    playerId: string,
    type: InitiativeType
  ): Promise<boolean> {
    const key = `initiative:cooldown:${npcId}:${playerId}:${type}`;
    const exists = await this.redis.exists(key);
    if (exists) return false;

    // Установить cooldown
    await this.redis.set(key, '1', 'PX', INITIATIVE_COOLDOWNS[type]);
    return true;
  }

  private nextMorning(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  }

  private extractPlayerMentions(text: string): string[] {
    // Simplified — full implementation would use player name registry
    return []; // Requires integration with player registry
  }

  private async getRelationshipLevel(
    npcId: string,
    playerId: string
  ): Promise<string> {
    // Simplified — full implementation reads from npc_agents.relationships
    return 'acquaintance';
  }
}
```

### Letter Generator

```typescript
// apps/server/src/npc-service/initiative/LetterGenerator.ts

/**
 * Генерирует содержимое писем от NPC к игрокам через Haiku.
 * Cost: ~$0.0005 per letter (minimal tokens)
 */
export class LetterGenerator {
  constructor(private readonly llmClient: LLMClient) {}

  async generateLetter(
    npcId: string,
    npcName: string,
    playerName: string,
    context: string // рефлексия или причина письма
  ): Promise<{ subject: string; body: string }> {
    const prompt = `Напиши короткое письмо от ${npcName} к ${playerName}.
Контекст: ${context}
Формат: 2-4 предложения, в стиле речи ${npcName}. Тёплое, личное.
Ответь JSON: {"subject":"...","body":"..."}`;

    try {
      const response = await this.llmClient.complete({
        model: 'haiku',
        prompt,
        maxTokens: 100,
      });
      return JSON.parse(response.text);
    } catch {
      // Fallback — шаблонное письмо
      return {
        subject: `Письмо от ${npcName}`,
        body: `Привет, ${playerName}! Заходи в гости, когда будет время. — ${npcName}`,
      };
    }
  }
}
```

---

## Part 6: Updated PromptBuilder — Обновлённый системный промпт

### Изменения в SystemPromptBuilder

Текущий `SystemPromptBuilder` (`apps/server/src/npc-service/ai/SystemPromptBuilder.ts`) имеет модульную архитектуру с секциями: identity, world, relationship, memory, guardrails, format. Мы добавляем две новых секции: **observations** и **gossip**.

### Обновлённая структура промпта

```
┌─────────────────────────────────────────────────┐
│ СИСТЕМНЫЙ ПРОМПТ (обновлённый)                  │
│                                                  │
│ 1. Идентичность (имя, возраст, профессия, био,  │
│    черты, стиль речи, интересы, страхи, цели)   │
│    ~400 токенов (сжатый формат)                  │
│                                                  │
│ 2. Текущий контекст (время, сезон, погода,      │
│    локация, активность)                          │
│    ~50 токенов                                   │
│                                                  │
│ 3. ЧТО ТЫ ЗАМЕТИЛ(А) О ЭТОМ ИГРОКЕ:  ◄── NEW  │
│    - наблюдение_1 (дата)                        │
│    - наблюдение_2 (дата)                        │
│    - ... до 5 наблюдений                        │
│    ~200 токенов                                  │
│                                                  │
│ 4. ТВОИ ВОСПОМИНАНИЯ ОБ ЭТОМ ИГРОКЕ:           │
│    - воспоминание_1 (дата)                      │
│    - ... до 10 воспоминаний                     │
│    ~400 токенов                                  │
│                                                  │
│ 5. ТВОИ НЕДАВНИЕ РАЗМЫШЛЕНИЯ:                   │
│    - рефлексия_1                                │
│    - ... до 5 рефлексий                         │
│    ~200 токенов                                  │
│                                                  │
│ 6. СЛУХИ (ЧТО ТЫ СЛЫШАЛ(А)):          ◄── NEW  │
│    - слух_1                                     │
│    - ... до 3 слухов                            │
│    ~100 токенов                                  │
│                                                  │
│ 7. Отношения с игроком                          │
│    ~50 токенов                                   │
│                                                  │
│ 8. Контекст игрока                              │
│    ~50 токенов                                   │
│                                                  │
│ 9. Правила                                      │
│    ~100 токенов (сжатый формат)                  │
│                                                  │
│ ИТОГО INPUT: ~1550 токенов (промпт)             │
│ + history: ~350 токенов (до 6 ходов)            │
│ = ~1900 токенов input                            │
│                                                  │
│ OUTPUT: ~100 токенов                             │
└─────────────────────────────────────────────────┘
```

### Реализация новых секций

```typescript
// Добавления в apps/server/src/npc-service/ai/SystemPromptBuilder.ts

export interface EnhancedPromptContext extends PromptContext {
  /** Наблюдения NPC о действиях игрока (от ActionAwarenessService) */
  observations?: Array<{ description: string; createdAt: Date }>;
  /** Слухи, которые NPC слышал о игроке (от GossipService) */
  gossip?: Array<{ description: string; createdAt: Date }>;
  /** Воспоминания NPC об игроке (от MemoryRepository) */
  memories?: Array<{ description: string; importance: number; createdAt: Date }>;
  /** Недавние рефлексии NPC */
  reflections?: Array<{ description: string; createdAt: Date }>;
}

/**
 * Секция "ЧТО ТЫ ЗАМЕТИЛ(А) О ЭТОМ ИГРОКЕ".
 * Показывает NPC, что он/она наблюдал(а) за действиями игрока.
 * Max 5 наблюдений, ~200 токенов.
 */
function buildObservationsSection(
  observations?: Array<{ description: string; createdAt: Date }>
): string {
  if (!observations || observations.length === 0) {
    return ''; // Секция опускается, если наблюдений нет
  }

  const lines = observations
    .slice(0, 5)
    .map((obs) => {
      const dateStr = formatGameDate(obs.createdAt);
      return `- ${obs.description} (${dateStr})`;
    });

  return `ЧТО ТЫ ЗАМЕТИЛ(А) ОБ ЭТОМ ИГРОКЕ:\n${lines.join('\n')}`;
}

/**
 * Секция "СЛУХИ (ЧТО ТЫ СЛЫШАЛ(А))".
 * Информация, полученная от других NPC через gossip.
 * Max 3 слуха, ~100 токенов.
 */
function buildGossipSection(
  gossip?: Array<{ description: string; createdAt: Date }>
): string {
  if (!gossip || gossip.length === 0) {
    return ''; // Секция опускается, если слухов нет
  }

  const lines = gossip
    .slice(0, 3)
    .map((g) => `- ${g.description}`);

  return `СЛУХИ (ЧТО ТЫ СЛЫШАЛ(А)):\n${lines.join('\n')}`;
}

/**
 * Обновлённая функция сборки промпта.
 * Добавляет observations и gossip секции между world и memory.
 */
export function buildEnhancedSystemPrompt(context: EnhancedPromptContext): string {
  const {
    persona,
    botName,
    playerName,
    meetingCount,
    worldContext,
    observations,
    gossip,
    memories,
    reflections,
  } = context;

  const sections: string[] = [
    buildIdentitySection(botName, persona),
    buildWorldSection(worldContext),
    buildObservationsSection(observations),
    buildMemoriesSection(memories),
    buildReflectionsSection(reflections),
    buildGossipSection(gossip),
    buildRelationshipSection(playerName, meetingCount),
    buildGuardrailsSection(botName, persona.role),
    buildFormatSection(),
  ];

  // Убираем пустые секции
  return sections.filter((s) => s.length > 0).join('\n\n').trim();
}

/**
 * Секция воспоминаний (заменяет hardcoded "(Пока нет воспоминаний)").
 */
function buildMemoriesSection(
  memories?: Array<{ description: string; importance: number; createdAt: Date }>
): string {
  if (!memories || memories.length === 0) {
    return ''; // Опускаем, если нет воспоминаний
  }

  const lines = memories
    .slice(0, 10)
    .map((m) => {
      const dateStr = formatGameDate(m.createdAt);
      return `- ${m.description} (${dateStr})`;
    });

  return `ТВОИ ВОСПОМИНАНИЯ ОБ ЭТОМ ИГРОКЕ:\n${lines.join('\n')}`;
}

/**
 * Секция рефлексий.
 */
function buildReflectionsSection(
  reflections?: Array<{ description: string; createdAt: Date }>
): string {
  if (!reflections || reflections.length === 0) {
    return '';
  }

  const lines = reflections
    .slice(0, 5)
    .map((r) => `- ${r.description}`);

  return `ТВОИ НЕДАВНИЕ РАЗМЫШЛЕНИЯ:\n${lines.join('\n')}`;
}

function formatGameDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'только что';
  if (diffHours < 24) return `${diffHours} ч. назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'вчера';
  return `${diffDays} дн. назад`;
}
```

### Обновлённые правила промпта

```typescript
/**
 * Обновлённая секция правил (сжатая версия для экономии токенов).
 * ~100 токенов вместо ~200.
 */
function buildEnhancedGuardrailsSection(botName: string, role: string | null): string {
  return [
    'ПРАВИЛА:',
    `- Ты — ${botName}, житель этого мира. Не знаешь про игры, ИИ, RPG.`,
    '- Не ассистент. У тебя своя жизнь и свои дела.',
    `- Говори о своей жизни: ${role ?? 'жизнь в городке'}.`,
    '- Упоминай наблюдения ЕСТЕСТВЕННО — не перечисляй их список.',
    '- Если заметил что-то о действиях игрока — упомяни, если к месту. Не форсируй.',
    '- Слухи можешь упомянуть с оговоркой ("Мне тут рассказали...").',
    '- 1-3 предложения. *действия* в звёздочках.',
  ].join('\n');
}
```

### Token Budget (обновлённый)

| Секция | Текущий (v1) | Обновлённый (v2) | Изменение |
|--------|-------------|-----------------|-----------|
| Идентичность (persona) | ~800 | ~400 (сжатый) | -400 |
| Мировой контекст | ~50 | ~50 | 0 |
| **Наблюдения (observations)** | — | ~200 | **+200** |
| Воспоминания (memories) | ~0 (hardcoded) | ~400 | +400 |
| Рефлексии | — | ~200 | +200 |
| **Слухи (gossip)** | — | ~100 | **+100** |
| Отношения | ~50 | ~50 | 0 |
| Правила + формат | ~200 | ~100 (сжатый) | -100 |
| **Итого (system prompt)** | **~1150** | **~1500** | **+350** |
| История разговора (6 ходов) | ~400 | ~400 | 0 |
| **Итого input** | **~1550** | **~1900** | **+350** |
| Output | ~100 | ~100 | 0 |

**Вывод**: бюджет в 1900 токенов input соответствует таргету из NPC Service spec (~2000 max). Прирост 350 токенов обеспечивает наблюдения и gossip при сжатии persona и правил.

---

## Part 7: Cost Analysis — Анализ стоимости новых систем

### Методология

Расчёты основаны на ценах из `llm-cost-optimization.md`:
- **Haiku 3.5**: Input $0.80/1M tokens, Output $4.00/1M tokens
- **Sonnet**: Input $3.00/1M tokens, Output $15.00/1M tokens
- **Cached Input**: 90% скидка

Сценарии: 50 DAU (1 сервер), 1K DAU (20 серверов), 15K DAU (300 серверов).

### 1. ActionAwarenessService Cost

```
Стоимость за событие:
  - Template generation: $0.00 (zero LLM cost)
  - Static importance scoring: $0.00 (zero LLM cost)
  - Haiku importance scoring (10% событий): $0.0002
  - Средневзвешенная: $0.00002 за событие

Объём за сессию (30 мин):
  - Фермерские: 3-5 событий
  - Экономические: 1-3 событий
  - Социальные: 1-2 событий
  - Мировые: 0-1 событий
  - ИТОГО: ~5-10 событий/сессию (среднее: 8)

Объём на NPC per event:
  - Среднее число наблюдателей на событие: 2.5 NPC
  - Итого observation writes: 8 × 2.5 = 20 per session per player
  - LLM calls (10%): 2 per session per player
```

| Метрика | 50 DAU | 1K DAU | 15K DAU |
|---------|--------|--------|---------|
| Events/day | 400 | 8,000 | 120,000 |
| LLM calls (10%) | 40 | 800 | 12,000 |
| Cost/day (Haiku) | **$0.008** | **$0.16** | **$2.40** |
| Cost/month | $0.24 | $4.80 | $72.00 |

### 2. GossipService Cost

```
Стоимость за раунд:
  - Gossip создаёт memories, но НЕ вызывает LLM
  - Описание генерируется шаблоном: "{NPC} рассказал мне, что {observation}"
  - Cost: $0.00 за gossip (zero LLM cost)

Объём:
  - 6 раундов/день (каждые 4 часа)
  - ~8 активных пар NPC за раунд
  - ~30% вероятность gossip per pair
  - ~2.4 gossip items per round × 6 = ~14 gossip/day/server
```

| Метрика | 50 DAU | 1K DAU | 15K DAU |
|---------|--------|--------|---------|
| Gossip items/day | 14 | 280 | 4,200 |
| LLM cost/day | **$0.00** | **$0.00** | **$0.00** |
| DB writes/day | 14 | 280 | 4,200 |

### 3. OrganicQuestGenerator Cost

```
Стоимость за генерацию:
  - Haiku call: ~200 input + ~100 output
  - Cost: (200 × $0.80 + 100 × $4.00) / 1M = $0.00056 per quest

Частота:
  - Max 1 квест на NPC за 2 реальных дня
  - 50 NPC × 50% probability = ~25 квестов за 2 дня = ~12.5/день/сервер
  - Не все NPC имеют рефлексии с "потребностями" → реально ~5/день/сервер
```

| Метрика | 50 DAU | 1K DAU | 15K DAU |
|---------|--------|--------|---------|
| Quests/day | 5 | 100 | 1,500 |
| Cost/day (Haiku) | **$0.003** | **$0.056** | **$0.84** |
| Cost/month | $0.08 | $1.68 | $25.20 |

### 4. NPCInitiativeService Cost

```
Letters (Haiku):
  - ~100 input + ~100 output per letter
  - Cost: (100 × $0.80 + 100 × $4.00) / 1M = $0.00048 per letter
  - Frequency: ~2 letters/day/server (conservative)

Visits, Approaches, Gifts:
  - Zero LLM cost (template-based scheduling)
```

| Метрика | 50 DAU | 1K DAU | 15K DAU |
|---------|--------|--------|---------|
| Letters/day | 2 | 40 | 600 |
| Cost/day (Haiku) | **$0.001** | **$0.019** | **$0.29** |
| Cost/month | $0.03 | $0.58 | $8.64 |

### 5. Updated PromptBuilder — Impact on Dialogue Cost

```
Дополнительные токены в промпте:
  - Observations: +200 tokens (5 items)
  - Gossip: +100 tokens (3 items)
  - Total: +300 tokens per dialogue turn

Стоимость дополнительных токенов (Haiku 3.5, uncached):
  - 300 × $0.80 / 1M = $0.00024 per turn
  - С Prompt Caching (observations/gossip в dynamic block):
    ~$0.00024 per turn (не кэшируется, но negligible)

Стоимость на диалог (10 ходов):
  - +$0.0024 per dialogue (Haiku)
  - +$0.0009 per dialogue (Sonnet, if cached system prompt)

Объём:
  - 3 диалога/игрок/день × 15K DAU = 45,000 диалогов/день
```

| Метрика | 50 DAU | 1K DAU | 15K DAU |
|---------|--------|--------|---------|
| Extra cost/dialogue | $0.002 | $0.002 | $0.002 |
| Dialogues/day | 150 | 3,000 | 45,000 |
| Extra cost/day | **$0.36** | **$7.20** | **$108.00** |
| Extra cost/month | $10.80 | $216.00 | $3,240.00 |

### Total Cost Summary — Все новые системы

| Компонент | 50 DAU/day | 1K DAU/day | 15K DAU/day | % от baseline |
|-----------|-----------|-----------|------------|--------------|
| ActionAwareness | $0.008 | $0.16 | $2.40 | 0.1% |
| GossipService | $0.00 | $0.00 | $0.00 | 0.0% |
| OrganicQuests | $0.003 | $0.056 | $0.84 | 0.04% |
| NPCInitiative | $0.001 | $0.019 | $0.29 | 0.01% |
| Prompt overhead | $0.36 | $7.20 | $108.00 | 4.5% |
| **ИТОГО** | **$0.37** | **$7.44** | **$111.53** | **~4.7%** |

**Baseline LLM cost (из llm-cost-optimization.md):**
- 15K DAU: $2,374/day
- New systems add: $111.53/day = **4.7% прирост**

**Вывод: новые системы добавляют < 5% к общим LLM-расходам**, при этом кардинально улучшая качество NPC-взаимодействий. Основной cost-driver — дополнительные 300 токенов в промпте за счёт observations и gossip. Все остальные компоненты (awareness, gossip, quests, letters) вместе стоят < $4/день при 15K DAU.

---

## Part 8: Database Schema Updates

### Обновление таблицы memories

```sql
-- Добавить поля для gossip и observation tracking
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS source_memory_id BIGINT REFERENCES memories(id),
  ADD COLUMN IF NOT EXISTS hop_count SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_npc_id VARCHAR(64);

-- Обновить CHECK constraint для memory_type
-- Было: 'observation' | 'interaction' | 'reflection'
-- Стало: + 'gossip'
-- (в PostgreSQL ALTER CHECK требует DROP + CREATE)
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_memory_type_check;
ALTER TABLE memories ADD CONSTRAINT memories_memory_type_check
  CHECK (memory_type IN ('observation', 'interaction', 'reflection', 'gossip'));

-- Индекс для быстрого получения observations/gossip по NPC + player
CREATE INDEX IF NOT EXISTS idx_memories_type_entity
  ON memories(agent_id, memory_type, created_at DESC)
  WHERE memory_type IN ('observation', 'gossip');

-- Индекс для gossipable memories (importance >= 5, hop_count < 2)
CREATE INDEX IF NOT EXISTS idx_memories_gossipable
  ON memories(agent_id, importance DESC)
  WHERE memory_type = 'observation' AND importance >= 5 AND hop_count < 2;
```

### Новая таблица: player_action_events

```sql
-- Лог всех значимых действий игроков.
-- Используется ActionAwarenessService для tracking и analytics.
CREATE TABLE player_action_events (
  id BIGSERIAL PRIMARY KEY,
  player_id UUID NOT NULL,
  player_name VARCHAR(64) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  data JSONB DEFAULT '{}',
  location_x INTEGER,
  location_y INTEGER,
  server_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_player_events_player
  ON player_action_events(player_id, created_at DESC);
CREATE INDEX idx_player_events_type
  ON player_action_events(action_type, created_at DESC);
CREATE INDEX idx_player_events_server
  ON player_action_events(server_id, created_at DESC);

-- Retention policy: хранить 30 дней (старые записи удалять cron job)
COMMENT ON TABLE player_action_events IS
  'Player action log for ActionAwarenessService. Retention: 30 days.';
```

### Новая таблица: npc_gossip_log

```sql
-- Лог переданных gossip для предотвращения дубликатов.
CREATE TABLE npc_gossip_log (
  id BIGSERIAL PRIMARY KEY,
  source_npc_id VARCHAR(64) NOT NULL,
  target_npc_id VARCHAR(64) NOT NULL,
  memory_id BIGINT NOT NULL REFERENCES memories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Уникальный constraint: одно наблюдение не передаётся дважды одной паре
CREATE UNIQUE INDEX idx_gossip_unique
  ON npc_gossip_log(source_npc_id, target_npc_id, memory_id);

CREATE INDEX idx_gossip_target
  ON npc_gossip_log(target_npc_id, created_at DESC);
```

### Новая таблица: organic_quests

```sql
-- Органически сгенерированные квесты.
CREATE TABLE organic_quests (
  id BIGSERIAL PRIMARY KEY,
  npc_id VARCHAR(64) NOT NULL REFERENCES npc_agents(id),
  target_player_id UUID NOT NULL,
  template VARCHAR(32) NOT NULL,              -- 'bring_item', 'help_task', etc.
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  title VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  objective TEXT NOT NULL,
  objective_data JSONB DEFAULT '{}',          -- structured quest completion criteria
  reward JSONB NOT NULL,                      -- { coins, friendshipPoints, item? }
  deadline TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT organic_quests_status_check
    CHECK (status IN ('pending', 'offered', 'active', 'completed', 'failed', 'declined', 'expired')),
  CONSTRAINT organic_quests_template_check
    CHECK (template IN ('bring_item', 'help_task', 'deliver_msg', 'investigate', 'visit'))
);

CREATE INDEX idx_quests_npc ON organic_quests(npc_id, status);
CREATE INDEX idx_quests_player ON organic_quests(target_player_id, status);
CREATE INDEX idx_quests_deadline ON organic_quests(deadline) WHERE status = 'active';
```

### Новая таблица: npc_letters

```sql
-- Письма от NPC к игрокам (через NPCInitiativeService).
CREATE TABLE npc_letters (
  id BIGSERIAL PRIMARY KEY,
  npc_id VARCHAR(64) NOT NULL,
  target_player_id UUID NOT NULL,
  subject VARCHAR(128) NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,                   -- когда доставлено в почтовый ящик
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_letters_player
  ON npc_letters(target_player_id, is_read, created_at DESC);
CREATE INDEX idx_letters_npc
  ON npc_letters(npc_id, created_at DESC);
```

### Новая таблица: npc_initiative_log

```sql
-- Лог инициатив NPC (визиты, подарки, подходы).
CREATE TABLE npc_initiative_log (
  id BIGSERIAL PRIMARY KEY,
  npc_id VARCHAR(64) NOT NULL,
  target_player_id UUID NOT NULL,
  initiative_type VARCHAR(32) NOT NULL,       -- 'visit_homestead', 'approach_player', etc.
  status VARCHAR(16) NOT NULL DEFAULT 'scheduled',
  data JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT initiative_type_check
    CHECK (initiative_type IN ('visit_homestead', 'send_letter', 'approach_player', 'gift_return')),
  CONSTRAINT initiative_status_check
    CHECK (status IN ('scheduled', 'executing', 'completed', 'expired', 'cancelled'))
);

CREATE INDEX idx_initiative_npc
  ON npc_initiative_log(npc_id, status);
CREATE INDEX idx_initiative_player
  ON npc_initiative_log(target_player_id, status);
CREATE INDEX idx_initiative_scheduled
  ON npc_initiative_log(scheduled_for)
  WHERE status = 'scheduled';
```

### Data Representation Decisions

| Data Structure | Decision | Rationale |
|---|---|---|
| PlayerActionEvent | **New** dedicated type | Нет существующих типов для game events. Уникальная структура для awareness pipeline. |
| Observation memory | **Reuse** existing `memories` table + extend | Observations — это подтип memories. 80%+ полей совпадают. Добавлены `hop_count`, `source_memory_id`. |
| GossipLog | **New** dedicated table | Нет аналогов. Уникальная задача — предотвращение дубликатов gossip. |
| OrganicQuest | **New** dedicated table | Quest FSM требует dedicated state machine. Нет совпадений с существующими structures. |
| NpcLetter | **New** dedicated table | Messaging — новая механика, нет пересечений. |
| InitiativeLog | **New** dedicated table | Scheduling/execution tracking — нет аналогов. |

### Field Propagation Map

```yaml
fields:
  - name: "observation.description"
    origin: "ObservationTemplates (template function)"
    transformations:
      - layer: "ActionAwarenessService"
        type: "string"
        validation: "template output, max 200 chars"
      - layer: "MemoryRepository"
        type: "memories.description (TEXT)"
        transformation: "stored as-is"
      - layer: "SystemPromptBuilder"
        type: "prompt section line"
        transformation: "prefixed with '- ', suffixed with date"
    destination: "LLM prompt input"
    loss_risk: "none"

  - name: "gossip.description"
    origin: "GossipService.createGossipDescription()"
    transformations:
      - layer: "GossipService"
        type: "string"
        validation: "'{NPC} рассказал мне, что {cleaned_observation}'"
      - layer: "MemoryRepository"
        type: "memories.description (TEXT)"
        transformation: "stored as-is, memoryType='gossip'"
      - layer: "SystemPromptBuilder"
        type: "prompt section line"
        transformation: "prefixed with '- '"
    destination: "LLM prompt input"
    loss_risk: "low"
    loss_risk_reason: "Cleaning step removes 'Видел(а), что' prefix — minor info loss"

  - name: "quest.definition"
    origin: "Haiku LLM generation"
    transformations:
      - layer: "OrganicQuestGenerator"
        type: "QuestDefinition (parsed JSON)"
        validation: "JSON.parse, required fields check"
      - layer: "QuestRepository"
        type: "organic_quests table row"
        transformation: "reward stored as JSONB"
      - layer: "Colyseus Room"
        type: "quest_offered message"
        transformation: "mapped to client-friendly format"
    destination: "Client UI (quest journal)"
    loss_risk: "low"
    loss_risk_reason: "JSON parse may fail — fallback skips quest generation"

  - name: "letter.body"
    origin: "Haiku LLM generation"
    transformations:
      - layer: "LetterGenerator"
        type: "{ subject, body } parsed JSON"
        validation: "JSON.parse with fallback template"
      - layer: "LetterRepository"
        type: "npc_letters.body (TEXT)"
        transformation: "stored as-is"
      - layer: "Colyseus Room"
        type: "letter_received message"
        transformation: "sent to client mailbox UI"
    destination: "Client UI (mailbox)"
    loss_risk: "none"
```

---

## Part 9: Implementation Roadmap

### Implementation Approach

**Selected Approach**: Vertical Slice (Feature-driven)
**Selection Reason**: Каждый модуль (Awareness → PromptBuilder → Gossip → Quests → Initiative) даёт самостоятельную пользовательскую ценность. Модули слабо связаны — можно деплоить по одному и получать feedback. Зависимости однонаправленные: каждый следующий модуль опирается на предыдущий, но не модифицирует его.

### Technical Dependencies and Implementation Order

```
                    ┌─────────────────────┐
                    │ 1. DB Schema        │ (foundation)
                    │    Migrations       │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │ 2. ActionAwareness  │ (core — enables everything)
                    │    Service          │
                    │    + Templates      │
                    │    + Aggregator     │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │ 3. Updated          │ (immediate value — NPC "видит")
                    │    PromptBuilder    │
                    │    + Observations   │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │ 4. GossipService    │ (social layer — NPC "обсуждает")
                    │    + Gossip in      │
                    │      PromptBuilder  │
                    └─────────┬───────────┘
                              │
               ┌──────────────┼──────────────┐
               │                             │
     ┌─────────▼───────────┐     ┌───────────▼───────────┐
     │ 5. OrganicQuest     │     │ 6. NPCInitiative     │
     │    Generator         │     │    Service            │
     │                      │     │    + LetterGenerator  │
     └──────────────────────┘     └───────────────────────┘
```

### Phase 1: Foundation + ActionAwareness (Неделя 6)

**Задачи:**

1. **DB Migrations** (1 день)
   - Миграция: ALTER memories (add hop_count, source_memory_id, source_npc_id)
   - Миграция: CREATE player_action_events
   - Миграция: CREATE npc_gossip_log
   - Миграция: CREATE organic_quests
   - Миграция: CREATE npc_letters
   - Миграция: CREATE npc_initiative_log
   - **Verification (L3)**: Migrations run successfully, tables exist

2. **Types & Interfaces** (0.5 дня)
   - `responsive-types.ts`: PlayerActionType, PlayerActionEvent, NpcObserverConfig
   - **Verification (L3)**: TypeScript compiles without errors

3. **ActionAwarenessService** (2 дня)
   - `ObservationTemplates.ts`: 25+ шаблонов
   - `ImportanceRules.ts`: Static importance map
   - `NpcObserverConfig.ts`: Observer configs для 8 NPC
   - `EventAggregator.ts`: Cooldown + dedup + aggregation
   - `ActionAwarenessService.ts`: Main service class
   - **Verification (L2)**: Unit tests: template generation, importance calculation, cooldown logic, aggregation

4. **Updated SystemPromptBuilder** (1 день)
   - Добавить `buildObservationsSection()` в `SystemPromptBuilder.ts`
   - Обновить `buildSystemPrompt()` → `buildEnhancedSystemPrompt()`
   - Сжать persona и guardrails секции
   - **Verification (L2)**: Unit tests: prompt assembly with observations, token budget verification

5. **Integration: Events → Awareness → Prompt** (0.5 дня)
   - Подключить ActionAwarenessService к game event handlers в ChunkRoom
   - Подключить observations к DialogueService flow
   - **Verification (L1)**: E2E: player plants crop → NPC mentions it in dialogue

**E2E Verification (Phase 1)**:
- Игрок сажает клубнику → Марко в диалоге: "Видел, что ты посадил(а) клубнику!"
- Игрок продаёт помидоры 3 дня → NPC: "Ты продаёшь одно и то же!"
- Cooldown работает: повторная посадка клубники НЕ создаёт дубликат

### Phase 2: GossipService (Неделя 7-8)

**Задачи:**

1. **GossipRules** (0.5 дня)
   - `GossipRules.ts`: NPC gossip rates, colocation schedule, constants
   - **Verification (L3)**: Compiles, rates match Personality Bible

2. **GossipService** (1.5 дня)
   - `GossipService.ts`: processGossipRound, tryGossip, createGossipDescription
   - GossipLogRepository integration
   - **Verification (L2)**: Unit tests: gossip propagation, hop limit, dedup, probability

3. **Gossip in PromptBuilder** (0.5 дня)
   - Добавить `buildGossipSection()` в SystemPromptBuilder
   - **Verification (L2)**: Unit tests: prompt with gossip items

4. **Scheduled Gossip Rounds** (0.5 дня)
   - Timer: processGossipRound every 4 hours
   - Redis cooldown tracking
   - **Verification (L1)**: Gossip items appear in NPC prompts

**E2E Verification (Phase 2)**:
- Игрок дарит подарок Марко (importance 7) → через 4 часа Ира (gossip_rate 80%) знает → в диалоге с Ирой: "Марко рассказал мне, что ты подарил(а) ему..."
- Gossip не распространяется дальше 2 хопов

### Phase 3: OrganicQuestGenerator (Неделя 8-9)

**Задачи:**

1. **QuestTemplates** (0.5 дня)
   - `QuestTemplates.ts`: Quest types, need keywords, config
   - **Verification (L3)**: Compiles, regex patterns tested

2. **OrganicQuestGenerator** (2 дня)
   - `OrganicQuestGenerator.ts`: checkForQuests, tryGenerateQuest, generateQuestViaLLM
   - QuestRepository CRUD
   - Quest state machine (status transitions)
   - **Verification (L2)**: Unit tests: keyword detection, quest generation, state transitions

3. **Quest Completion Tracking** (1 день)
   - Hook checkQuestCompletion into game events
   - Reward distribution
   - **Verification (L1)**: Player completes quest → reward + NPC memory

**E2E Verification (Phase 3)**:
- NPC reflection: "Мне нужна помощь с крышей" → quest generated → NPC предлагает в диалоге → игрок выполняет → NPC благодарит

### Phase 4: NPCInitiativeService (Неделя 9-10)

**Задачи:**

1. **LetterGenerator** (0.5 дня)
   - `LetterGenerator.ts`: Haiku-based letter generation + fallback templates
   - **Verification (L2)**: Unit tests: letter generation, fallback

2. **NPCInitiativeService** (2 дня)
   - `NPCInitiativeService.ts`: processInitiatives, trigger checks, cooldowns
   - Initiative scheduling and execution
   - **Verification (L2)**: Unit tests: trigger conditions, cooldown logic

3. **Client Integration** (1.5 дня)
   - Colyseus messages: letter_received, npc_approach, gift_received
   - Client UI: mailbox notification, "!" speech bubble, gift popup
   - **Verification (L1)**: Player receives letter in mailbox, NPC approaches with "!"

**E2E Verification (Phase 4)**:
- NPC имеет 3+ farming observations → визит на участок → NPC стоит у забора и комментирует
- NPC reflection упоминает игрока → письмо в почтовом ящике
- Игрок подарил подарок → через день NPC дарит ответный подарок

### Phase 5: Quality Assurance (Неделя 10-11)

1. **Integration Testing**
   - Full pipeline: event → observation → gossip → quest → initiative
   - Multi-NPC scenarios: 8 NPC, 5 players, 1 day simulation
   - Memory growth validation: no memory bloat

2. **Performance Testing**
   - ActionAwareness: process 100 events in < 1s
   - GossipService: process round for 50 NPC in < 5s
   - PromptBuilder: assemble enhanced prompt in < 10ms
   - Token budget: verify < 1900 tokens in 95th percentile

3. **Cost Validation**
   - Run 24h simulation with mock players
   - Verify actual LLM costs match estimates
   - Verify < 5% cost increase

4. **Quality Testing**
   - Manual dialogue evaluation: 5 testers, 20 dialogues each
   - Observations mentioned naturally (not forced)?
   - Gossip adds context (not confusion)?
   - Quests feel organic (not random)?

---

## Test Strategy

### Unit Tests

**ActionAwarenessService:**
- [ ] Template generates correct Russian text for all 25+ event types
- [ ] Static importance scoring returns correct values
- [ ] NPC observer config matches Personality Bible (all 8 NPCs)
- [ ] ImportanceMultiplier correctly scales base importance
- [ ] EventAggregator cooldown prevents duplicate observations
- [ ] EventAggregator aggregates same-type events correctly
- [ ] Aggregate summary generates at threshold (every 5 events)

**GossipService:**
- [ ] processGossipRound respects 4-hour cooldown
- [ ] tryGossip respects NPC gossip_rate probability
- [ ] Gossip description correctly formats "{NPC} рассказал мне, что..."
- [ ] Hop count correctly increments
- [ ] Max 2 hops enforced (hop_count >= 2 → skip)
- [ ] Dedup: same memory not shared twice to same NPC
- [ ] Importance decay: -2 per hop, minimum 1

**OrganicQuestGenerator:**
- [ ] Keyword detection matches all NEED_KEYWORDS patterns
- [ ] Cooldown prevents quest spam (48h per NPC)
- [ ] Max pending quests per NPC enforced
- [ ] Quest state machine: valid transitions only
- [ ] Quest completion detection for each template type

**NPCInitiativeService:**
- [ ] Visit homestead triggers at 3+ farming observations
- [ ] Letter triggers on reflection mentioning player
- [ ] Approach triggers on pending quest
- [ ] Gift return triggers on recent gift + relationship level
- [ ] All cooldowns enforced correctly
- [ ] Return gift selection matches NPC profession

**SystemPromptBuilder (updated):**
- [ ] Enhanced prompt includes observations section when available
- [ ] Enhanced prompt includes gossip section when available
- [ ] Sections omitted when data is empty (no "ЧТО ТЫ ЗАМЕТИЛ(А):\n" with 0 items)
- [ ] Token budget: enhanced prompt < 1600 tokens (before history)
- [ ] Total input (prompt + 6-turn history) < 2000 tokens
- [ ] formatGameDate returns correct relative dates
- [ ] Backward compatible: buildSystemPrompt still works for legacy flow

### Integration Tests

- [ ] Full pipeline: player_action_event → observation memory → appears in prompt → NPC mentions in dialogue
- [ ] Gossip pipeline: observation (importance 7) → gossip round → target NPC receives gossip memory → appears in dialogue
- [ ] Quest pipeline: reflection with "нужна помощь" → quest generated → offered to player → completed → reward
- [ ] Initiative pipeline: 3+ farming observations → visit scheduled → NPC moves to homestead
- [ ] Multi-NPC: event seen by 3 NPCs → 3 separate observations with correct importance
- [ ] Memory growth: 50 events processed → verify < 150 memory records (dedup working)

### Performance Tests

- [ ] ActionAwareness: 100 events processed in < 1000ms
- [ ] GossipService: round for 50 NPC in < 5000ms
- [ ] PromptBuilder: enhanced prompt assembly < 10ms
- [ ] DB queries: observations retrieval < 50ms (with index)
- [ ] Redis operations: cooldown check < 5ms

---

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Memory bloat (too many observations) | High | Medium | Aggressive dedup, cooldowns, TTL on old observations (90 days) |
| Gossip creates inconsistent NPC knowledge | Medium | Low | Max 2 hops, low gossip rates, importance decay |
| Organic quests don't match world state | Medium | Medium | Haiku generation with specific context, template constraints |
| NPC initiative annoys players | Medium | Low | Conservative cooldowns (3d visit, 2d letter), player opt-out |
| 300 extra tokens degrade dialogue quality | Medium | Low | A/B test before full rollout, monitor dialogue length/engagement |
| Redis unavailable | Medium | Low | Fallback: in-memory cooldowns, skip gossip round |
| Template descriptions feel repetitive | Low | Medium | 3+ variants per template, randomized selection |

---

## Alternative Solutions

### Alternative 1: Full LLM Observation Generation

- **Overview**: All observations generated by Haiku instead of templates
- **Advantages**: More natural, varied descriptions; each NPC has unique phrasing
- **Disadvantages**: 20x cost increase for ActionAwareness ($48/day vs $2.40/day at 15K DAU)
- **Reason for Rejection**: Violates < 5% cost constraint. Templates with NPC-specific variants achieve 80% of quality at 0% of LLM cost.

### Alternative 2: Client-Side Observation Injection

- **Overview**: Client detects events and injects observations directly into memory
- **Advantages**: Zero server processing overhead
- **Disadvantages**: Trust boundary violation (client could inject fake memories), no server-side dedup
- **Reason for Rejection**: Security risk. Server must be authoritative for NPC memory.

### Alternative 3: Gossip via LLM (Natural Language Generation)

- **Overview**: Use Haiku to generate natural gossip conversations between NPCs
- **Advantages**: More natural gossip descriptions
- **Disadvantages**: ~$0.001 per gossip × 14 gossip/day × 300 servers = $1,260/month
- **Reason for Rejection**: Templates are sufficient for gossip. Players rarely see the raw gossip text — they see NPC dialogue that references gossip.

---

## Standards Classification Table

| Standard | Type | Source | Impact on Design |
|----------|------|--------|-----------------|
| Vercel AI SDK for LLM calls | Explicit | `DialogueService.ts` imports `ai` | Letter/Quest generation must use same SDK or abstract LLM client |
| Russian-language NPC dialogue | Explicit | `SystemPromptBuilder.ts` | All templates and prompts in Russian |
| Modular section-based prompt | Implicit | `SystemPromptBuilder.ts` pattern | New sections follow existing buildXxxSection() pattern |
| BotManager decoupled from Colyseus | Explicit | `BotManager.ts` header comment | New services also decoupled — communicate via events, not Room directly |
| `@nookstead/shared` constants | Explicit | `BotManager.ts` imports | Shared constants (tile size, speeds) reused |
| Streaming dialogue responses | Implicit | `DialogueService.streamResponse()` | Quest/letter generation can be non-streaming (not user-facing real-time) |
| PostgreSQL + Redis data layer | Explicit | NPC Service spec | New tables in PostgreSQL, cooldowns in Redis |
| Jest for unit tests | Explicit | `jest.config.cts` | All new services tested with Jest |
| ESLint flat config | Explicit | `eslint.config.mjs` | New code passes linting |
| TypeScript strict mode | Explicit | `tsconfig.json` | All new types fully typed, no `any` |

---

## References

- **NPC Service Specification**: `docs/documentation/design/systems/npc-service.md` — базовая архитектура NPC Service
- **Responsive World Design v2.0**: `docs/strategy/responsive-world-design.md` — каталог 70+ событий, NPC Personality Bible, эмерджентные арки
- **Core Mechanics Analysis v1.0**: `docs/strategy/core-mechanics-analysis.md` — анализ core loop и "Отзывчивого мира"
- **LLM Cost Optimization v1.0**: `docs/strategy/llm-cost-optimization.md` — стратегия оптимизации, prompt caching, Haiku routing
- **GDD v3.0**: `docs/nookstead-gdd-v3.md` — Game Design Document
- **Anthropic Prompt Caching**: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching — механизм кэширования промптов
- **Vercel AI SDK**: https://sdk.vercel.ai/docs — SDK для LLM integration (текущая реализация)

---

## Update History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-03-14 | 1.0 | Initial version — full responsive world design | Technical Designer |
