# ADR-006: Map Entity Model Refactor

## Status

Proposed

## Context

The `maps` table currently uses `userId` as its primary key, treating a map as a 1:1 extension of a user rather than an independent entity. This design creates several fundamental problems:

1. **No independent identity**: Maps cannot be referenced by their own ID. The chunkId convention `player:{userId}` ties map identity to user identity, making it impossible to distinguish between a player's homestead and a house interior they also own.

2. **No type discriminator**: The table has no `map_type` column. All maps are implicitly "player homesteads." City maps and open-world regions cannot be stored in this table.

3. **Single map per user**: The userId PK enforces exactly one map per user. The GDD envisions players placing buildings whose interiors are separate maps -- a second homestead-type map owned by the same player.

4. **Inconsistency with sibling tables**: Both `editor_maps` and `map_templates` already use UUID `id` as PK with a `map_type` varchar column. Only `maps` deviates.

5. **Cascading tight coupling**: The userId-as-PK assumption propagates through 21 files across the database layer, server layer, shared types, game client, and GenMap API routes.

This ADR covers four interrelated decisions required to refactor the map data model: map identity, migration strategy, chunkId convention, and mapType standardization.

---

## Decision 1: Map Identity Model

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Replace the `maps` table PK from `userId` to a UUID `id`, add `map_type` discriminator, and retain `user_id` as an optional FK. |
| **Why now** | The current schema blocks future features (house interiors, city maps, open-world chunks) and is inconsistent with sibling tables. |
| **Why this** | Aligns `maps` with the proven `editor_maps` / `map_templates` pattern already in the codebase; minimal conceptual overhead. |
| **Known unknowns** | Whether a unique constraint on `(user_id, map_type)` is sufficient to prevent duplicate homesteads during concurrent first-login races, or if advisory locks are needed. |
| **Kill criteria** | If the UUID-based routing adds measurable latency (>50ms p99) compared to the current userId-based lookup, reconsider the indexing strategy. |

### Options Considered

#### Option A: Keep userId as PK, add type column

- **Overview**: Add a `map_type` column to the existing table but keep `userId` as PK.
- **Pros**:
  - Smallest schema change.
  - No migration of existing data needed for the PK.
- **Cons**:
  - Still limited to one map per user (PK constraint).
  - Does not support city or open-world maps (no owner for those).
  - Inconsistent with `editor_maps` and `map_templates` patterns.
- **Effort**: 1 day

#### Option B: Composite PK (userId + mapType)

- **Overview**: Change PK to `(user_id, map_type)`, allowing one map per type per user.
- **Pros**:
  - Supports city maps (with a sentinel userId or null handling).
  - Simple to query "user's homestead."
- **Cons**:
  - Still limits to one map per type per user (no house interiors).
  - Composite PKs complicate join operations and foreign key references.
  - Null userId for city/open_world maps requires workarounds in composite PK.
  - Still inconsistent with sibling tables that use UUID PK.
- **Effort**: 2 days

#### Option C (Selected): UUID `id` as PK, `map_type` column, optional `user_id` FK

- **Overview**: Each map gets its own UUID identity. A `map_type` column discriminates purpose. `user_id` is a nullable FK for ownership. Aligns with `editor_maps` and `map_templates`.
- **Pros**:
  - Unlimited maps per user (house interiors, multiple homesteads).
  - City and open-world maps have no owner (nullable `user_id`).
  - Consistent with sibling tables -- developers learn one pattern.
  - Clean foreign key relationships (single-column UUID PK).
  - ChunkId routing uses `map:{mapId}` which is type-agnostic.
- **Cons**:
  - Larger migration (PK change + data migration + 21-file refactor).
  - Requires an additional index on `user_id` for "list maps by owner" queries.
  - Lookup by userId now requires a query with WHERE clause instead of PK scan.
- **Effort**: 5 days (full refactor)

### Rationale

Option C is selected because it is the only approach that supports the core GDD requirement of multiple maps per user while maintaining schema consistency across all map-related tables. The migration cost is acceptable because:
- The project has no production users (development-only data).
- The sibling tables (`editor_maps`, `map_templates`) already prove the pattern works.
- The 21-file refactor is a one-time cost that prevents ongoing inconsistency tax.

---

## Decision 2: Migration Strategy

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Use a hard cutover migration: rename old table, create new table, migrate data in a single transaction. |
| **Why now** | The schema change is blocking further feature development. |
| **Why this** | Early-stage project with no production users makes dual-write complexity unnecessary. |
| **Known unknowns** | Whether conditional guards (e.g., checking if old table exists) are sufficient or if full idempotency is needed. |
| **Kill criteria** | If the project reaches production users before migration is applied, switch to gradual dual-write approach. |

### Options Considered

#### Option A: Gradual dual-write approach

- **Overview**: Write to both old and new tables simultaneously. Read from new table with fallback to old. Cut over reads after verification period.
- **Pros**:
  - Zero risk of data loss during transition.
  - Can be rolled back instantly by switching reads back to old table.
  - Standard approach for production systems with live traffic.
- **Cons**:
  - Significant implementation complexity (dual writes, fallback reads, consistency checks).
  - Requires maintaining both schemas simultaneously.
  - Unnecessary for early-stage project with no production users.
  - Doubles write latency during transition period.
- **Effort**: 3-4 days (migration infrastructure alone)

#### Option B (Selected): Hard cutover migration (single transaction)

- **Overview**: In a single SQL transaction: rename old `maps` table to `maps_old`, create new `maps` table with UUID PK schema, migrate rows (generating UUIDs, setting type='homestead'), drop `maps_old`. Also migrate `player_positions.chunkId` values from `player:{userId}` to `map:{mapId}`.
- **Pros**:
  - Atomic: either the entire migration succeeds or rolls back.
  - Simple to implement and reason about.
  - No dual-write complexity or temporary inconsistency.
  - Appropriate for development-stage project.
- **Cons**:
  - No gradual rollback -- must restore from backup if issues found post-migration.
  - Not suitable for production systems with live traffic.
  - Brief downtime during migration (acceptable in development).
- **Effort**: 1 day

#### Option C: Blue-green schema migration

- **Overview**: Create new table alongside old one. Migrate data in background. Switch application code to new table via feature flag.
- **Pros**:
  - Can verify data integrity before switching.
  - Feature flag allows instant rollback.
- **Cons**:
  - Requires feature flag infrastructure.
  - Application code must support both schemas during transition.
  - Overkill for development stage.
- **Effort**: 2-3 days

### Rationale

Option B is selected because the project is in early development with no production users or live traffic. The hard cutover approach is simpler, faster to implement, and avoids the complexity of dual-write or feature flag infrastructure that provides no benefit at this stage. The migration is wrapped in a transaction for atomicity.

---

## Decision 3: ChunkId Convention

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Replace `player:{userId}` with unified `map:{mapId}` for all single-chunk maps; retain `world:{x}:{y}` for open-world chunks; retain `city:capital` as a well-known alias resolved at runtime. |
| **Why now** | The current `player:{userId}` convention encodes user identity in the room routing key, which cannot address multiple maps per user or non-user-owned maps. |
| **Why this** | A type-agnostic `map:{mapId}` convention is the simplest approach that supports all map types without encoding type information in the chunkId. |
| **Known unknowns** | Whether additional well-known aliases beyond `city:capital` will be needed (e.g., `city:marketplace`). |
| **Kill criteria** | If the alias resolution query for `city:capital` becomes a latency bottleneck, cache the resolved mapId at server startup. |

### Options Considered

#### Option A: Type-prefixed chunkIds (`homestead:{mapId}`, `city:{mapId}`, `world:{x}:{y}`)

- **Overview**: Each map type has its own chunkId prefix, encoding the map type in the routing key.
- **Pros**:
  - ChunkId is self-describing -- you can determine map type from the prefix.
  - Could route to different room types per prefix if architecture splits later.
- **Cons**:
  - More prefix patterns to parse (three instead of two).
  - Encodes map type in routing layer, which is redundant with the `map_type` column.
  - If new map types are added, new prefixes and parsing logic are needed.
  - ChunkRoom already handles all map types -- type-specific prefixes add no value.
- **Effort**: 2 days

#### Option B (Selected): Unified `map:{mapId}` for all single-chunk maps

- **Overview**: All single-chunk maps (homesteads, cities) use `map:{mapId}`. Open-world chunks use `world:{x}:{y}`. `city:capital` is a well-known alias resolved to `map:{mapId}` at runtime. Two conventions, not three-plus.
- **Pros**:
  - Simplest parsing: only two prefixes (`map:` and `world:`), plus one alias (`city:capital`).
  - Type-agnostic routing -- ChunkRoom loads any map by UUID regardless of type.
  - Adding new map types requires no chunkId convention changes.
  - `city:capital` alias avoids embedding runtime UUIDs in compile-time constants.
- **Cons**:
  - Cannot determine map type from chunkId alone (must query DB).
  - The `city:capital` alias requires a DB lookup to resolve.
- **Effort**: 1.5 days

#### Option C: Pure UUID chunkIds (no prefix)

- **Overview**: ChunkIds are bare UUIDs for map rooms and `{x}:{y}` for world chunks.
- **Pros**:
  - Minimal string formatting.
- **Cons**:
  - Ambiguous: cannot distinguish a UUID map chunkId from other string formats.
  - No way to tell if a chunkId refers to a map room or a world chunk without a DB lookup.
  - Breaks the existing `startsWith('world:')` positional chunk detection in World.ts.
  - `city:capital` alias would need special casing outside the convention.
- **Effort**: 2 days (more defensive parsing needed)

### Rationale

Option B is selected because homesteads and cities are each a single chunk (one map = one room), making type-specific prefixes unnecessary. The unified `map:{mapId}` convention gives ChunkRoom a single parsing rule for all single-chunk maps. The `city:capital` alias preserves the existing `DEFAULT_SPAWN` constant and `player_positions` schema default without embedding runtime UUIDs in compiled code.

---

## Decision 4: MapType Value Standardization

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Rename `player_homestead` to `homestead` across all tables (`maps`, `editor_maps`, `map_templates`) and standardize on the canonical set: `homestead`, `city`, `open_world`. |
| **Why now** | The new `maps` table will use standardized values; sibling tables must match to avoid query mismatches (ChunkRoom queries templates by map_type). |
| **Why this** | Shorter, cleaner values without redundant `player_` prefix; aligns with the map type concept in the GDD. |
| **Known unknowns** | Whether any external tools or scripts reference the `player_homestead` value directly. |
| **Kill criteria** | If renaming causes data integrity issues in production-adjacent environments, add a temporary alias mapping. |

### Options Considered

#### Option A: Keep `player_homestead`, add `city` and `open_world`

- **Overview**: Retain the existing value in sibling tables; use `player_homestead` in the new `maps` table too.
- **Pros**:
  - No migration needed for `editor_maps` or `map_templates` data.
  - Zero risk of breaking existing queries.
- **Cons**:
  - The `player_` prefix is misleading for city/open_world context and inconsistent as a general-purpose discriminator.
  - Longer string for the most common map type.
  - New developers may not understand why the prefix exists.
- **Effort**: 0.5 days

#### Option B (Selected): Rename to `homestead` across all tables

- **Overview**: Data migration updates `player_homestead` to `homestead` in `editor_maps.map_type` and `map_templates.map_type`. New `maps` table uses `homestead` from the start.
- **Pros**:
  - Clean, consistent vocabulary across all map tables.
  - Aligns with GDD terminology (homestead, city, open_world).
  - Removes misleading `player_` prefix.
- **Cons**:
  - Requires data migration for `editor_maps` and `map_templates` rows.
  - Any hardcoded references to `player_homestead` in application code must be updated.
- **Effort**: 0.5 days (simple UPDATE statement in migration)

#### Option C: Introduce an enum type in PostgreSQL

- **Overview**: Create a PostgreSQL ENUM type for map_type values and use it across all tables.
- **Pros**:
  - Database-level enforcement of valid values.
  - Self-documenting schema.
- **Cons**:
  - PostgreSQL ENUMs are notoriously difficult to modify (adding values requires ALTER TYPE, removing values is not directly supported).
  - Drizzle ORM has mixed support for PG ENUMs.
  - Sibling tables use varchar, requiring schema changes beyond just data migration.
  - Over-engineering for the current stage.
- **Effort**: 1.5 days

### Rationale

Option B is selected for its simplicity and consistency. The data migration is a straightforward UPDATE statement. The `player_homestead` value only appears in `editor_maps` and `map_templates` data rows, and in the ChunkRoom code that queries templates by type. A varchar column with application-level validation is sufficient and consistent with the existing pattern.

---

## Comparison Summary

### Decision 1: Map Identity Model

| Evaluation Axis | Option A (Keep userId PK) | Option B (Composite PK) | Option C (UUID PK) |
|---|---|---|---|
| Multi-map per user | Not supported | 1 per type | Unlimited |
| City/world maps | Not supported | Awkward (null in PK) | Clean (nullable FK) |
| Schema consistency | Divergent | Divergent | Aligned |
| Migration effort | None | Medium | High |
| Future extensibility | Poor | Limited | Excellent |

### Decision 2: Migration Strategy

| Evaluation Axis | Option A (Dual-write) | Option B (Hard cutover) | Option C (Blue-green) |
|---|---|---|---|
| Implementation complexity | High | Low | Medium |
| Rollback safety | Instant | Backup restore | Feature flag |
| Appropriate for dev stage | No (overkill) | Yes | No (overkill) |
| Data consistency risk | Low | Low (transactional) | Low |

### Decision 3: ChunkId Convention

| Evaluation Axis | Option A (Type-prefixed) | Option B (Unified map:) | Option C (Pure UUID) |
|---|---|---|---|
| Parsing complexity | 3+ prefixes | 2 prefixes + 1 alias | Ambiguous |
| Type extensibility | New prefix per type | No change needed | No change needed |
| Self-describing | Yes | Partially (alias) | No |
| Implementation effort | Medium | Low | Medium |

### Decision 4: MapType Standardization

| Evaluation Axis | Option A (Keep player_homestead) | Option B (Rename to homestead) | Option C (PG ENUM) |
|---|---|---|---|
| Consistency | Inconsistent naming | Clean vocabulary | Clean + enforced |
| Migration effort | None | Trivial | Moderate |
| Future flexibility | Fine | Fine | Difficult to modify |

---

## Consequences

### Positive Consequences

- Maps become first-class entities with independent identity, enabling house interiors, city maps, and open-world chunks.
- Schema consistency across all map-related tables (`maps`, `editor_maps`, `map_templates`) reduces cognitive overhead.
- The unified `map:{mapId}` chunkId convention simplifies ChunkRoom routing -- one parsing rule for all single-chunk maps.
- Clean separation of identity (mapId) from ownership (userId FK) supports future features like NPC-owned or shared maps.
- MapType standardization eliminates vocabulary inconsistency.

### Negative Consequences

- 21-file refactor is a substantial one-time cost.
- Lookup by userId now requires an indexed query instead of a PK scan (marginal performance difference with proper indexing).
- The `city:capital` alias adds one DB query per alias resolution (cacheable).
- All existing tests must be updated to use mapId-based fixtures.

### Neutral Consequences

- ChunkRoom remains the single room type for all map types -- no architectural change to the room system.
- The `player_positions` table retains `city:capital` as the default chunkId value.
- `DEFAULT_SPAWN` constant is unchanged.

---

## Implementation Guidance

- **Follow the `editor_maps` schema pattern**: The new `maps` table should mirror the column structure of `editor_maps` (UUID PK, name, map_type, width, height, seed, grid, layers, walkable, metadata, created_at, updated_at) plus the additional `user_id` FK.
- **Use `gen_random_uuid()` for UUID generation**: PostgreSQL's built-in function, consistent with Drizzle's `defaultRandom()`.
- **Index the `user_id` column**: Required for efficient "list maps by owner" queries.
- **Wrap migration in a transaction**: The schema change and data migration must be atomic.
- **Resolve `city:capital` alias via a single DB query**: Look up the map where `map_type = 'city'` and `name = 'capital'` (or equivalent convention). Cache if latency becomes an issue.
- **Use fail-fast error propagation**: Service functions should propagate errors to callers, not silently return defaults.
- **Standardize map_type values in the same migration**: The `player_homestead` to `homestead` rename should be part of the migration transaction.

---

## Related Information

- **PRD-009**: [Map Entity Model Refactor](../prd/prd-009-map-entity-model.md) -- Full requirements document
- **PRD-005**: [Chunk-Based Room Architecture](../prd/prd-005-chunk-based-room-architecture.md) -- Establishes the chunkId room-routing system this ADR modifies
- **PRD-007**: [Map Editor](../prd/prd-007-map-editor.md) -- Defines the editor_maps and map_templates schemas that serve as the reference pattern
- **ADR-0006**: [Chunk-Based Room Architecture](./ADR-0006-chunk-based-room-architecture.md) -- Original room architecture decision
- **Current schema**: `packages/db/src/schema/maps.ts` -- userId-as-PK pattern being replaced
- **Reference schema**: `packages/db/src/schema/editor-maps.ts` -- UUID-as-PK pattern to adopt
