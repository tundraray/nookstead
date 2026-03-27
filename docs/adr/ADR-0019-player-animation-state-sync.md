# ADR-0019: Player Animation State Synchronization

## Status

Accepted

## Context

Nookstead's multiplayer system synchronizes player state via Colyseus schemas. Each `ChunkPlayer` schema contains position (`worldX`, `worldY`), `direction`, `skin`, `name`, and `hotbar` -- but **no animation state field**. Remote player animations are currently derived client-side in `PlayerManager.ts` by comparing the incoming schema position against the sprite's rendered position:

```typescript
const isMoving = player.worldX !== sprite.getX() || player.worldY !== sprite.getY();
sprite.updateAnimation(player.direction || 'down', isMoving ? 'walk' : 'idle');
```

This approach can only distinguish two animation states: `walk` (position changed) and `idle` (position unchanged). Any animation state that does not involve movement -- such as sitting, emoting, fishing, or crafting -- is invisible to remote players. A player who presses X to sit will appear idle to everyone else.

Meanwhile, the NPC bot system (`ChunkBot`) already has a `state` field (`@type('string')`) in its schema that is synchronized to all clients. The `BotManager.tick()` loop returns `BotUpdate` objects containing a `state` field, and `ChunkRoom` applies them to the `ChunkBot` schema each tick. `PlayerManager.ts` reads `bot.state` from the schema and maps it to the correct animation. This is an established, working pattern.

Additionally, `PositionUpdatePayload` in `packages/shared/src/types/messages.ts` already defines an `animState: string` field, but it is never populated by the client or read by the server -- evidence that this gap was anticipated but never filled.

### Key Constraints

- Colyseus Schema has a 64-field limit per class; `ChunkPlayer` currently uses 7 direct schema fields plus an `ArraySchema` for hotbar. Nested schemas (`InventorySlotSchema`, 6 fields each) count against their own separate 64-field budget, not the parent's. Adding one string field to `ChunkPlayer` (bringing it to 8) is well within the limit.
- Animation state is inherently **public** data -- all players in a room should see each other's current animation.
- The existing client FSM (`IdleState`, `WalkState`) already knows the current animation state; it is simply never transmitted to the server.
- Player state changes (idle, walk, sit) occur at most a few times per second, not every frame.

## Decision

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Add `@type('string') animState` to the `ChunkPlayer` Colyseus schema, synchronized via the existing schema patching mechanism |
| **Why now** | The sit action is the first non-movement animation state being added; the current position-delta derivation approach fundamentally cannot represent it |
| **Why this** | Schema-based sync mirrors the proven `ChunkBot.state` pattern, provides automatic delta encoding to all room clients, and requires minimal new code |
| **Known unknowns** | Whether animation state should be sent inline with position updates (extending `POSITION_UPDATE` handler) or via a dedicated `ANIM_STATE` message; the final set of valid animation state values beyond the initial `'idle' \| 'walk' \| 'sit'` |
| **Kill criteria** | If the number of distinct animation states grows beyond ~20 and transitions happen faster than 10/sec per player, revisit whether schema string updates are bandwidth-efficient vs. an enum/integer encoding |

## Rationale

### Options Considered

1. **Option A: Schema-Based Sync (Selected)** -- Add `animState` field to `ChunkPlayer` schema

   - Overview: A new `@type('string') animState` field on `ChunkPlayer`. The server updates this field when it receives animation state changes from the client. Colyseus automatically delta-patches the value to all room clients. `PlayerManager.ts` reads `player.animState` from the schema instead of deriving it from position deltas.
   - Pros:
     - Matches the established `ChunkBot.state` pattern exactly -- same mechanism, same consumer code shape in `PlayerManager.ts`
     - Automatic delta encoding and broadcast via Colyseus schema patching -- no manual message routing needed
     - Remote players see animation state changes with the same latency as position changes (one patch cycle)
     - `PositionUpdatePayload` already has an `animState` field that can be activated (no new message type needed for the initial implementation)
   - Cons:
     - Adds one string field to `ChunkPlayer` schema (marginal increase in baseline state size per player)
     - Every `animState` change generates a schema patch to all clients, even if some clients are far away (within the same room/chunk)
   - Effort: ~1 day

2. **Option B: Message-Based Sync** -- Dedicated `ClientMessage.ANIM_STATE` message, server broadcasts to room

   - Overview: Client sends a `{ animState: string }` message when animation state changes. Server validates and broadcasts to all other clients in the room. Clients maintain a local `animState` map keyed by session ID.
   - Pros:
     - Only sends data on actual state changes (no per-tick overhead if state is unchanged)
     - Bandwidth-efficient for very infrequent state changes
   - Cons:
     - Requires manual broadcast logic on server and a local state cache on each client
     - Does not benefit from Colyseus delta encoding -- must handle late-joining clients manually (they would miss the broadcast)
     - Diverges from the established `ChunkBot.state` schema pattern, creating an inconsistency in the codebase
     - Late-joining players would not see the current animation state of existing players without additional "catch-up" logic
   - Effort: ~2 days

3. **Option C: Enhanced Client-Side Derivation** -- Add more heuristics to the position-delta approach

   - Overview: Extend the `PlayerManager.ts` derivation logic with additional signals (e.g., velocity = 0 for N frames + special flag = sitting). Potentially use a separate metadata message to hint at non-movement states.
   - Pros:
     - No schema changes; no server-side changes
     - Zero additional bandwidth for movement-based states
   - Cons:
     - Fundamentally cannot detect non-movement states (sitting, emoting, crafting) from position data alone -- this is the core problem
     - Adding hints effectively becomes Option B with extra indirection
     - Fragile heuristics that break as new states are added
     - Violates single source of truth -- animation state would be partially derived, partially hinted
   - Effort: ~1 day initially, growing with each new state

### Comparison

| Evaluation Axis | Option A: Schema Sync | Option B: Message Sync | Option C: Client Derivation |
|---|---|---|---|
| Implementation effort | 1 day | 2 days | 1 day + ongoing |
| Consistency with existing patterns | High (`ChunkBot.state`) | Low (new pattern) | N/A (keeps broken pattern) |
| Late-join correctness | Automatic (schema) | Requires catch-up logic | N/A |
| Bandwidth impact | Minimal (string delta) | Minimal (on-change only) | None |
| Extensibility to new states | Add string value | Add string value | New heuristic per state |
| Non-movement state support | Yes | Yes | No |
| Code complexity | Low | Medium | High (growing) |

**Selected: Option A (Schema-Based Sync)**

The decision aligns with the principle of following existing patterns. `ChunkBot` already synchronizes its animation state via schema, and `PlayerManager.ts` already reads it. Applying the same approach to `ChunkPlayer` creates symmetry between player and bot animation handling, reduces cognitive load for developers, and handles edge cases (late-joining clients, reconnection) automatically through Colyseus's built-in state synchronization.

## Consequences

### Positive Consequences

- Remote players can see all animation states (sit, emote, craft, fish, etc.) without per-state heuristics
- Animation synchronization becomes consistent between players and bots -- one pattern, one consumer code path in `PlayerManager.ts`
- Late-joining players automatically receive the current `animState` of all existing players via full state sync
- The unused `PositionUpdatePayload.animState` field can be activated, turning dead code into live code
- Foundation for all future non-movement animations without additional architecture changes

### Negative Consequences

- One additional string field per player in the room schema (approximately 10-20 bytes per player when serialized)
- Every animation state change broadcasts to all room clients, regardless of distance -- acceptable given room-level granularity already applies to position updates

### Neutral Consequences

- `PlayerManager.ts` derivation logic for remote players is replaced, not extended -- client-side animation derivation becomes dead code that should be removed
- The `animState` type (currently a plain `string`) may later be narrowed to a union type or enum; this ADR does not prescribe the exact type, only the synchronization mechanism

## Implementation Guidance

- Add the `animState` field to `ChunkPlayer` in `ChunkRoomState.ts` as `@type('string')`, matching the `ChunkBot.state` pattern
- Add `animState` to the `PlayerState` interface in `packages/shared/src/types/room.ts` so the shared type reflects the schema
- Use the existing `ClientMessage.POSITION_UPDATE` handler to accept the `animState` field from `PositionUpdatePayload` (which already defines it); alternatively, add a dedicated `ClientMessage.ANIM_STATE` message if animation state changes independently of position
- Default `animState` to `'idle'` on player join
- In `PlayerManager.ts`, read `player.animState` from the schema for remote player animation instead of deriving it from position deltas
- Validate `animState` values on the server to prevent injection of arbitrary strings (accept a known set of values)
- Follow the fail-fast principle: reject unrecognized `animState` values with a warning log, do not silently accept them

## Related Information

- [ADR-0006: Chunk-Based Room Architecture](./ADR-0006-chunk-based-room-architecture.md) -- Established the ChunkRoom/ChunkPlayer schema structure
- [ADR-0013: NPC Bot Entity Architecture](./ADR-0013-npc-bot-entity-architecture.md) -- Established `ChunkBot.state` schema pattern and `BotManager` tick loop
- [ADR-0018: Inventory System Architecture](./ADR-0018-inventory-system-architecture.md) -- Example of hybrid schema/message sync decisions; precedent for public-state-via-schema principle
- `apps/server/src/rooms/ChunkRoomState.ts` -- `ChunkPlayer` and `ChunkBot` schema definitions
- `apps/game/src/game/multiplayer/PlayerManager.ts:141-153` -- Current position-delta derivation (to be replaced)
- `packages/shared/src/types/messages.ts:52-57` -- `PositionUpdatePayload` already defines unused `animState` field
- [Colyseus Schema Documentation](https://docs.colyseus.io/state/schema) -- Schema field types and delta encoding behavior
