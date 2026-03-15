# ADR-0017: Interactive Map Architecture

## Status

Proposed

## Date

2026-03-15

## Context

Nookstead maps currently store terrain, elevation, walkability, and visual layers (tile, object, fence), but have no system for defining what _happens_ when a player interacts with a tile. The existing `CellAction` type on `Cell` is exported but entirely unused -- it supports only a single trigger per tile with no activation-type distinction (touch vs click vs proximity).

To build the farming, warp, shop, and world-interaction gameplay described in the GDD, the engine needs:

1. **Editor-authored tile triggers** -- warps, interact points, damage zones, sound effects -- with multiple triggers per tile and distinct activation modes.
2. **Material-level tile properties** -- which tiles are diggable, fishable, water sources, buildable -- stored in the materials DB rather than per-cell metadata.
3. **Zone-level behavior configuration** -- spawn rules, NPC schedule bindings, operating hours, farmland designation -- extending the existing `ZoneData.properties` bag.
4. **Server-authoritative farm state** -- per-tile soil, crop, watering, debris state that the client renders but never modifies directly.

These four concerns span the editor (map-lib), the database schema (packages/db), the game server (apps/server Colyseus rooms), and the client renderer (apps/game Phaser scenes). Five architectural decisions are needed.

## Decision

### Decision 1: Add InteractionLayer to EditorLayerUnion

| Item | Content |
|------|---------|
| **Decision** | Introduce a new `InteractionLayer` type with `type: 'interaction'` to the `EditorLayerUnion` discriminated union, storing a sparse `Map<string, CellTrigger[]>` keyed by `"x,y"`. The `CellTrigger` union defines 5 trigger subtypes: `WarpTrigger`, `InteractTrigger`, `EventTrigger`, `SoundTrigger`, `DamageTrigger` |
| **Why now** | Warps, shop interactions, and damage zones are blocked until tiles can carry trigger data; this is the next major editor capability needed after fences |
| **Why this** | Sparse Map storage avoids allocating memory for the vast majority of empty tiles. The discriminated union pattern is already proven by TileLayer, ObjectLayer, and FenceLayer. Multiple triggers per tile enables overlapping behaviors (e.g., a warp tile that also plays a sound). |
| **Known unknowns** | Whether a single InteractionLayer per map is sufficient or if multiple interaction layers will be needed for organization (e.g., one for warps, one for NPCs) |
| **Kill criteria** | If the trigger system needs to be shared across maps (e.g., global warp registry), a layer-local approach would need redesign in favor of a centralized service |

### Decision 2: Extend Materials Table with Tile Properties

| Item | Content |
|------|---------|
| **Decision** | Add `diggable`, `fishable`, `water_source`, `buildable` boolean columns and a `surface_type` varchar column to the `materials` DB table, all with safe defaults |
| **Why now** | Farming tools need to know which terrain is tillable without per-cell configuration; this is a property of the material itself (dirt is diggable, water is fishable) |
| **Why this** | Material-level properties are set once per material type, not per tile, making them efficient and easy to configure. This follows Stardew Valley's approach where tile properties like "Diggable" are set on the terrain tileset, not per-tile. |
| **Known unknowns** | Whether `surfaceType` needs to be an enum or free-text; free-text chosen for extensibility |
| **Kill criteria** | If materials need per-biome or per-season property overrides (e.g., ground only diggable in spring), a static column approach would be insufficient |

### Decision 3: Extend ZoneData with Runtime Behavior Configuration

| Item | Content |
|------|---------|
| **Decision** | Add new zone types (`warp_zone`, `no_dig`, `no_build`, `no_fish`, `no_spawn`, `farmland`) and define structured property schemas for spawn rules, NPC schedules, warp configs, and operating hours within `ZoneData.properties` |
| **Why now** | Town maps need NPC schedule locations, farmland areas need to be designatable, and warp zones are needed for map transitions |
| **Why this** | `ZoneData.properties` is already `Record<string, unknown>`, so adding structured data is non-breaking. Zone types are an extensible string union. This avoids a separate overlay system. |
| **Known unknowns** | Whether zone-level warp definitions should coexist with or replace tile-level warp triggers |
| **Kill criteria** | If zone properties grow beyond 10-15 fields per type, they should be broken into dedicated zone sub-schemas |

### Decision 4: Deprecate Cell.action in Favor of InteractionLayer

| Item | Content |
|------|---------|
| **Decision** | Mark `Cell.action` as `@deprecated` and migrate all interaction behavior to InteractionLayer triggers. Existing maps with `Cell.action` data (if any) will be migrated via a one-time loader transformation. |
| **Why now** | `CellAction` is unused in any implementation but its existence creates confusion about where interaction data should live |
| **Why this** | InteractionLayer supports multiple triggers per tile, distinct activation modes, and editor tooling -- all things CellAction cannot provide. Deprecation (not removal) preserves backward compatibility. |
| **Known unknowns** | Whether any third-party tools or exported maps contain CellAction data |
| **Kill criteria** | If CellAction is found in production map data, migration must be validated before deprecation |

### Decision 5: Server-Authoritative FarmTileState via Colyseus

| Item | Content |
|------|---------|
| **Decision** | Farm state (soil, crops, watering, debris) is managed exclusively on the server in a `FarmTileState` schema synced to clients via Colyseus state patches. The client renders farm state but never modifies it directly. |
| **Why now** | Farming is a core gameplay loop that requires cheat-resistant state management from the start |
| **Why this** | Server authority prevents item/crop duplication exploits in an MMO context. Colyseus schema delta encoding provides efficient sync. Growth-points-based crop progression (not pure timers) allows pausing growth when not watered, matching Palia's approach. |
| **Known unknowns** | Optimal Colyseus schema granularity for farm state -- flat MapSchema of serialized tiles vs nested schema hierarchy |
| **Kill criteria** | If farm state update frequency exceeds Colyseus patch budget (>100 tiles changing per tick), a custom binary protocol may be needed |

## Rationale

### Options Considered

#### Decision 1: Tile Interaction Data Storage

1. **Option A: Extend Cell.action with richer types**
   - Pros: No new layer type needed, uses existing field
   - Cons: Cell.action is per-cell (dense), supports only one trigger per tile, no activation mode distinction, modifying Cell breaks all existing map data

2. **Option B: Property-bag on tiles (Tiled-style)**
   - Pros: Familiar to Tiled editor users, flexible key-value storage
   - Cons: Untyped, no validation, difficult to build editor UI for, serialization bloat on every tile

3. **Option C: InteractionLayer with sparse trigger map (Selected)**
   - Pros: Sparse storage (memory efficient), multiple triggers per tile, typed discriminated union for trigger types, follows established layer pattern (TileLayer/ObjectLayer/FenceLayer), editor tooling can show/hide the layer
   - Cons: New layer type to maintain, serialization format needed

Option C was selected because it extends the proven layer architecture, provides type safety through discriminated unions, and avoids allocating data for the majority of tiles that have no interactions.

#### Decision 2: Tile Property Storage Location

1. **Option A: Per-cell metadata in Cell.meta**
   - Pros: Maximum flexibility per tile, already exists
   - Cons: Massive data duplication (every dirt tile repeats `diggable: true`), editor must set properties per-tile, error-prone

2. **Option B: Material-level columns in DB (Selected)**
   - Pros: Set once per material type, efficient storage, queryable, easy to configure via admin UI, matches Stardew Valley's tileset-property approach
   - Cons: Cannot vary by position (mitigated by zone overrides like `no_dig`)

3. **Option C: Separate tile-properties table**
   - Pros: Normalized, extensible
   - Cons: Over-engineered for boolean flags, requires join on every tile lookup, no benefit over columns for 5 fields

Option B was selected because tile properties like "diggable" are inherent to the material type, not the specific tile position. Zone-based overrides handle the edge cases.

#### Decision 3: Runtime Behavior Configuration Location

1. **Option A: New dedicated tables per behavior type**
   - Pros: Strongly typed per behavior, normalized
   - Cons: Schema proliferation, complex joins, breaks simple zone-based map reasoning

2. **Option B: Extend ZoneData.properties with structured schemas (Selected)**
   - Pros: Non-breaking (properties is already Record<string, unknown>), zones are already spatial regions, editor already has zone tools, keeps behavior co-located with spatial bounds
   - Cons: Weak typing (mitigated by runtime validation and TypeScript type guards)

3. **Option C: InteractionLayer triggers for all behaviors**
   - Pros: Single system for everything
   - Cons: Not all behaviors are tile-level (NPC schedules apply to regions), forces tile-grid thinking onto area-level concerns

Option B was selected because runtime behaviors like NPC schedules, operating hours, and spawn rules are inherently zone-level (spatial region) concerns, not tile-level.

#### Decision 4: CellAction Deprecation Strategy

1. **Option A: Remove Cell.action immediately**
   - Pros: Clean break, no legacy type confusion
   - Cons: Breaking change for any code referencing Cell.action, even if unused; requires major version bump

2. **Option B: Deprecate with @deprecated annotation (Selected)**
   - Pros: Non-breaking, clear signal to developers, gradual migration, existing maps unaffected
   - Cons: Dead code remains in codebase temporarily, potential confusion during transition

3. **Option C: Keep Cell.action and InteractionLayer in parallel**
   - Pros: No migration needed, both systems available
   - Cons: Two overlapping interaction systems create ambiguity about where to define interactions, maintenance burden of two systems

Option B was selected because it communicates intent without breaking backward compatibility. CellAction is unused in practice, so deprecation is sufficient; removal can happen in a future major version.

#### Decision 5: Farm State Management

1. **Option A: Client-side state with periodic server sync**
   - Pros: Low latency, simple implementation
   - Cons: Trivially exploitable in an MMO (clients can fake crop growth, duplicate items)

2. **Option B: Server-authoritative with Colyseus schema sync (Selected)**
   - Pros: Cheat-resistant, single source of truth, Colyseus delta encoding is bandwidth-efficient, natural fit with existing ChunkRoom pattern
   - Cons: All farm actions require server round-trip (acceptable latency for farming actions)

3. **Option C: Hybrid with client prediction and server validation**
   - Pros: Low-latency feel, server authority
   - Cons: Complex reconciliation logic, crop growth prediction is non-trivial (depends on watering history), over-engineered for farming actions that are not latency-sensitive

Option B was selected because farming actions (tilling, watering, planting) are not latency-sensitive and the MMO context requires cheat resistance from day one.

## Consequences

### Positive Consequences

- Maps can define rich, multi-trigger interactions per tile with distinct activation modes
- Farming gameplay has cheat-resistant server authority from the start
- Material properties are configured once per type, not per tile instance
- Zone system gains NPC schedule and spawn rule capabilities needed for town maps
- All changes are backward compatible -- existing maps load without modification

### Negative Consequences

- InteractionLayer adds complexity to the editor UI (new tools, sidebar tab, configuration panels)
- Farm state round-trips add latency to farming actions (acceptable: ~50-100ms for non-combat actions)
- Materials table migration must be run on production database
- Five new zone types expand the ZoneType union, increasing cognitive load for zone selection

### Neutral Consequences

- `Cell.action` is deprecated but not removed, preserving backward compatibility
- The editor layer discriminated union grows from 3 to 4 members
- Serialization format for InteractionLayer must follow the established sparse pattern (similar to fence gates)

## Implementation Guidance

- **Zero-conversion data sharing**: The editor (genmap) and game client (apps/game) MUST use identical data types from `@nookstead/shared`. No conversion layer between editor format and game format. `SerializedInteractionLayer` is stored in DB, sent over WebSocket, and consumed by the game client as-is. This follows the existing pattern established by `SerializedFenceLayer`.

- **Follow the FenceLayer pattern**: InteractionLayer should mirror the FenceLayer implementation approach -- a new discriminated union member, new editor actions, new sidebar tab, and a serialization type in `@nookstead/shared`
- **Use discriminated unions for trigger types**: CellTrigger should be a discriminated union on the `type` field, enabling exhaustive pattern matching and type-safe configuration
- **Sparse over dense**: InteractionLayer stores triggers in a `Map<string, CellTrigger[]>` keyed by `"x,y"` strings, not a 2D array. Serialization should also be sparse (array of positioned entries).
- **Material properties are immutable at runtime**: The `diggable`, `fishable`, etc. columns are set by editors and read by the server. Runtime overrides use zone-based exclusions (`no_dig` zone).
- **Server-only farm state**: `FarmTileState` must never be sent as part of `MapDataPayload`. It lives in Colyseus room state and is synced via schema patches only to connected clients.
- **Growth points, not timers**: Crop progression uses accumulated growth points (`+1/game-hour if watered`) rather than wall-clock timers. This naturally handles the "growth pauses without watering" requirement.
- **Deprecation, not deletion**: `Cell.action` should be marked `@deprecated` with a JSDoc comment pointing to InteractionLayer. Removal can happen in a future major version.

## Related Information

- [ADR-0010: Fence System Architecture](ADR-0010-fence-system-architecture.md) -- establishes the layer union pattern this ADR extends
- [ADR-0012: Multi-Layer Painting Pipeline](ADR-0012-multi-layer-painting-pipeline.md) -- layer-aware editing pipeline
- [Design-012: Fence System](../design/design-012-fence-system.md) -- reference implementation for new layer types
- [Design-024: Interactive Map System](../design/design-024-interactive-map-system.md) -- implementation details for this ADR
- [Stardew Valley Modding: Maps](https://stardewvalleywiki.com/Modding:Maps) -- reference for tile property and TouchAction/Action patterns
- [Colyseus Schema Documentation](https://docs.colyseus.io/state/schema) -- state synchronization framework
- [MDN: Tiles and Tilemaps Overview](https://developer.mozilla.org/en-US/docs/Games/Techniques/Tilemaps) -- general tilemap architecture reference
- [Sparse 2D Arrays for Game Worlds](https://gamedev.net/forums/topic/503607-sparse-2d-array-for-excessively-huge-worlds/) -- sparse storage pattern discussion
