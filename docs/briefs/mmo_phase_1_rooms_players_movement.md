# Phase 1 — Rooms + Players + Movement

This document defines the first playable milestone of the MMO server.

Goal:
- Players can connect
- Players join a chunk-based room
- Players move
- Players see each other moving
- Server is authoritative

No NPC.
No economy.
No fast-forward yet.
Only clean foundation.

---

# 1. Scope

In scope:
- World coordinate system
- Chunk-based Room model
- Player state storage
- Server-side movement validation
- Snapshot on join
- Basic diff broadcasting

Out of scope:
- NPC
- Plants
- Combat
- Persistence (can be in-memory for Phase 1)

---

# 2. Location Types (World Topology)

The world consists of different types of locations.
All of them are still chunk-based internally, but they differ in ownership and generation model.


## 2.1 City Locations

- Usually represented as a single dedicated chunk (or a small fixed set of chunks).
- Static map (designed manually).
- Shared by all players.
- Contains shops, NPC homes, TravelNodes.

City chunk example:
chunkId = city:capital

These chunks are stable and persistent.


## 2.2 Player Location (Personal Instance)

- Similar structure to city location.
- Owned by a specific player.
- Not shared publicly (unless explicitly allowed later).
- Can contain farm, house, personal objects.

Example:
chunkId = player:{playerId}:farm

Characteristics:
- Instanced
- Activated only when owner enters
- Can sleep when empty

This is logically a region with limited access.


## 2.3 Open World (Procedural)

- Large region composed of many chunks.
- Chunks are generated procedurally.
- Shared by all players.

Open world characteristics:
- ChunkId format: world:{x}:{y}
- Tile grid generated on first access
- May optionally be persisted after generation

Procedural generation is:
- Deterministic by seed
- Or semi-persistent via DB snapshot


## 2.4 Unified Model

Despite different types, all locations follow the same abstraction:

Location {
  id
  type: "CITY" | "PLAYER" | "OPEN_WORLD"
  chunks: Chunk[]
}

Rooms still map to chunks.
World logic treats all chunk types the same.

---

# 2. Coordinate System

Use world coordinates.

Player position:
- worldX: number
- worldY: number

Chunk calculation:

chunkX = floor(worldX / CHUNK_SIZE)
chunkY = floor(worldY / CHUNK_SIZE)
chunkId = `${chunkX}:${chunkY}`

CHUNK_SIZE = 64 (logical tiles)

Tile size is irrelevant to server.

---

# 3. Basic Architecture

Server structure:

world/
  - World.ts
  - ChunkManager.ts
rooms/
  - ChunkRoom.ts
models/
  - Player.ts

World owns player states.
Room mirrors them.

---

# 4. Player Model (Phase 1)

Minimal fields:

Player {
  id: string
  worldX: number
  worldY: number
  chunkId: string
  direction: "up" | "down" | "left" | "right"
}

No inventory.
No stats.

---

# 5. Room Model

One Room per Chunk.

Room ID pattern:
chunk:${chunkId}

Responsibilities:
- onJoin
- onLeave
- onMessage("move")
- broadcast diffs

Room does NOT compute movement logic.
Room calls World.

---

# 6. Join Flow

1) Client connects
2) Client sends desired world position (or server assigns spawn)
3) Compute chunkId
4) Join chunk room
5) World registers player
6) Room sends snapshot:
   - All players in chunk
   - Their positions

Snapshot format (conceptual):
{
  players: [
    { id, worldX, worldY, direction }
  ]
}

---

# 7. Movement Flow

Client sends:
{
  type: "move",
  dx: number,
  dy: number
}

Server steps:

1) Validate movement speed
2) Compute new position
3) Validate bounds (basic world bounds only for Phase 1)
4) Update Player state in World
5) If chunk changed:
   - Leave old room
   - Join new room
6) Mark player dirty

Room then broadcasts diff:
{
  id,
  worldX,
  worldY,
  direction
}

---

# 8. Movement Rules (Authoritative)

Server must:
- Limit max delta per tick
- Ignore impossible jumps
- Clamp speed

For Phase 1:
- No collision yet
- No tile validation

That comes in Phase 3.

---

# 9. Chunk Transition

If player crosses chunk boundary:

1) World updates chunkId
2) Remove from old room
3) Join new room
4) Send snapshot of new chunk

Optional improvement later:
- Preload adjacent chunk

---

# 10. Broadcasting Strategy

Do not broadcast full state every tick.

Only broadcast when:
- Player moved
- Player joined
- Player left

Phase 1 can use simple broadcast to all clients in room.

Optimization comes later.

---

# 11. Minimal World API (Phase 1)

World exposes:

- addPlayer(player)
- removePlayer(playerId)
- movePlayer(playerId, dx, dy)
- getPlayersInChunk(chunkId)

Room only calls these.

---

# 12. Exit Criteria

Phase 1 is complete when:

- Two browser clients can connect
- They join same chunk
- They see each other moving
- Crossing chunk border switches rooms cleanly
- No desync

If this works reliably → foundation is correct.

---

# Notes

Keep Phase 1 simple.
Do not prematurely add:
- NPC
- Map
- Fast-forward
- Economy

Foundation first.

(End of Phase 1 Document)

