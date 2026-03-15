# ADR-0018: Inventory System Architecture

## Status

Proposed

## Context

Nookstead requires an inventory system that serves both players and NPCs. Players carry tools, seeds, harvested crops, and crafted items. NPCs (bot companions) carry role-appropriate items with distinct ownership semantics (personal items vs employer-owned items). The system must integrate with the existing Colyseus multiplayer architecture (ChunkRoom, ChunkRoomState, BotManager) and the Phaser.js client HUD (Hotbar, HotbarSlot).

Four interrelated architectural decisions must be resolved:

1. **Synchronization strategy** -- how inventory data reaches the client
2. **Data model scope** -- whether players and NPCs share a model
3. **Item definition storage** -- where the item catalog lives
4. **Ownership model** -- how item provenance is tracked

### Key Constraints

- Colyseus Schema has a 64-field limit per class; inventory slots must not bloat the player schema
- Hotbar (10 slots) needs real-time sync (other players see equipped items); backpack does not
- The existing `ChunkRoomState` already synchronizes `ChunkPlayer` and `ChunkBot` via MapSchema
- Item definitions are game-design-time data (immutable during gameplay); runtime state is mutable
- NPCs must track ownership (e.g., farmer harvests carrots belonging to the farm, not themselves)

## Decision

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Adopt a hybrid sync strategy with a universal inventory model, static item definitions in shared package, and slot-level ownership tracking |
| **Why now** | The Hotbar component exists with placeholder data (`Array(10).fill(null)`); the NPC bot system is operational; both need real inventory data to progress toward gameplay |
| **Why this** | Hybrid sync balances bandwidth (schema for 10 hotbar slots) with simplicity (messages for backpack); universal model avoids parallel inventory code paths; static definitions in shared package are consistent with existing `GAME_OBJECT_TYPES` pattern |
| **Known unknowns** | Optimal max stack sizes per item type; whether 64-field schema limit will constrain hotbar slot richness; NPC inventory size tuning per role |
| **Kill criteria** | If hotbar schema sync causes measurable frame drops at 20+ players per room, revisit with pure message-based sync |

## Rationale

### Decision 1: Synchronization Strategy

#### Options Considered

1. **Option A: Full Schema Sync** -- All inventory slots (hotbar + backpack) as Colyseus Schema arrays
   - Pros: Simplest mental model; automatic delta encoding; no manual message handling
   - Cons: 20 slots x N fields per slot risks hitting 64-field limit on ChunkPlayer; backpack changes generate unnecessary network traffic to all room clients; large state footprint for data only the owning client needs

2. **Option B: Full Message Sync** -- All inventory operations via request/response messages
   - Pros: Most bandwidth-efficient; only sends data when requested; no schema bloat
   - Cons: Hotbar changes are not visible to other players in real-time; requires manual cache invalidation on client; higher implementation complexity for the hotbar (which needs to feel instant)

3. **Option C: Hybrid Sync (Selected)** -- Hotbar (slots 1-10) via Colyseus Schema on `ChunkPlayer`; backpack (slots 11-20+) via explicit ClientMessage/ServerMessage pairs
   - Pros: Hotbar updates are real-time and visible to all room participants (other players can see what you are holding); backpack data is only sent to the requesting client, saving bandwidth; schema stays within 64-field limit (10 slots add ~30-40 fields); consistent with existing pattern where positional data is schema-synced but dialogue data is message-based
   - Cons: Two sync paths to maintain; client must merge schema hotbar data with message-based backpack data into a unified view

**Selected: Option C (Hybrid Sync)**

The hotbar is a public-facing UI element (other players should see your equipped tool). The backpack is private. This natural split maps cleanly onto schema (broadcast) vs messages (unicast). The existing codebase already uses this exact pattern: player position is schema-synced, while dialogue content is message-based.

### Decision 2: Data Model Scope

#### Options Considered

1. **Option A: Separate Player/NPC Models** -- Independent inventory tables and types for players vs NPCs
   - Pros: Each model can be optimized independently; no coupling between player and NPC systems
   - Cons: Duplicated logic for add/remove/stack/swap operations; two sets of validation; harder to support future cross-entity operations (trading, gifting)

2. **Option B: Universal Model with owner_type Discriminator (Selected)** -- Single `inventories` table with `owner_type` ('player' | 'npc') and `owner_id` (userId or botId)
   - Pros: Single set of inventory operations; consistent data model; natural foundation for future entity-to-entity transfers; matches how the existing DB pattern handles entities (e.g., maps have `userId` owner)
   - Cons: Must ensure queries always filter by owner_type to prevent cross-contamination; slightly more complex initial setup

3. **Option C: Component-Based (ECS-style)** -- Inventory as a generic component attached to any entity
   - Pros: Maximum flexibility; future-proof for vehicles, chests, containers
   - Cons: Over-engineered for current scope (only players and NPCs); no ECS framework in codebase; adds abstraction without current benefit (violates YAGNI)

**Selected: Option B (Universal Model)**

A single `inventories` table with an `owner_type` discriminator is the simplest approach that avoids code duplication while remaining extensible. The existing codebase already uses owner-based patterns (maps belong to users, bots belong to maps).

### Decision 3: Item Definition Storage

#### Options Considered

1. **Option A: Database-Only** -- All item definitions stored in a DB table, loaded at runtime
   - Pros: Admin panel can CRUD items without code changes; runtime flexibility
   - Cons: Requires DB round-trip for every item lookup; definitions must be cached on server and client; cache invalidation complexity; overkill when the item catalog is small and changes rarely

2. **Option B: Static TypeScript in Shared Package (Selected)** -- Item type/subtype definitions as `as const` objects in `packages/shared`, mirroring the existing `GAME_OBJECT_TYPES` pattern; runtime state (slot contents, quantities) in DB
   - Pros: Type-safe at compile time; zero-latency lookups; shared between client and server automatically; consistent with existing `GAME_OBJECT_CATEGORIES` / `GAME_OBJECT_TYPES` pattern; no cache invalidation needed
   - Cons: Adding new item types requires a code change and deploy; not suitable for user-generated content

3. **Option C: Hybrid (Static types + DB overrides)** -- Base types in code, admin-created variants in DB
   - Pros: Core types are type-safe; admin can extend without deploys
   - Cons: Two sources of truth; merge logic is complex; premature for current scope

**Selected: Option B (Static TypeScript)**

The existing `game-object.ts` uses exactly this pattern (`GAME_OBJECT_CATEGORIES`, `GAME_OBJECT_TYPES` as `as const`). Item definitions are game-design-time data that change infrequently. Keeping them in the shared package ensures compile-time type safety and zero-latency access. Future admin-panel item creation can be layered on top without changing the core architecture.

### Decision 4: Ownership Model

#### Options Considered

1. **Option A: Inventory-Level Ownership** -- Ownership is implicit from who owns the inventory
   - Pros: Simplest; no extra fields
   - Cons: Cannot represent "NPC carries items that belong to someone else" (e.g., farmer carrying employer's harvest)

2. **Option B: Slot-Level Ownership (Selected)** -- Each `inventory_slot` row has an `owned_by_type` and `owned_by_id` field
   - Pros: Supports NPC carrying employer-owned items; enables ownership transfer without inventory transfer; tracks provenance for future economy/trading features
   - Cons: Extra fields on every slot row; queries must consider ownership; slightly more complex slot operations

3. **Option C: Separate Ownership Ledger** -- An `item_ownership` junction table tracking who owns what
   - Pros: Full audit trail; supports shared ownership
   - Cons: Additional join on every inventory query; over-engineered for current needs; no requirement for shared ownership

**Selected: Option B (Slot-Level Ownership)**

The requirement explicitly states that NPC-harvested items belong to the farm/employer, not the NPC. This requires ownership to be tracked per-slot, not per-inventory. Slot-level ownership is the minimal solution that satisfies this requirement without over-engineering.

## Consequences

### Positive Consequences

- Hotbar is instantly responsive and visible to other players via Colyseus schema auto-patching
- Single inventory codebase serves both players and NPCs, reducing maintenance burden
- Item definitions are type-safe and available at compile time on both client and server
- Ownership semantics enable future economy features (trading, theft, employer/employee relationships)
- Architecture is consistent with existing patterns in the codebase (schema for public state, messages for private state)

### Negative Consequences

- Two synchronization paths (schema + messages) increase testing surface
- Universal model requires careful query filtering by `owner_type` to prevent data leaks
- Static item definitions require code deploys for new item types (acceptable given current project stage)

### Neutral Consequences

- Hotbar slot count (10) is fixed in schema; changing it requires a schema migration
- Backpack size is configurable per entity via the `max_slots` field on the `inventories` table

## Implementation Guidance

- Use Colyseus `ArraySchema` on `ChunkPlayer` for hotbar slots, keeping field count well within the 64-field limit
- Use the existing `ClientMessage` / `ServerMessage` const-object pattern for backpack operations
- Define item types and subtypes in `packages/shared` following the `GAME_OBJECT_TYPES` pattern (`as const` with type guards)
- DB schema should use UUID primary keys and `createdAt`/`updatedAt` timestamps, consistent with all existing tables
- Inventory service functions should follow the existing fail-fast pattern in `packages/db/src/services/` (errors propagate, no silent fallbacks)
- Server-side `InventoryManager` should be decoupled from Colyseus, similar to how `BotManager` is decoupled -- ChunkRoom owns the manager and applies updates to schema

## Related Information

- [ADR-0011: Game Object Type System](./ADR-0011-game-object-type-system.md) -- Established the `as const` type definition pattern in shared package
- [ADR-0013: NPC Bot Entity Architecture](./ADR-0013-npc-bot-entity-architecture.md) -- Established BotManager decoupling pattern from Colyseus
- [Design-025: Item & Inventory System](../design/design-025-item-inventory-system.md) -- Detailed implementation design
- [Colyseus Schema Best Practices](https://docs.colyseus.io/state/best-practices) -- Schema field limits and optimization guidance
- [Colyseus Schema Definition](https://docs.colyseus.io/state/schema) -- ArraySchema, MapSchema usage patterns
- [MMO Architecture: Source of Truth and Dataflows](https://prdeving.wordpress.com/2023/09/29/mmo-architecture-source-of-truth-dataflows-i-o-bottlenecks-and-how-to-solve-them/) -- Server-authoritative inventory patterns
- [Colyseus Best Practices (0.14.x)](https://0-14-x.docs.colyseus.io/colyseus/best-practices/overview/) -- Keep schema classes thin, delegate logic to composable structures
