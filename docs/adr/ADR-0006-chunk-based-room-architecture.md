# ADR-0006: Chunk-Based Room Architecture

## Status

Proposed

## Context

Nookstead is a 2D pixel art MMO built with Phaser.js 3 (client) and Colyseus 0.17 (game server). The current server architecture uses a single `GameRoom` (established in PRD-002 and PRD-004) that manages all connected players in one room. This single-room design has fundamental limitations:

1. **No spatial partitioning**: All players occupy one room regardless of world position. The server broadcasts every player's state to every other player, even when they are on opposite sides of the world.
2. **Client-authoritative movement**: The client reports its own position (ADR-005, Decision 1), providing no protection against cheating and no foundation for server-driven game logic.
3. **No position persistence**: Players always spawn at (0, 0) on join. There is no session continuity.
4. **No location model**: The game world has no concept of distinct regions (cities, player farms, open world chunks).

The game design document describes three location types -- cities (static, shared), player instances (personal farms/houses), and open world (procedurally generated chunks) -- that each need different lifecycle semantics but share the same fundamental room model. This ADR addresses six architectural decisions required to replace the single-room system with a chunk-based room architecture.

This ADR covers six interconnected decisions:

1. World-Room state ownership model
2. Chunk room lifecycle strategy
3. Location type hierarchy and chunk ID naming
4. Movement authority model
5. Broadcasting strategy
6. Position persistence strategy

---

## Decision 1: World-Room State Ownership

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | The World module owns all player state authoritatively; ChunkRooms are read-only mirrors that reflect the subset of players in their chunk |
| **Why now** | Replacing the single GameRoom with multiple ChunkRooms requires defining which layer owns state to prevent split-brain scenarios |
| **Why this** | Centralizing state in the World prevents inconsistencies when players transition between rooms. The World is always consistent; rooms are derived views. |
| **Known unknowns** | Whether the single-process World singleton becomes a bottleneck at >100 concurrent players |
| **Kill criteria** | If World singleton throughput cannot handle the movement message volume (>1000 moves/sec), consider partitioning the World by region |

### Options Considered

1. **Room-Authoritative (each room owns its players' state)**
   - Pros: Simple per-room logic, no cross-room coordination needed, each room is self-contained
   - Cons: Chunk transitions require state transfer between rooms (risk of data loss or duplication), no single source of truth, querying all players requires aggregating across rooms, race conditions during room transitions
   - Effort: 3 days

2. **Shared Database as Authority (DB is the source of truth)**
   - Pros: Persistent by design, survives process restarts, enables multi-process scaling
   - Cons: Database round-trip for every move (~5-10ms per query) is too slow for real-time movement at 10 moves/sec per player, requires optimistic concurrency or locking, massively increases DB load
   - Effort: 5 days

3. **World Singleton as Authority (Selected)**
   - Pros: Single source of truth in memory (zero latency for reads/writes), chunk transitions are state updates (not state transfers), clean separation of concerns (World = state, Room = network), easy to query across chunks (e.g., getPlayersInChunk)
   - Cons: Single-process bottleneck (all state in one process), must be carefully synchronized if Colyseus scales to multiple processes, state is lost on process crash (mitigated by persistence on disconnect)
   - Effort: 3 days

### Comparison

| Criterion | Room-Authoritative | DB-Authoritative | World Singleton |
|-----------|-------------------|------------------|-----------------|
| State consistency | Fragmented | Strong (persistent) | Strong (in-memory) |
| Chunk transition safety | Risk of data loss | Safe (DB transaction) | Safe (single process) |
| Read/write latency | Zero (local) | 5-10ms (DB round-trip) | Zero (local) |
| Cross-chunk queries | Expensive (aggregate) | Easy (SQL) | Easy (in-memory map) |
| Multi-process scaling | Native | Native | Requires adaptation |
| Implementation effort | 3 days | 5 days | 3 days |
| Movement throughput | High | Low (~100 moves/sec) | High (>10K moves/sec) |

### Decision

World Singleton selected. The in-memory World module provides zero-latency state access and eliminates the split-brain risk inherent in room-authoritative designs. For a single-process Colyseus server targeting 50 concurrent players, the singleton model is the simplest correct solution. The database-authoritative approach is disqualified by latency requirements (real-time movement at 10 moves/sec cannot tolerate 5-10ms DB round-trips per move). Room-authoritative designs introduce state transfer complexity during chunk transitions that is unnecessary when a centralized authority exists.

---

## Decision 2: Chunk Room Lifecycle

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | ChunkRooms are created on demand when the first player enters a chunk and disposed automatically when the last player leaves, using Colyseus built-in `autoDispose` |
| **Why now** | The chunk-based architecture requires a room lifecycle strategy -- the world has potentially thousands of chunks but only a few will be occupied at any time |
| **Why this** | Dynamic creation avoids wasting resources on empty chunks. Colyseus `autoDispose: true` (the default) handles cleanup automatically, requiring zero custom disposal logic. |
| **Known unknowns** | Whether room creation latency (expected <50ms) causes perceptible delay during chunk transitions |
| **Kill criteria** | If room creation latency exceeds 200ms, pre-create rooms for frequently visited chunks (cities, spawn areas) |

### Options Considered

1. **Pre-Created Rooms (all possible chunks have rooms at startup)**
   - Pros: Zero creation latency on chunk entry, simple lifecycle (rooms always exist), no race conditions during first-player-enters
   - Cons: Enormous resource waste (thousands of empty rooms), does not scale with world size, requires knowing all possible chunks upfront (impossible for player instances), memory proportional to world size not player count
   - Effort: 2 days

2. **Pool-Based (pre-create a pool, assign/recycle on demand)**
   - Pros: Bounded resource usage, amortized creation cost, reuse existing room instances
   - Cons: Pool management complexity (sizing, eviction, assignment), Colyseus rooms are not designed for reassignment (room ID and state are coupled), mismatch with Colyseus room lifecycle model
   - Effort: 5 days

3. **Dynamic Creation with autoDispose (Selected)**
   - Pros: Resources proportional to active player count (not world size), Colyseus natively supports this pattern (`autoDispose: true` is the default), no custom lifecycle code needed for disposal, naturally handles all location types (cities, player instances, open world), ChunkManager mediates creation via matchMaker API
   - Cons: Room creation has non-zero latency (~10-50ms), first player to enter a chunk pays the creation cost, potential race condition if two players enter an empty chunk simultaneously (mitigated by Colyseus matchmaker serialization)
   - Effort: 3 days

### Comparison

| Criterion | Pre-Created | Pool-Based | Dynamic + autoDispose |
|-----------|-------------|------------|----------------------|
| Memory efficiency | Poor (all chunks) | Good (bounded pool) | Optimal (only active) |
| Creation latency | Zero | Near-zero (reuse) | ~10-50ms (first entry) |
| Implementation complexity | Low | High | Low |
| Colyseus alignment | Against design | Against design | Native pattern |
| Player instance support | Cannot pre-create | Complex pool keying | Natural |
| Disposal handling | Manual | Manual | Automatic |

### Decision

Dynamic creation with autoDispose selected. Colyseus is designed for on-demand room creation and automatic disposal. The framework's matchmaker handles concurrent room creation requests safely. The ~10-50ms creation latency is well within the 200ms budget for chunk transitions. Pre-creating rooms for a potentially infinite world (open world chunks + dynamic player instances) is impractical. Pool-based approaches fight Colyseus's room lifecycle model.

---

## Decision 3: Location Type Hierarchy and ChunkId Naming

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | All location types (City, Player Instance, Open World) share a unified `Location` abstraction and a type-prefixed chunkId naming convention: `world:{x}:{y}`, `city:{name}`, `player:{id}:{zone}` |
| **Why now** | The chunk-based room system needs a consistent way to identify and route players to chunks regardless of location type |
| **Why this** | A unified abstraction means ChunkRooms do not need location-type-specific logic. The type prefix in chunkId enables routing and grouping without parsing world coordinates. |
| **Known unknowns** | Whether city locations will need multi-chunk support (assumed single-chunk for Phase 1) |
| **Kill criteria** | If location types diverge so significantly in behavior that the unified ChunkRoom becomes cluttered with type-specific branches, split into specialized room classes |

### Options Considered

1. **Separate Room Classes per Location Type**
   - Pros: Each room type has focused responsibility, type-specific optimizations possible, clear separation of concerns
   - Cons: Code duplication across 3 room types (movement, broadcasting, join/leave logic is identical), adding a new location type requires a new room class, ChunkManager must know about all room types, violates the PRD requirement that "all location types share the same room model"
   - Effort: 5 days

2. **Flat Numeric ChunkId (no type prefix)**
   - Pros: Simple (just a number or coordinate pair), compact on the wire
   - Cons: Cannot distinguish location types from the ID, requires a separate lookup to determine chunk type, collisions between coordinate-based IDs and named IDs, no natural grouping
   - Effort: 2 days

3. **Unified Location with Type-Prefixed ChunkId (Selected)**
   - Pros: Single ChunkRoom class handles all location types, chunkId is self-describing (type is encoded in the prefix), easy to parse and construct, supports all three location types with one naming convention, extensible (new location types = new prefix)
   - Cons: String-based IDs are slightly less efficient than integers, parsing required to extract type/coordinates from ID, naming convention must be enforced consistently
   - Effort: 3 days

### Comparison

| Criterion | Separate Room Classes | Flat Numeric | Unified + Prefixed |
|-----------|----------------------|-------------|-------------------|
| Code duplication | High (3 classes) | None | None |
| Type identification | Implicit (class type) | Requires lookup | Encoded in ID |
| Extensibility | New class per type | Complex | New prefix only |
| ChunkRoom complexity | Low (per class) | Medium | Low |
| PRD alignment | Violates FR-2 | Partially meets | Fully meets |

### Decision

Unified Location with type-prefixed chunkId selected. The PRD explicitly requires that "all location types share the same room model, player model, and movement logic" (FR-2). A single ChunkRoom class with a self-describing chunkId achieves this. The type prefix (`world:`, `city:`, `player:`) enables routing and monitoring without requiring the room to behave differently based on location type.

**ChunkId Format**:
- Open world: `world:{chunkX}:{chunkY}` (e.g., `world:3:5`)
- City: `city:{locationName}` (e.g., `city:capital`)
- Player instance: `player:{playerId}:{zoneName}` (e.g., `player:abc123:farm`)

**Location Interface**:
```typescript
interface Location {
  id: string;
  type: LocationType; // CITY | PLAYER | OPEN_WORLD
  chunks: string[];   // Array of chunkIds belonging to this location
}
```

---

## Decision 4: Movement Authority Model

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Server-authoritative movement: client sends directional deltas (`dx`, `dy`), server validates speed and bounds, computes authoritative position, and broadcasts via Colyseus schema state patching |
| **Why now** | ADR-005 chose client-authoritative movement for MVP speed. The chunk-based architecture requires server-computed positions for chunk transition detection and establishes the foundation for server-driven game logic. |
| **Why this** | Server authority is required for correct chunk transition detection (the server must know the canonical position to determine chunk boundaries). It also eliminates teleportation/speed-hack vectors and provides the authoritative state foundation that NPCs, farming, and combat will build upon. |
| **Known unknowns** | (1) Whether the lack of client-side prediction creates unacceptable input latency feel. (2) Whether the movement feel degrades noticeably compared to the current client-authoritative system. |
| **Kill criteria** | If input latency makes movement feel unresponsive (>150ms perceived delay), add client-side prediction with server reconciliation |

### Options Considered

1. **Client-Authoritative (current approach from ADR-005)**
   - Pros: Zero perceived input latency, simplest implementation, already working in production
   - Cons: Server cannot detect chunk transitions reliably (client reports position, server must trust it), no cheat protection, server cannot enforce game rules, fundamentally incompatible with server-owned World state
   - Effort: 0 days (already implemented)

2. **Server-Authoritative with Delta Input (Selected)**
   - Pros: Server computes canonical positions (required for chunk detection), eliminates teleportation/speed-hack vectors, consistent with World-owns-state model (Decision 1), enables future server-side game logic (NPC interaction, farming timers), move-ack is implicit via Colyseus schema patching
   - Cons: Adds input latency (one round-trip for position confirmation), no client-side prediction in Phase 1 (player sees server position, not predicted position), requires speed validation and bounds checking logic on server
   - Effort: 3 days

3. **Server-Authoritative with Client-Side Prediction**
   - Pros: Best of both worlds (responsive feel + server authority), industry standard for competitive games
   - Cons: Significant implementation complexity (prediction, reconciliation, rollback), requires deterministic physics on both client and server, overkill for a cooperative farming game at MVP stage, adds ~4 days of work for a polish feature
   - Effort: 7 days

### Comparison

| Criterion | Client-Authoritative | Server + Delta | Server + Prediction |
|-----------|---------------------|----------------|---------------------|
| Input latency (perceived) | 0ms | ~50-100ms (LAN) | ~0ms (predicted) |
| Cheat protection | None | Full (speed + bounds) | Full |
| Chunk transition reliability | Unreliable | Reliable | Reliable |
| Implementation effort | 0 days | 3 days | 7 days |
| Foundation for game logic | No | Yes | Yes |
| Colyseus alignment | State relay | State authority | State authority + client prediction |

### Decision

Server-authoritative with delta input selected. This is the minimum-viable authority model that enables correct chunk transition detection and provides the server-owned state foundation required by Decision 1. Client-side prediction (Option 3) adds 4+ days of effort for a perceived-latency optimization that is less critical in a cooperative walking-speed farming game than in a competitive action game. The move-ack mechanism leverages Colyseus built-in schema patching: after the server updates the player's schema state, the patchRate interval delivers the authoritative position to all clients including the moving player.

**Move-Ack Mechanism**: When the server processes a `move` message:
1. World.movePlayer() computes the new position
2. ChunkRoom updates `ChunkRoomState.players.get(sessionId).worldX/worldY`
3. Colyseus schema patching sends the delta to all clients at the next patchRate interval
4. The moving player's client receives its own authoritative position as part of the normal state sync

This eliminates the need for a custom move-ack message. The Colyseus schema patching system already delivers the server's computed position to all clients, including the sender.

---

## Decision 5: Broadcasting Strategy

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Event-driven broadcasting via Colyseus schema state mutations and built-in patchRate delta delivery. No custom tick-based broadcasts. |
| **Why now** | The current GameRoom uses `setSimulationInterval` for tick-based updates. The chunk-based architecture replaces this with event-driven state mutations. |
| **Why this** | Colyseus schema patching already provides efficient delta broadcasting. By mutating schema state only on player events (move, join, leave), zero network traffic occurs when players are stationary. No custom broadcast logic is needed. |
| **Known unknowns** | Whether patchRate=100ms provides sufficient update frequency for responsive movement feel |
| **Kill criteria** | If broadcast latency (patchRate + network) exceeds 200ms, reduce patchRate to 50ms |

### Options Considered

1. **Tick-Based Full State Broadcast (current pattern)**
   - Pros: Simple mental model (broadcast everything every tick), guaranteed consistency (full state every tick)
   - Cons: Wastes bandwidth when players are stationary, broadcasts to all players even in different chunks (current single-room problem), does not scale with player count (O(n^2) bandwidth), requires `setSimulationInterval`
   - Effort: 0 days (already implemented)

2. **Custom Event Messages (room.broadcast per event)**
   - Pros: Full control over message format and timing, can send only to specific clients
   - Cons: Bypasses Colyseus schema patching (duplicates functionality), must manually track dirty state, must implement delta encoding manually, loses Colyseus's built-in optimization (property-level change tracking)
   - Effort: 4 days

3. **Schema Mutation + patchRate (Selected)**
   - Pros: Zero custom broadcast code (Colyseus handles delta encoding and delivery), property-level change tracking (only changed fields are sent), automatic batching within patchRate interval (multiple moves within one interval = one patch), natural event-driven behavior (no mutations = no patches = zero traffic), aligns with Colyseus design philosophy
   - Cons: patchRate introduces a fixed maximum latency (100ms with current config), all schema mutations within a patchRate window are batched (cannot send immediate updates), limited control over message format (schema-defined)
   - Effort: 1 day

### Comparison

| Criterion | Tick-Based Full | Custom Events | Schema + patchRate |
|-----------|----------------|--------------|-------------------|
| Bandwidth (idle players) | Constant | Zero | Zero |
| Implementation effort | 0 days | 4 days | 1 day |
| Delta encoding | None (full state) | Manual | Automatic |
| Colyseus alignment | Partial | Against design | Native pattern |
| Batching | Per tick | None (immediate) | Per patchRate |
| Custom code needed | SimulationInterval | Broadcast + tracking | None |

### Decision

Schema mutation + patchRate selected. Colyseus is designed around schema-based state synchronization with delta encoding. By mutating the ChunkRoomState schema only when player state changes (on move, join, leave), the system naturally achieves event-driven broadcasting with zero custom code. The patchRate interval (100ms) provides batching that reduces network overhead when multiple events occur within the same window. The existing `setSimulationInterval` tick loop in GameRoom is removed entirely.

**How Colyseus schema patching works**:
- Server mutates schema properties (e.g., `player.worldX = 103`)
- Colyseus tracks which properties changed since the last patch via internal ChangeTree
- At each patchRate interval (100ms), only changed properties are encoded and sent to connected clients
- If no properties changed, no patch is sent (zero traffic)

---

## Decision 6: Position Persistence Strategy

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Save player position to the database on disconnect only (not periodically). Load on reconnect. New players get a default spawn. |
| **Why now** | The chunk-based architecture requires position persistence for session continuity (FR-9) and correct chunk assignment on reconnect (FR-5). |
| **Why this** | Disconnect-only saves minimize database writes while guaranteeing the most recent position is preserved. The alternative (periodic saves) adds database load with diminishing returns for crash resilience. |
| **Known unknowns** | Whether server crashes (no clean disconnect) cause meaningful position loss in practice |
| **Kill criteria** | If server crashes occur frequently enough that players regularly lose significant position progress, add periodic saves at a low frequency (e.g., every 5 minutes) |

### Options Considered

1. **Periodic Saves (every N seconds)**
   - Pros: Resilient to server crashes (position loss limited to last save interval), provides a continuous audit trail of player movement
   - Cons: High database write volume (50 players * 1 write/30sec = ~100 writes/min), most writes are redundant (player hasn't moved), adds latency to the movement pipeline if synchronous, complexity of background save scheduling
   - Effort: 3 days

2. **Save on Every Move**
   - Pros: Maximum crash resilience (zero position loss), always up-to-date in DB
   - Cons: Extreme database load (50 players * 10 moves/sec = 500 writes/sec), completely impractical for real-time movement, database becomes the bottleneck
   - Effort: 1 day (but unusable)

3. **Save on Disconnect Only (Selected)**
   - Pros: Minimal database writes (one write per player per session), zero overhead during gameplay, simple implementation (single upsert in onLeave), sufficient for the expected scenario (clean disconnects via browser close or network drop)
   - Cons: Server crash loses all position state since last disconnect (players revert to last saved position), no position history for analytics, relies on `onLeave` being called (which Colyseus guarantees even for abrupt disconnects, after ping timeout)
   - Effort: 2 days

### Comparison

| Criterion | Periodic Saves | Save Every Move | Disconnect Only |
|-----------|---------------|-----------------|-----------------|
| DB writes per hour (50 players) | ~6,000 (every 30s) | ~1,800,000 (10/sec) | ~50 (one per session) |
| Crash resilience | Good (lose last interval) | Perfect | Poor (lose full session) |
| Gameplay overhead | Low (background) | Extreme (blocking) | Zero |
| Implementation complexity | Medium | Low | Low |
| Colyseus alignment | Custom scheduling | Custom hooks | Native (onLeave) |

### Decision

Disconnect-only persistence selected. For Phase 1 with a small player count (<50), the risk of server crashes causing position loss is low, and the impact is modest (players respawn at their last saved position, which for most players is their last session end position). The database write savings are substantial: ~50 writes/hour vs ~6,000/hour for periodic saves. Colyseus guarantees that `onLeave` is called even for abrupt disconnects (after the ping timeout window), so position saves are reliable for all normal disconnect scenarios.

**Persistence schema**: A `player_positions` table with `userId` (FK to users), `worldX`, `worldY`, `chunkId`, `direction`, and `updatedAt`. Upsert on disconnect.

---

## Consequences

### Positive Consequences

- **Spatial coherence**: Players only share rooms with other players in the same chunk, reducing bandwidth by orders of magnitude compared to the single-room model
- **Server authority**: The World singleton provides a single source of truth for all player state, enabling future game logic (NPCs, farming, combat) to rely on consistent server state
- **Resource efficiency**: Dynamic room creation/disposal means server resources are proportional to active player count, not world size
- **Unified architecture**: All location types (city, player instance, open world) share one room class and one movement/broadcasting model, minimizing code paths
- **Zero-traffic idle state**: Event-driven broadcasting via Colyseus schema patching means zero network traffic when players are stationary
- **Session continuity**: Position persistence enables returning players to resume where they left off

### Negative Consequences

- **Input latency increase**: Moving from client-authoritative to server-authoritative adds one round-trip of perceived latency (~50-100ms on LAN). Mitigated by future client-side prediction.
- **Single-process constraint**: The World singleton limits horizontal scaling to one Colyseus process. Acceptable for Phase 1 target of 50 players.
- **Breaking change**: Replacing GameRoom with ChunkRoom requires coordinated client and server changes. The existing multiplayer client must be updated.
- **Crash vulnerability**: Disconnect-only persistence means a server crash loses all in-flight position state. Mitigated by the low probability and modest impact at current scale.

### Neutral Consequences

- **ADR-005 partially superseded**: Decisions 1 (client-authoritative movement), 4 (schema extensions), and 7 (dual movement paths) from ADR-005 are superseded. Decisions 2 (pixel coordinates), 3 (update rate/patchRate), 5 (client-side lerp), and 6 (skin registry) remain valid and are carried forward.
- **Existing auth bridge unchanged**: The JWT verification system from ADR-003 is reused as-is in ChunkRoom.

## Implementation Guidance

- Use a singleton pattern for the World module, instantiated at server startup and passed to ChunkRooms via room options or a module-level reference
- Use Colyseus `@colyseus/schema` `@type()` decorators for all ChunkRoomState fields to enable automatic delta serialization
- Use Colyseus `autoDispose: true` (the default) for ChunkRoom disposal; do not implement custom disposal logic
- Define ChunkRoom with `filterBy: ['chunkId']` so that `joinOrCreate` routes players to the correct chunk room
- Use Drizzle ORM `onConflictDoUpdate` for position persistence upserts, consistent with the existing `findOrCreateUser` pattern in `packages/db`
- Movement validation should clamp the delta vector magnitude to MAX_SPEED, not reject the entire message
- Chunk transition should use server-sent messages with seat reservation data for the new room, allowing the client to call `consumeSeatReservation` for secure room transitions
- Remove `setSimulationInterval` entirely; no tick loop is needed with event-driven broadcasting

## Related Information

- [ADR-005: Multiplayer Position Synchronization Protocol](adr-005-multiplayer-position-sync.md) -- Partially superseded by this ADR (Decisions 1, 4, 7 superseded; Decisions 2, 3, 5, 6 retained)
- [ADR-003: Authentication Bridge](adr-003-colyseus-auth-bridge.md) -- Auth mechanism reused unchanged
- [ADR-004: Colyseus Build Tooling](adr-004-colyseus-build-tooling.md) -- Build pipeline unchanged
- [PRD-005: Chunk-Based Room Architecture](../prd/prd-005-chunk-based-room-architecture.md) -- Source requirements
- [Design Doc: Colyseus Game Server](../design/design-003-colyseus-game-server.md) -- Original server design being replaced

## References

- [Colyseus Room Lifecycle](https://docs.colyseus.io/room/) - Room creation, disposal, and autoDispose behavior
- [Colyseus State Synchronization](https://docs.colyseus.io/state/) - Schema-based delta serialization and patchRate mechanics
- [Colyseus Matchmaker API](https://docs.colyseus.io/matchmaker/) - matchMaker.createRoom, reserveSeatFor, and dynamic room management
- [Colyseus Schema Documentation](https://docs.colyseus.io/state/schema/) - @type decorators and ChangeTree delta tracking
- [Entity Interpolation (Gabriel Gambetta)](https://www.gabrielgambetta.com/entity-interpolation.html) - Client-side interpolation techniques for server-authoritative games
- [Server-Authoritative Game Architecture (Gaffer On Games)](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/) - Networking models for multiplayer games
- [Spatial Partitioning for MMO Servers (GameDev.net)](https://www.gamedev.net/forums/topic/687829-space-partitioning-for-top-down-mmo-game-on-the-server/) - Chunk-based spatial partitioning patterns

## Date

2026-02-17
