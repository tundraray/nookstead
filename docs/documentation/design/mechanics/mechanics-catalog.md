# Каталог игровых механик Nookstead

Этот документ фиксирует целевой набор механик и их связь с текущей серверной архитектурой (chunk-based simulation, world-time, transit).

## Список механик

1. [Механика 01: Передвижение и взаимодействия](./mechanic-01-movement-and-interaction.md)
2. [Механика 02: Игровое время, погода и сезоны](./mechanic-02-time-weather-seasons.md)
3. [Механика 03: Усадьба, строительство и декор](./mechanic-03-homestead-building-decoration.md)
4. [Механика 04: Фермерство и животные](./mechanic-04-farming-and-animals.md)
5. [Механика 05: Инвентарь, предметы и крафт](./mechanic-05-inventory-items-crafting.md)
6. [Механика 06: Рынок, экономика и торговля](./mechanic-06-market-economy-trading.md)
7. [Механика 07: NPC-диалоги, память и отношения](./mechanic-07-npc-dialogue-memory-relationships.md)
8. [Механика 08: Квесты, события и сюжетные акты](./mechanic-08-quests-events-story.md)
9. [Механика 09: Репутация и прогрессия](./mechanic-09-reputation-and-progression.md)
10. [Механика 10: Транспорт, путешествия и зоны](./mechanic-10-transport-travel-zones.md)
11. [Механика 11: Мультиплеер и социальные системы](./mechanic-11-multiplayer-social-systems.md)
12. [Механика 12: Жизненный цикл чанков и fast-forward симуляция](./mechanic-12-chunk-lifecycle-fast-forward.md)

## Приоритеты

- `P0` (MVP): 01, 02, 04, 06, 07, 10, 12
- `P1`: 03, 05, 08, 09, 11

## Как использовать

- Для планирования: брать механику как источник acceptance criteria, граничных условий и рисков.
- Для техдизайна: преобразовывать механику в `feature-spec` по фазам.
- Для аналитики: закладывать события из раздела телеметрии каждой механики до реализации.
