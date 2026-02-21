# Механика 11: Мультиплеер и социальные системы

## Цель

Дать социальный слой, который работает поверх сервер-авторитетной симуляции и не ломает масштабирование.

## Игровой цикл

1. Игрок подключается к `ChunkRoom`.
2. Получает snapshot окружения.
3. Отправляет input-сообщения.
4. Получает diff-обновления по интересу/радиусу.
5. Использует социальные действия (чат, эмоции, торговля, визиты).

## Основные правила

- Room не владеет симуляцией: только transport + visibility.
- Все мутации мира проходят через `World.handleInput(...)`.
- Snapshot отправляется на join, далее только diffs.
- Применяется interest management (радиус интереса) даже внутри чанка.

## Состояния и данные

- `sessionState`: connected/joining/inChunk/transitioning/disconnected.
- `presence`: playerId, chunkId, zoneId, visibilityRadius.
- `socialAction`: emote/chat/trade/invite.
- `roomDiff`: dirtyPlayers, dirtyNPCs, dirtyEntities.

## Параметры баланса

- Patch cadence: 10/сек (или адаптивно).
- Interest radius: примерно 20-30 тайлов.
- Лимиты сообщений/инвайтов для анти-спама.
- Ограничения частоты трейд-запросов.

## MVP-срез

- Локальный чат.
- Эмоции.
- Визиты на участок.
- Безопасный trade-flow между игроками.

## Телеметрия

- `player_joined_chunk`, `player_left_chunk`.
- `chunk_snapshot_sent`, `chunk_diff_sent`.
- `chat_message_sent`, `emote_used`.
- `trade_started`, `trade_completed`, `trade_cancelled`.

## Риски и анти-абьюз

- Спуф клиентских данных: серверная валидация любого input.
- Спам/токсичность: фильтры, rate limit, репорты.
- Перегрузка канала: строгий diff-only sync и интерес-радиус фильтрация.
