# Механика 07: NPC-диалоги, память и отношения

## Цель

Сделать NPC долгоживущими агентами, поведение которых определяется памятью, расписанием, needs и утилити-решениями.

## Игровой цикл

1. NPC обновляет состояние по расписанию и needs.
2. Периодически оценивает цели (utility scoring).
3. При контакте с игроком запускает диалог.
4. Диалог и события пишутся в память и влияют на отношения.

## Основные правила

- NPC не «думает» каждый тик: решения батчатся каждые 2-5 секунд.
- В ACTIVE чанках: движение/комбат 10 TPS, решения отдельно.
- В SLEEPING чанках: логическая fast-forward прогрессия без физического path simulation.
- Диалоги ограничены по ходам и стоимости.

## Состояния и данные

- `npcState`: sleeping/idle/walking/working/talking/inTransit.
- `nextDecisionAt`, `currentGoal`, `currentAction`.
- `memory[]`: description, importance, type, relatedEntities, createdAt.
- `relationship[npc,entity]`: score/tier/summary.
- `travelState`: normal/moving_to_node/in_transit.

## Utility-модель

`score = baseWeight + needFactor + traitModifier + relationModifier + randomNoise`

NPC выбирает цель с максимальным score.

## Параметры баланса

- Decision interval: 2-5 сек.
- Dialogue turns: 8-12.
- Memories in context: 5-10.
- Reflection cadence: 1 раз в игровой день.

## MVP-срез

- 1-3 NPC с расписанием + utility-lite.
- Диалог + память + recall.
- Базовые relationship tiers.

## Телеметрия

- `npc_decision_evaluated`, `npc_goal_selected`.
- `npc_dialogue_start`, `npc_dialogue_turn`, `npc_dialogue_end`.
- `npc_memory_created`, `npc_memory_retrieved`.
- `npc_relationship_changed`.

## Риски и анти-абьюз

- Токсичный ввод: модерация до LLM-вызова.
- Выход из persona: строгий prompt contract + response guardrails.
- Рост стоимости LLM: model routing, caching, limits, fallback.
