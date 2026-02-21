# Механика 12: Жизненный цикл чанков и fast-forward симуляция

## Цель

Снизить CPU-нагрузку и сохранить непрерывность мира: пустые чанки должны «спать», но мир в них должен корректно прогрессировать по времени.

## Игровой цикл

1. Игрок входит в чанк -> чанк просыпается.
2. Чанк запускает ACTIVE-циклы.
3. Последний игрок выходит -> чанк уходит в sleep после anti-flap задержки.
4. При следующем входе чанк делает fast-forward от `lastSimulatedAt` до текущего времени.

## Основные правила

- Состояния чанка: `SLEEPING`, `LOADING`, `ACTIVE`, `UNLOADING`.
- В `ACTIVE`: реалтайм-циклы движения/решений/комбата.
- В `SLEEPING`: нет realtime-циклов, только time-based прогрессия.
- `lastSimulatedAt` всегда растёт монотонно.

## Состояния и данные

- `ChunkRuntime`: `id`, `state`, `playersCount`, `lastSimulatedAt`.
- `dirtyFlags`: по NPC/экономике/растениям.
- `joinQueue`: ожидание при `LOADING`.
- `sleepDelayHandle`: anti-flap таймер.

## Fast-forward модель

Вход:

- `fromTime = lastSimulatedAt`
- `toTime = now`

Обновления:

- schedule-переходы NPC
- needs/доход/стресс
- транзит сущностей
- экономика (demand/stock)
- рост растений

Важно: расчёты идемпотентны на интервале времени.

## Параметры баланса

- Anti-flap delay: 5-15 сек.
- Movement loop: 10 TPS.
- Decision loop: 250-500 мс.
- Checkpoint persist: 30-60 сек.

## MVP-срез

- Полная state-машина чанка.
- Wake/sleep с антифлапом.
- Fast-forward для NPC/растений/экономики.
- Persist dirty-состояния при sleep.

## Телеметрия

- `chunk_state_changed`.
- `chunk_wake_duration_ms`.
- `chunk_fast_forward_applied`.
- `chunk_sleep_scheduled`, `chunk_sleep_cancelled`, `chunk_slept`.
- `chunk_checkpoint_written`.

## Риски и анти-абьюз

- Sleep/wake flapping: anti-flap + optional border-buffer.
- Двойная прогрессия после сбоя: интервал-ориентированные расчёты и lastApplied markers.
- Join во время unload: очередь подключения или безопасная отмена unload.
