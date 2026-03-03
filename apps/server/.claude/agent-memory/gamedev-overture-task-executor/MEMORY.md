# Task Executor Memory

## AI SDK v6 ChatTransport Interface
- Package version: `ai@^6.0.105` installed in apps/game
- `ChatTransport<UIMessage>` has two methods: `sendMessages()` and `reconnectToStream()`
- `sendMessages` returns `Promise<ReadableStream<UIMessageChunk>>`
- UIMessageChunk stream sequence for text: `start` -> `start-step` -> `text-start` -> `text-delta`* -> `text-end` -> `finish-step` -> `finish`
- Each text chunk needs an `id` field that stays consistent across start/delta/end
- UIMessage v6 uses `parts` array (not `content` string) - text in `{ type: 'text', text: string }` parts

## Game App Build Targets
- `pnpm nx typecheck game` does NOT exist - use `npx tsc --project apps/game/tsconfig.json --noEmit` instead
- Available targets: build, dev, start, serve-static, lint, test

## Colyseus SDK
- `room.onMessage(type, callback)` returns `() => void` unsubscribe function
- Room type in codebase: `Room<unknown, ChunkRoomState>`

## Project Patterns
- Services directory: `apps/game/src/services/`
- Message types: `ClientMessage` / `ServerMessage` as const objects in shared package
- Dialogue types in `packages/shared/src/types/dialogue.ts`
