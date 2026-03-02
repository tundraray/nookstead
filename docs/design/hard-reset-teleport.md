# Design Doc: Hard Reset Teleport Button

## Overview

Add a "Hard Reset" button to the GameHeader that teleports the player to the map's spawn point (nearest walkable grass tile to center). This is a permanent recovery feature for players stuck in non-walkable areas.

## Message Flow

```
React (GameHeader)
  │  button click
  ▼
EventBus.emit('player:hard-reset')
  │
  ▼
Phaser (Game scene)
  │  EventBus.on('player:hard-reset')
  │  room.send(ClientMessage.HARD_RESET)
  ▼
Colyseus (ChunkRoom)
  │  onMessage(ClientMessage.HARD_RESET)
  │  findSpawnTile(mapWalkable, mapGrid, w, h)
  │  world.setPlayerPosition(sessionId, x, y)
  │  Update ChunkPlayer schema (worldX, worldY)
  ▼
Colyseus auto-patch (schema onChange)
  │
  ▼
Client (Player.reconcile)
  │  Delta >= CORRECTION_THRESHOLD (8px) → snap
  ▼
Player teleported to spawn point
```

## Changes by File

### 1. `packages/shared/src/types/messages.ts`
Add `HARD_RESET: 'hard_reset'` to `ClientMessage` enum.

### 2. `apps/server/src/rooms/ChunkRoom.ts`
- Store `mapGrid` as class field (currently only `mapWalkable` is stored)
- Register `onMessage(ClientMessage.HARD_RESET)` handler in `onCreate()`
- Handler: call `findSpawnTile(this.mapWalkable, this.mapGrid, w, h)`, convert tile→pixel, update World + schema

### 3. `apps/game/src/game/scenes/Game.ts`
- Listen for `'player:hard-reset'` EventBus event in `create()`
- On event: `room.send(ClientMessage.HARD_RESET)` and clear player's `moveTarget`
- Clean up listener in `shutdown()`

### 4. `apps/game/src/components/header/GameHeader.tsx`
- Import `EventBus`
- Add a reset button between currency zone and clock zone (or after currency)
- On click: `EventBus.emit('player:hard-reset')`

### 5. `apps/game/src/app/global.css`
- Add `.game-header__reset-btn` styles matching header's pixel art theme

## Server Handler Detail

```typescript
private handleHardReset(client: Client): void {
  if (this.mapWalkable.length === 0 || !this.mapGrid) {
    client.send(ServerMessage.ERROR, { message: 'Map not loaded' });
    return;
  }

  const mapHeight = this.mapWalkable.length;
  const mapWidth = this.mapWalkable[0]?.length ?? 0;

  let spawnX: number;
  let spawnY: number;

  try {
    const spawn = findSpawnTile(this.mapWalkable, this.mapGrid, mapWidth, mapHeight);
    spawnX = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
    spawnY = (spawn.tileY + 1) * TILE_SIZE;
  } catch {
    // No walkable tile at all — use DEFAULT_SPAWN
    spawnX = DEFAULT_SPAWN.worldX;
    spawnY = DEFAULT_SPAWN.worldY;
  }

  world.setPlayerPosition(client.sessionId, spawnX, spawnY);

  const chunkPlayer = this.state.players.get(client.sessionId);
  if (chunkPlayer) {
    chunkPlayer.worldX = spawnX;
    chunkPlayer.worldY = spawnY;
  }
}
```

## UI Design

The button is a small icon/text button in the header bar, placed after the currency zone. Styled with the same pixel font and earthy color palette as the rest of the header. Uses a compass/home icon metaphor.

## Edge Cases

- **Map not loaded yet**: Server returns error; button does nothing harmful
- **No walkable tiles**: Falls back to `DEFAULT_SPAWN` constant
- **Rapid clicking**: Client-side debounce not needed — server handler is idempotent and cheap
- **During movement**: Reconciliation snap handles the teleport; `moveTarget` is cleared client-side
