# ADR-005: Multiplayer Position Synchronization Protocol

## Status

Proposed

## Context

Nookstead is a 2D pixel art MMO built with Phaser.js 3 (client) and Colyseus (game server). The Colyseus game server (ADR-003, ADR-004) synchronizes player state across clients using `@colyseus/schema` delta serialization. We need a protocol for:

1. Syncing the local player's continuous keyboard movement to the server and to other clients
2. Rendering remote players with actual character sprites (skin, direction, animation state) rather than colored rectangles
3. Displaying smooth remote player movement despite a 10 ticks/sec server update rate

The current implementation has several gaps:

- **Player schema is minimal**: `GameRoomState.Player` tracks only `userId`, `x`, `y`, `name`, and `connected`. It lacks `skin`, `direction`, and `animState` fields needed to render character sprites for remote players.
- **Only click-to-move exists**: The `PlayerManager.sendMove()` method sends tile coordinates via the `MOVE` message. Continuous keyboard movement (WASD/arrows) produces pixel-coordinate positions at 60fps on the client but has no server sync path.
- **No remote player interpolation**: `PlayerSprite.moveTo()` snaps to positions immediately, causing visible stuttering at 10 updates/sec.
- **Skin registry collision**: All 6 scout skins share the same `sheetKey: 'char-scout'`. When multiple spritesheets are loaded with the same Phaser texture key, only the last one loaded is used. Remote players cannot have distinct visual appearances.
- **No movement authority model**: The server currently accepts `MOVE` payloads and writes them directly to player state without validation, but this is not an explicit architectural decision.

### Current Architecture Snapshot

```
Client (Phaser.js 3)                    Server (Colyseus)
--------------------------              --------------------------
Player entity (keyboard)  ---[MOVE]-->  GameRoom.handleMove()
  - uses pixel coords                    - writes tile coords to
  - 60fps local movement                   Player schema (x, y)
                                         - 10 ticks/sec patch rate
PlayerSprite (remote)     <--[patch]--  GameRoomState delta sync
  - snaps to tile positions               - sends changed fields only
  - colored rectangles only
```

### Key Constraints

- **MVP scope**: This is early development; competitive integrity is not a priority. Simplicity and iteration speed are paramount.
- **Server has no map data**: The map is procedurally generated client-side (seed-based). The server does not load terrain or walkability grids, ruling out server-side collision checks without significant additional work.
- **10 ticks/sec server rate**: `TICK_RATE = 10` and `PATCH_RATE_MS = 100` are established constants in `@nookstead/shared`. The sync protocol must work within this update cadence.
- **Colyseus schema-based sync**: State changes propagate via `@colyseus/schema` delta serialization. Adding fields to `Player` schema is straightforward but affects network bandwidth proportionally.

## Decision Areas

This ADR covers seven related protocol decisions that together define how multiplayer position synchronization works.

---

### Decision 1: Client-Authoritative Movement

#### Alternatives Considered

##### 1A. Client-Authoritative Movement (CHOSEN)

The client calculates movement locally and sends resulting positions to the server. The server accepts positions without physics validation and writes them directly to the player schema for broadcast.

- **Overview**: Trust the client; server is a relay for position state.
- Benefits:
  - Simplest possible implementation -- server does not need map data, collision logic, or physics simulation
  - Zero perceived input latency for the local player -- movement is applied immediately at 60fps
  - No need for client-side prediction or reconciliation (the client IS the authority)
  - Fastest path to a working multiplayer prototype
- Drawbacks:
  - Allows cheating (teleportation, speed hacks) -- any position the client sends is accepted
  - No server-side validation of movement legality
  - Cannot enforce game rules server-side (e.g., blocked tiles, movement speed limits)

##### 1B. Server-Authoritative Movement

The client sends input commands (direction + speed) to the server. The server runs physics simulation, validates movement against the map, and broadcasts authoritative positions.

- Benefits:
  - Cheat-proof -- server validates all movement
  - Single source of truth for collision detection
  - Required for competitive gameplay
- Drawbacks:
  - Server must load and process map data (walkability grids, terrain modifiers)
  - Adds input latency (client must wait for server response)
  - Requires client-side prediction and server reconciliation to feel responsive
  - Significant implementation complexity for MVP

##### 1C. Hybrid (Client-Authoritative with Server Validation)

Client moves immediately and sends positions. Server validates against bounds/speed limits and corrects if invalid, but does not run full physics.

- Benefits:
  - Some cheat protection (bounds checking, speed limiting)
  - Lower latency than full server-authoritative
  - Does not require full map data on server
- Drawbacks:
  - Partial cheat protection may not justify the complexity
  - Correction snapping creates a poor player experience
  - Still requires the server to understand map boundaries and movement speed

#### Comparison

| Criterion | Client-Authoritative | Server-Authoritative | Hybrid |
|---|---|---|---|
| Implementation effort | Low | High | Medium |
| Input latency | None (local) | High (round-trip) | None + corrections |
| Cheat resistance | None | Full | Partial |
| Server map data needed | No | Yes (full) | Yes (partial) |
| MVP suitability | High | Low | Medium |
| Client-side prediction | Not needed | Required | Partial |

#### Decision

| Item | Content |
|---|---|
| **Decision** | Use client-authoritative movement: the client sends pixel positions and the server accepts them without validation |
| **Why now** | Keyboard movement is implemented client-side; we need a sync path to broadcast local movement to other clients |
| **Why this** | MVP simplicity -- the server has no map data and cannot validate movement. Adding server-side physics would require duplicating the procedural map generation and movement system on the server. Client-authoritative movement lets us ship multiplayer movement with minimal server changes. |
| **Known unknowns** | (1) At what player count cheating becomes a practical concern. (2) Whether future NPC AI movement will require server-side collision detection, which could then be reused for player validation. |
| **Kill criteria** | If cheating disrupts gameplay for honest players (e.g., teleportation griefing), migrate to hybrid validation with server-side bounds checking as a first step. |

---

### Decision 2: Pixel Coordinates over Tile Coordinates

#### Alternatives Considered

##### 2A. Pixel Coordinates for Position Sync (CHOSEN)

Position updates use floating-point pixel coordinates (`x: 152.7, y: 340.2`), providing sub-tile precision for smooth continuous movement.

- Benefits:
  - Matches the client's internal coordinate system (the movement system in `systems/movement.ts` already operates in pixel space)
  - Sub-tile precision allows smooth rendering -- players are not locked to a 16x16 grid
  - No coordinate conversion needed on the sending side
  - Supports the existing movement speed modifiers and wall-sliding collision at pixel granularity
- Drawbacks:
  - Higher bandwidth than integer tile coordinates (floating-point numbers are larger on the wire)
  - Server stores positions that have no semantic meaning without map context

##### 2B. Tile Coordinates for Position Sync

Position updates use integer tile coordinates (`tileX: 9, tileY: 21`), matching the existing `MOVE` message format.

- Benefits:
  - Smaller payload (integers vs floats)
  - Aligned with tile-based game logic (farming, building, interaction)
  - Matches existing `MovePayload` interface
- Drawbacks:
  - Loses sub-tile precision -- movement snaps to 16x16 tile grid
  - Continuous keyboard movement feels choppy when quantized to tiles
  - Requires pixel-to-tile conversion on send and tile-to-pixel conversion on receive

##### 2C. Fixed-Point Integer Coordinates

Encode pixel positions as integers with implicit precision (e.g., multiply by 10: `1527` represents `152.7`).

- Benefits:
  - More compact than floating-point on the wire
  - Preserves sub-tile precision
  - Deterministic across platforms (no floating-point variance)
- Drawbacks:
  - Added complexity for marginal bandwidth savings
  - Colyseus schema `@type('number')` uses float64 anyway; no wire savings within the schema
  - Extra encode/decode step on both sides

#### Comparison

| Criterion | Pixel (float) | Tile (int) | Fixed-Point |
|---|---|---|---|
| Precision | Sub-tile | Tile-locked | Sub-tile |
| Bandwidth per update | ~16 bytes (2x float64) | ~8 bytes (2x int32) | ~8 bytes (2x int32) |
| Client conversion needed | None | pixelToTile on send | multiply on send |
| Visual smoothness | Smooth | Choppy | Smooth |
| Implementation complexity | Low | Low | Medium |

#### Decision

| Item | Content |
|---|---|
| **Decision** | Use pixel coordinates for continuous position sync via a new `POSITION_UPDATE` message type; keep tile coordinates for the existing `MOVE` (click-to-move) message |
| **Why now** | Keyboard movement produces pixel-precision positions; quantizing to tiles would degrade the movement feel that was carefully implemented in the movement system |
| **Why this** | The movement system (`systems/movement.ts`) already operates in pixel space with sub-tile collision detection and terrain speed modifiers. Converting to tile coordinates would lose this precision. The bandwidth difference (~8 bytes per update at 10 updates/sec = ~80 bytes/sec extra) is negligible. |
| **Known unknowns** | (1) Whether Colyseus schema float64 precision creates cross-platform issues. (2) Whether the additional `POSITION_UPDATE` message type creates confusion vs. the existing `MOVE` message. |
| **Kill criteria** | If bandwidth becomes a concern at scale, switch to fixed-point integer encoding (Option 2C) or reduce update rate. |

---

### Decision 3: Position Update Rate (10 updates/sec)

#### Alternatives Considered

##### 3A. Match Server Tick Rate: 10 updates/sec (CHOSEN)

Throttle client-side position updates to 10 per second, matching the server's `TICK_RATE` constant and `PATCH_RATE_MS = 100`.

- Benefits:
  - No wasted bandwidth -- sending faster than the server processes/patches is pointless
  - Aligned with server tick rate, simplifying reasoning about sync timing
  - Client-side movement remains at 60fps for responsiveness; only the network send is throttled
  - 10 updates/sec is sufficient for walking-speed movement in a 2D game (100px/sec at 16px tiles)
- Drawbacks:
  - Up to 100ms of positional staleness for remote players (before interpolation)
  - Fast-moving entities may appear to "jump" without interpolation

##### 3B. Higher Rate: 20-30 updates/sec

Send position updates at 2-3x the server tick rate.

- Benefits:
  - More position samples for smoother remote player rendering
  - Lower positional staleness
- Drawbacks:
  - Server only patches at 100ms intervals -- excess updates are partially wasted
  - 2-3x bandwidth increase with diminishing returns
  - May overload server message processing at higher player counts

##### 3C. Variable / Adaptive Rate

Send updates only when the player's position changes by more than a threshold (e.g., 2 pixels).

- Benefits:
  - Zero bandwidth when idle
  - Adaptive to actual movement
- Drawbacks:
  - Complex implementation (threshold tuning, edge cases when stopping)
  - Unpredictable update timing complicates interpolation
  - May miss direction/animation changes if position delta is small

#### Comparison

| Criterion | 10 updates/sec | 20-30 updates/sec | Adaptive |
|---|---|---|---|
| Bandwidth (per player) | ~1.6 KB/s | ~3.2-4.8 KB/s | Variable |
| Positional staleness | up to 100ms | up to 33-50ms | Variable |
| Implementation complexity | Low | Low | Medium-High |
| Server alignment | Matched | Excess | Variable |
| Idle efficiency | Sends while idle | Sends while idle | Zero when idle |

#### Decision

| Item | Content |
|---|---|
| **Decision** | Throttle position updates to 10/sec, matching `TICK_RATE`; client-side movement continues at 60fps |
| **Why now** | Without throttling, keyboard movement would generate 60 network messages per second per player |
| **Why this** | Sending faster than the server's patch rate wastes bandwidth with no visual benefit. 10 updates/sec combined with client-side interpolation provides smooth enough rendering for walking-speed movement in a pixel art game. |
| **Known unknowns** | (1) Whether 10 updates/sec feels smooth enough for fast interactions (combat, dodging) in later development. (2) Whether idle players should stop sending (could be optimized later). |
| **Kill criteria** | If remote player movement feels unacceptably jerky even with interpolation, increase to 20 updates/sec and evaluate bandwidth impact. |

---

### Decision 4: Colyseus Schema Extensions

#### Decision

Extend the `Player` schema in `GameRoomState` with three new fields for character rendering.

| Item | Content |
|---|---|
| **Decision** | Add `@type('string') skin`, `@type('string') direction`, and `@type('string') animState` fields to the `Player` schema class |
| **Why now** | Remote players are rendered as colored rectangles because the schema lacks visual state. Character sprites require skin identity, facing direction, and animation state. |
| **Why this** | Colyseus `@type` decorators provide delta serialization automatically -- only changed fields are sent. String types are appropriate: `skin` changes rarely (on join only), `direction` and `animState` change with movement. This adds minimal overhead per update (~20 bytes for direction + animState string changes). |
| **Known unknowns** | (1) Whether string-typed direction/animState create excessive serialization overhead vs. enum-mapped integers. (2) Whether additional visual state (e.g., equipped items, emotes) will require further schema extensions. |
| **Kill criteria** | If profiling shows string serialization is a bandwidth bottleneck, switch `direction` and `animState` to `@type('uint8')` with enum mapping. |

#### Schema Design

**Current Player schema** (`apps/server/src/rooms/GameRoomState.ts`):
```
Player { userId, x, y, name, connected }
```

**Extended Player schema**:
```
Player { userId, x, y, name, connected, skin, direction, animState }
```

New fields:
- `skin: string` -- Character skin identifier (e.g., `'scout_3'`). Set once on join from a random selection of available skins. Used by clients to load the correct spritesheet.
- `direction: string` -- Facing direction (`'up'`, `'down'`, `'left'`, `'right'`). Updated with each position update. Used by clients to select the correct animation direction.
- `animState: string` -- Animation state name (`'idle'`, `'walk'`, etc.). Updated with each position update. Used by clients to play the correct animation.

#### Shared Type Alignment

The `PlayerState` interface in `@nookstead/shared` (`packages/shared/src/types/room.ts`) must also be extended with `skin`, `direction`, and `animState` fields to maintain parity with the server schema.

---

### Decision 5: Linear Interpolation for Remote Players

#### Alternatives Considered

##### 5A. Simple Linear Interpolation (Lerp) (CHOSEN)

Interpolate remote player positions between the last two received positions using `Phaser.Math.Linear` or equivalent lerp. Each frame, advance the interpolation factor `t` based on elapsed time divided by the expected update interval (100ms).

- Benefits:
  - Simple to implement (~20 lines of code)
  - No input buffer management
  - Zero additional latency beyond the inherent server tick delay
  - Well-suited for walking-speed movement in a 2D pixel art game
  - Phaser provides built-in `Phaser.Math.Linear` utility
- Drawbacks:
  - If an update is late or dropped, the player overshoots or freezes at the target position
  - No jitter compensation
  - Slightly jerky when update intervals are inconsistent

##### 5B. Buffer-Based Interpolation (Snapshot Interpolation)

Buffer 2-3 position snapshots with timestamps and interpolate between them with an intentional delay (e.g., render 100ms behind real-time).

- Benefits:
  - Handles jitter and packet loss gracefully
  - Smoother rendering even with inconsistent update timing
  - Industry-standard approach for competitive multiplayer games
- Drawbacks:
  - Adds 100-200ms of visual latency (renders behind real-time)
  - Requires timestamp synchronization between client and server
  - Buffer management complexity (underrun/overrun handling)
  - Over-engineered for a cooperative 2D farming game at MVP stage

##### 5C. Dead Reckoning (Extrapolation)

Predict future positions based on the last known velocity vector. Correct when actual position arrives.

- Benefits:
  - Can render ahead of received data, reducing perceived latency
  - Works well for constant-velocity movement
- Drawbacks:
  - Prediction errors cause visible corrections (rubber-banding)
  - Poor for stop-start movement patterns (farming, talking to NPCs)
  - Requires velocity data in the sync protocol
  - Complex correction smoothing needed

#### Comparison

| Criterion | Lerp | Buffer-Based | Dead Reckoning |
|---|---|---|---|
| Implementation complexity | Low | High | Medium |
| Added latency | 0ms | 100-200ms | Negative (predictive) |
| Jitter tolerance | Low | High | Medium |
| Packet loss handling | Poor | Good | Medium |
| Suitability for walking speed | High | High | Medium |
| Visual artifacts | Minor freezing | None | Rubber-banding |
| MVP appropriateness | High | Low | Low |

#### Decision

| Item | Content |
|---|---|
| **Decision** | Use simple linear interpolation (lerp) between the last two received positions for remote player rendering |
| **Why now** | Without interpolation, remote players visually snap between positions 10 times per second, which looks jarring even in a pixel art game |
| **Why this** | Simple lerp is the minimum viable interpolation. At 10 updates/sec with walking-speed movement (~100 px/sec), the distance between updates is ~10 pixels (~0.6 tiles). Lerp smooths this small gap effectively. Buffer-based interpolation adds unnecessary latency and complexity for a cooperative game. Dead reckoning is poorly suited for stop-start movement patterns typical of a farming/life sim. |
| **Known unknowns** | (1) Whether inconsistent network conditions create noticeable jitter with simple lerp. (2) Whether animation transitions (walk to idle) need special handling at interpolation boundaries. |
| **Kill criteria** | If network jitter makes remote movement unacceptably jerky, upgrade to buffer-based interpolation with a 100ms buffer. |

---

### Decision 6: Skin Registry Fix (Unique Sheet Keys)

#### Decision

Each character skin must use a unique `sheetKey` in the skin registry. The current implementation uses `'char-scout'` as the `sheetKey` for all 6 scout skin variants, which causes Phaser to overwrite the texture atlas -- only the last-loaded spritesheet is available.

| Item | Content |
|---|---|
| **Decision** | Change each skin's `sheetKey` to match its unique `key` (e.g., `scout_1` through `scout_6`). Update animation key generation to use the skin-specific `sheetKey`. |
| **Why now** | Multiplayer requires distinct visual appearances per player. The current shared `sheetKey` makes all players look identical regardless of assigned skin. |
| **Why this** | This is a bug fix, not an architectural choice. The `SkinDefinition.sheetKey` was designed to be the Phaser texture key, but all entries were given the same value. The fix is to make each `sheetKey` unique so each spritesheet loads as a distinct texture in Phaser's texture manager. |
| **Known unknowns** | (1) Whether animation keys (e.g., `scout_1_idle_down`) create naming conflicts with any existing animation definitions. (2) Whether all 6 spritesheets have identical frame layouts (required for shared animation frame indices). |
| **Kill criteria** | N/A -- this is a correctness fix. |

#### Current vs. Fixed Registry

**Current** (broken -- all share `'char-scout'`):
```
{ key: 'scout_1', sheetPath: 'characters/scout_1.png', sheetKey: 'char-scout' }
{ key: 'scout_2', sheetPath: 'characters/scout_2.png', sheetKey: 'char-scout' }
...
```

**Fixed** (each has unique `sheetKey`):
```
{ key: 'scout_1', sheetPath: 'characters/scout_1.png', sheetKey: 'scout_1' }
{ key: 'scout_2', sheetPath: 'characters/scout_2.png', sheetKey: 'scout_2' }
...
```

Animation keys change accordingly: `char-scout_idle_down` becomes `scout_1_idle_down`, `scout_2_idle_down`, etc.

---

### Decision 7: Dual Movement Paths

#### Decision

Maintain both keyboard continuous movement and click-to-move as separate input paths with distinct message types and coordinate systems.

| Item | Content |
|---|---|
| **Decision** | Keep both movement input methods: keyboard sends `POSITION_UPDATE` (pixel coordinates, throttled to 10/sec), click-to-move sends `MOVE` (tile coordinates, instant). The server handles both message types. |
| **Why now** | Keyboard movement is already implemented client-side (WASD/arrows via `InputController` + `WalkState`). Click-to-move is already wired via `PlayerManager.sendMove()`. Both are needed: keyboard for exploration, click-to-move for precision interactions (farming, NPC dialogue). |
| **Why this** | Unifying both into a single message type would require either losing tile precision (if using pixel coords for everything) or adding coordinate conversion overhead. Keeping them separate preserves each input method's natural coordinate system and allows independent evolution (e.g., click-to-move could later add pathfinding). |
| **Known unknowns** | (1) Whether both movement paths can be active simultaneously and how conflicts are resolved (e.g., keyboard movement during a click-to-move path). (2) Whether the `POSITION_UPDATE` message needs direction and animState fields or if those should only be on the schema. |
| **Kill criteria** | If maintaining two message types creates integration bugs or confuses the codebase, unify into a single pixel-coordinate `POSITION_UPDATE` and convert click-to-move coordinates on the client before sending. |

#### Message Protocol Design

```
ClientMessage.MOVE (existing):
  { x: number, y: number }        // tile coordinates (integers)
  Trigger: pointer click on tile
  Server action: set player.x/y to tileX * TILE_SIZE, player.y to tileY * TILE_SIZE

ClientMessage.POSITION_UPDATE (new):
  { x: number, y: number,         // pixel coordinates (floats)
    direction: string,             // 'up' | 'down' | 'left' | 'right'
    animState: string }            // 'idle' | 'walk' | ...
  Trigger: keyboard movement, throttled to 10/sec
  Server action: set player.x, player.y, player.direction, player.animState
```

---

## Consequences

### Positive

1. **Rapid MVP delivery** -- Client-authoritative movement with no server validation is the fastest path to functional multiplayer movement.
2. **Smooth local experience** -- 60fps local movement with 10/sec network sync preserves the responsive feel of single-player movement.
3. **Visual identity** -- Schema extensions and skin registry fixes enable distinct character appearances for each player.
4. **Smooth remote rendering** -- Linear interpolation eliminates the jarring 10fps snapping for remote players.
5. **Flexible input methods** -- Dual movement paths support both exploration (keyboard) and precision interaction (click-to-move).
6. **Minimal server changes** -- The server remains a simple state relay; no map loading, physics, or pathfinding required.

### Negative

1. **No cheat protection** -- Client-authoritative movement allows teleportation, speed hacking, and position spoofing. This is an explicit trade-off for MVP simplicity.
2. **Schema/shared type maintenance** -- Three new fields in the `Player` schema must be mirrored in the `@nookstead/shared` `PlayerState` interface. Schema changes require coordinated updates.
3. **Two message types for movement** -- `MOVE` and `POSITION_UPDATE` serve different input methods but both modify player position, creating potential confusion and race conditions.
4. **Simple lerp limitations** -- Network jitter or packet loss will cause visible artifacts (freezing, snapping) that buffer-based interpolation would handle.
5. **Bandwidth per player increases** -- Adding `direction` and `animState` to delta patches increases per-tick payload. At 50 players, this is ~50 * 3 fields * ~10 bytes * 10 Hz = ~15 KB/s additional server egress.

### Migration Path

When cheat protection becomes necessary:

1. **Phase 1 (Hybrid validation)**: Add server-side bounds checking and speed limiting. The server compares consecutive positions and rejects impossible movements (e.g., > 200px between ticks). Does not require map data.
2. **Phase 2 (Server-authoritative)**: Load map walkability data on the server (share seed + generation algorithm). Server runs collision checks and corrects invalid positions. Client implements prediction + reconciliation.
3. **Phase 3 (Full authority)**: Server runs the movement simulation. Client sends input commands only. Requires client-side prediction and lag compensation.

## Implementation Guidance

- Use Colyseus `@type()` decorators for all new `Player` schema fields to enable automatic delta serialization
- Throttle `POSITION_UPDATE` messages on the client using a timestamp check (e.g., `Date.now() - lastSendTime >= 100`), not `setInterval`, to avoid timer drift
- Implement lerp in the Phaser `update` loop, not in the Colyseus `onChange` callback, to decouple rendering from network events
- Assign skins randomly on the server in `onJoin()` to avoid client-side manipulation of skin selection
- Register animations for all loaded skins in the Preloader scene, not on-demand, to prevent animation registration races
- Keep the `MOVE` handler backward-compatible: convert tile coordinates to pixel coordinates before writing to the player schema (`x = tileX * TILE_SIZE + TILE_SIZE / 2`)

## Related Information

- [ADR-003: Authentication Bridge between NextAuth and Colyseus](adr-003-colyseus-auth-bridge.md) -- Establishes the Colyseus room lifecycle and `onAuth`/`onJoin` hooks
- [ADR-004: Build and Serve Tooling for Colyseus Game Server](adr-004-colyseus-build-tooling.md) -- Establishes the server build pipeline and ESM configuration
- [Design Doc: Colyseus Game Server](../design/design-003-colyseus-game-server.md) -- Detailed implementation design for the game server
- [PRD-002: Colyseus Game Server](../prd/prd-002-colyseus-game-server.md) -- Feature requirements for multiplayer
- Nookstead GDD (Section 5 - Multiplayer Infrastructure, Section 7.7 - Character Movement) -- Game design constraints

## References

- [Colyseus Best Practices](https://docs.colyseus.io/state/best-practices) - Official guidance on state synchronization patterns
- [Colyseus Schema Definition](https://docs.colyseus.io/state/schema) - `@type` decorator usage and delta serialization behavior
- [Colyseus Client-Predicted Input Tutorial (Phaser)](https://learn.colyseus.io/phaser/3-client-predicted-input) - Client-side prediction patterns with Phaser.js
- [Colyseus State Synchronization](https://docs.colyseus.io/state) - How Colyseus tracks and broadcasts property-level changes
- [Entity Interpolation (Gabriel Gambetta)](https://www.gabrielgambetta.com/entity-interpolation.html) - Comprehensive guide to entity interpolation techniques in multiplayer games
- [Snapshot Interpolation (Gaffer On Games)](https://gafferongames.com/post/snapshot_interpolation/) - Buffer-based interpolation with jitter compensation
- [Client-Side Linear Interpolation Implementation](https://webdva.github.io/how-i-implemented-client-side-linear-interpolation/) - Practical lerp implementation for 2D multiplayer
- [GameDev.net: Smooth Movement With Interpolation](https://www.gamedev.net/forums/topic/680461-smooth-movement-with-interpolation-and-all-that-stuff/) - Community discussion on interpolation approaches

## Date

2026-02-16
