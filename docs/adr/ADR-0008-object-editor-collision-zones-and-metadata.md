# ADR-0008: Object Editor Collision Zones and Metadata

## Status

Proposed

## Context

The genmap object editor (`apps/genmap/`) needs enhanced capabilities for authoring game-ready object data. Three architectural concerns require explicit decisions:

1. **Collision zone data structure**: Game objects need collision/walkability zones that are authored in the web editor (Next.js HTML5 Canvas) and consumed at runtime by the Phaser 3 game client (Arcade Physics). The current `game_objects` table has a generic `metadata` JSONB column but no structured collision data. Separately, the `atlas_frames` table already has a `customData` JSONB column with reserved keys `passable` and `collisionRect` for frame-level (individual tile) collision data. Object-level collision zones serve a different purpose: they define collision boundaries for composed multi-layer objects (e.g., a tree with a narrow trunk collision and a wider canopy walkable area).

2. **Object classification**: Game objects need `category` and `objectType` fields to support filtering, grouping, and autocomplete in the editor UI. No classification fields exist on the current `game_objects` table, and the codebase uses no `pgEnum` types anywhere.

3. **Grid settings persistence**: The object editor supports grid-snapped and free-form placement. A decision is needed on whether grid mode and cell size are stored in the database per object or kept as editor session state.

### Phaser 3 Arcade Physics Constraints

Phaser 3 Arcade Physics uses Axis-Aligned Bounding Boxes (AABB) for collision detection. Key constraints that influence the data structure decision:

- **Rectangle-only**: Arcade Physics supports only rectangular collision bodies (`body.setSize(width, height)` + `body.setOffset(x, y)`)
- **Single body per sprite**: Each Arcade Physics sprite has exactly one body. To create multiple collision zones for a single game object, invisible static physics bodies must be created in a `StaticGroup`
- **Static bodies for immovable objects**: Game objects like trees, buildings, and furniture use `body.immovable = true` or `StaticBody` for optimal performance (skips velocity calculations)
- **No compound bodies**: Unlike Matter.js, Arcade Physics has no native compound body support. Multiple collision rectangles require multiple game objects grouped together

### Existing Schema Patterns

The codebase consistently uses JSONB for semi-structured data:
- `maps.grid`, `maps.layers`, `maps.walkable` -- map generation data as JSONB
- `game_objects.layers`, `game_objects.tags`, `game_objects.metadata` -- object composition as JSONB
- `atlas_frames.customData` -- frame-level metadata including `passable` and `collisionRect`

No `pgEnum` types exist anywhere in the schema. All tables use UUID primary keys with `defaultRandom()` and timezone-aware timestamps with `defaultNow()`.

---

## Decision 1: Collision Zone Storage as Dedicated JSONB Column

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Add a dedicated `collisionZones` JSONB column to the `game_objects` table storing an array of typed rectangle zones, separate from the existing `metadata` column |
| **Why now** | The object editor is being enhanced with a visual collision zone drawing tool. The data structure must be defined before the editor canvas and Phaser 3 runtime consumption can be implemented. |
| **Why this** | A dedicated column provides clear semantic separation from generic metadata, enables targeted JSONB queries and indexing if needed, and the typed rectangle structure maps directly to Phaser 3 Arcade Physics `setSize`/`setOffset` API without transformation. |
| **Known unknowns** | Whether game objects will need more than ~20 collision zones (current UI targets 1-5 per object). At expected scale, JSONB performance is not a concern. |
| **Kill criteria** | If collision zone queries become a bottleneck (e.g., needing to find "all objects with walkable zones" across thousands of objects), consider a GIN index on the `collisionZones` column or normalize zones into a separate table. |

### Options Considered

1. **Dedicated `collisionZones` JSONB column with typed rectangle array (Selected)**
   - Overview: Add a new nullable JSONB column `collision_zones` to `game_objects` storing an array of `CollisionZone` objects. Each zone has an `id` (UUID), `label`, `type` (collision/walkable), and rectangle geometry (`x`, `y`, `width`, `height` in pixels relative to object origin).
   - Pros:
     - Clear semantic separation from generic `metadata` -- collision data is a first-class concern, not buried in an untyped bag
     - Direct mapping to Phaser 3 Arcade Physics API: each zone becomes one `StaticBody` with `setSize(zone.width, zone.height)` and `setOffset(zone.x, zone.y)`
     - Queryable: `SELECT * FROM game_objects WHERE collision_zones IS NOT NULL` finds all objects with collision data
     - Consistent with existing JSONB pattern (`layers`, `tags`, `metadata` columns)
     - Application-level TypeScript interface provides compile-time validation
     - Small array size (1-5 zones per object) -- well within JSONB performance characteristics
   - Cons:
     - Adds a new column requiring a database migration
     - No database-level validation of JSONB structure (same trade-off as `layers`, `tags`, `metadata`)
     - `collisionZones` and `customData.collisionRect` on `atlas_frames` serve different purposes but use similar names -- potential for confusion without clear documentation
   - Effort: 1 day

2. **Store collision zones inside existing `metadata` JSONB column**
   - Overview: Use the existing `metadata` column on `game_objects` with a `collisionZones` key. No schema change needed.
   - Pros:
     - Zero migration effort -- `metadata` column already exists
     - Flexible -- any additional metadata can coexist
     - No schema change, no risk of migration conflicts
   - Cons:
     - Collision data is a core game mechanic, not optional metadata -- storing it in a generic bag obscures its importance
     - Cannot query or index `collisionZones` independently without JSONB path operators (e.g., `metadata->'collisionZones'`)
     - Risk of accidental overwrite when updating other metadata fields
     - Violates single-responsibility: `metadata` becomes a catch-all for unrelated concerns
     - Existing service functions (`createGameObject`, `updateGameObject`) pass `metadata` as `unknown` -- collision zone type safety would require casting at every access point
   - Effort: 0.5 day

3. **Separate `collision_zones` relational table**
   - Overview: Create a new `collision_zones` table with one row per zone, linked to `game_objects` via foreign key. Columns: `id`, `game_object_id`, `label`, `type`, `x`, `y`, `width`, `height`.
   - Pros:
     - Full relational integrity with foreign key cascade on game object deletion
     - Standard SQL queries for individual zones (e.g., "find all collision zones of type 'walkable'")
     - Database-level NOT NULL constraints on geometry fields
     - Easy to add zone-level metadata (e.g., `damage`, `trigger_event`) as new columns
   - Cons:
     - Fetching a game object with its collision zones requires a JOIN (or a second query)
     - Creating/updating an object with zones requires batch INSERT/DELETE operations
     - A game object with 5 zones creates 5 rows instead of 1 JSONB array
     - Introduces a new join pattern not used elsewhere in the asset pipeline (all existing structured data uses JSONB: `layers`, `tags`, `selected_tiles`, `tiles`)
     - More complex transaction management for atomic object + zones updates
     - Overkill for 1-5 small rectangles per object
   - Effort: 2 days

### Comparison

| Criterion | Dedicated JSONB Column | Existing `metadata` Column | Relational Table |
|-----------|----------------------|---------------------------|------------------|
| Semantic clarity | High (first-class column) | Low (buried in generic bag) | High (own table) |
| Read performance | Excellent (single row) | Excellent (single row, path extract) | Requires JOIN |
| Write performance | Excellent (single column update) | Risk of partial overwrite | Batch INSERT/DELETE |
| Query independence | Good (column-level IS NOT NULL) | Requires JSONB path operators | Excellent (standard SQL) |
| Migration effort | 1 migration (add column) | None | 1 migration (new table + FK) |
| Pattern consistency | Matches existing JSONB pattern | Matches existing column | New pattern for asset pipeline |
| Phaser 3 mapping | Direct (array to StaticGroup) | Direct (extract then map) | Requires aggregation |
| Type safety | Application-level interface | Requires casting from unknown | Column-level types |
| Expected data volume | 1-5 zones per object | 1-5 zones per object | 1-5 rows per object |

### Decision

**Dedicated `collisionZones` JSONB column selected.** Collision zones are a core game mechanic -- they determine how players interact with objects at runtime. Storing them in a dedicated column rather than the generic `metadata` bag makes their importance explicit, enables simple queries (`WHERE collision_zones IS NOT NULL`), and maintains the JSONB pattern established throughout the asset pipeline. The relational table (Option 3) offers stronger integrity guarantees but introduces unnecessary complexity for 1-5 small rectangles per object.

**Data Structure:**

```typescript
interface CollisionZone {
  id: string;           // UUID, unique within the object's zone array
  label: string;        // Human-readable label (e.g., "trunk", "doorway", "canopy")
  type: 'collision' | 'walkable';  // collision = blocked, walkable = passable override
  shape: 'rectangle';   // Arcade Physics only supports AABB rectangles
  x: number;            // X offset from object origin in pixels
  y: number;            // Y offset from object origin in pixels
  width: number;        // Zone width in pixels
  height: number;       // Zone height in pixels
}
```

**Phaser 3 Runtime Consumption:**

```typescript
// For a game object with multiple collision zones:
// Create invisible static bodies in a StaticGroup
const collisionGroup = this.physics.add.staticGroup();

for (const zone of gameObject.collisionZones) {
  if (zone.type === 'collision') {
    const body = collisionGroup.create(
      objectX + zone.x + zone.width / 2,
      objectY + zone.y + zone.height / 2,
      undefined  // no texture -- invisible
    );
    body.body.setSize(zone.width, zone.height);
    body.setVisible(false);
  }
}

// Register collision with player
this.physics.add.collider(player, collisionGroup);
```

**Relationship to Frame-Level Collision Data:**

| Level | Column | Purpose | Authored In | Consumed By |
|-------|--------|---------|-------------|-------------|
| Frame (tile) | `atlas_frames.customData.collisionRect` | Per-tile collision for tilemap layers | Sprite detail page | Phaser tilemap collision |
| Frame (tile) | `atlas_frames.customData.passable` | Per-tile walkability flag | Sprite detail page | Phaser tilemap collision |
| Object (composed) | `game_objects.collision_zones` | Multi-zone collision for assembled objects | Object editor canvas | Phaser object placement |

---

## Decision 2: Category and Object Type as Free-Text Varchar Columns

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Add `category` (varchar, nullable) and `object_type` (varchar, nullable) columns to `game_objects` with UI autocomplete populated by `SELECT DISTINCT` from existing values |
| **Why now** | The object editor needs classification fields for filtering and organizing game objects. As the object library grows, unclassified objects become unmanageable. |
| **Why this** | Free-text with autocomplete provides maximum flexibility for an evolving game design, avoids migration overhead when adding new categories, and leverages a simple query pattern (`SELECT DISTINCT category FROM game_objects WHERE category IS NOT NULL`) for autocomplete suggestions. |
| **Known unknowns** | Whether the eventual game client will need strict category validation (e.g., only objects of category "furniture" can be placed indoors). If so, application-level validation can be added without schema changes. |
| **Kill criteria** | If category/type values proliferate beyond useful (>50 distinct values with many near-duplicates), introduce a reference table or application-level allowlist. |

### Options Considered

1. **Free-text varchar columns with autocomplete (Selected)**
   - Overview: Add `category` and `object_type` as nullable `varchar(100)` columns. The editor UI populates autocomplete suggestions from `SELECT DISTINCT` queries. No constraints beyond max length.
   - Pros:
     - Zero friction for adding new categories -- just type a new value
     - No migration needed when game design adds new object types
     - Simple implementation: one `SELECT DISTINCT` query per autocomplete dropdown
     - Consistent with the existing tag system (freeform JSONB array)
     - Nullable allows gradual adoption -- existing objects don't need immediate classification
   - Cons:
     - No referential integrity -- typos create duplicate categories ("Tree" vs "tree" vs "trees")
     - No cascade behavior -- renaming a category requires updating all matching rows
     - `SELECT DISTINCT` performance degrades with very large datasets (mitigated: internal tool, <10K objects expected)
   - Effort: 0.5 day

2. **PostgreSQL enum types (`pgEnum`)**
   - Overview: Define `categoryEnum` and `objectTypeEnum` using Drizzle's `pgEnum`, constraining values at the database level.
   - Pros:
     - Database-level validation prevents invalid values
     - Small storage footprint (enum values stored as integers internally)
     - Clear documentation of allowed values in schema
   - Cons:
     - Adding new enum values requires a database migration (`ALTER TYPE ... ADD VALUE`)
     - Cannot remove enum values without recreating the type (PostgreSQL limitation)
     - Introduces the first `pgEnum` in the codebase -- new pattern for the team
     - Game design is evolving rapidly -- enum rigidity conflicts with iterative design
     - Drizzle ORM's enum handling has known quirks with migration ordering
   - Effort: 1 day

3. **Separate reference tables (`categories`, `object_types`)**
   - Overview: Create `categories` and `object_types` lookup tables with foreign keys from `game_objects`.
   - Pros:
     - Full referential integrity with cascade behavior
     - Can store additional metadata per category (icon, description, sort order)
     - Standard relational pattern for classification
     - Rename a category in one place, all references update
   - Cons:
     - Two additional tables and migrations for simple string labels
     - JOIN required to display category name (or denormalize with a name column)
     - CRUD complexity increases (must create category before assigning to object)
     - Over-engineered for an internal tool with <10K objects
     - No existing reference table pattern in the asset pipeline schema
   - Effort: 2 days

### Comparison

| Criterion | Free-Text Varchar | pgEnum | Reference Tables |
|-----------|------------------|--------|-----------------|
| Flexibility | High (any string) | Low (migration per value) | Medium (insert row) |
| Data integrity | Low (typos possible) | High (DB-enforced) | High (FK-enforced) |
| Migration overhead | One-time (add columns) | Per new value | One-time (add tables) |
| Pattern consistency | Matches freeform tags | New pattern (no enums exist) | New pattern (no ref tables exist) |
| Implementation effort | 0.5 day | 1 day | 2 days |
| Query complexity | Simple | Simple | Requires JOIN |
| Rename/cleanup | UPDATE WHERE | Cannot remove values | Update one row |

### Decision

**Free-text varchar columns with autocomplete selected.** The game design is in early iteration -- object categories and types will evolve frequently as new art assets are created and gameplay is prototyped. Free-text with autocomplete provides the fastest iteration cycle (type a new value, it appears in suggestions for future objects) without migration overhead. The risk of typo-based duplicates is mitigated by the autocomplete UI showing existing values, and can be further addressed with case-insensitive normalization at the application level (`category.trim().toLowerCase()`).

The `pgEnum` option (Option 2) is the strongest alternative for data integrity but introduces the first enum in the codebase and creates friction for every new category. Reference tables (Option 3) are appropriate for production game data but over-engineered for an internal editor tool.

**Schema Addition:**

```typescript
// In packages/db/src/schema/game-objects.ts
category: varchar('category', { length: 100 }),
objectType: varchar('object_type', { length: 100 }),
```

**Autocomplete Query:**

```sql
SELECT DISTINCT category FROM game_objects
  WHERE category IS NOT NULL
  ORDER BY category;

SELECT DISTINCT object_type FROM game_objects
  WHERE object_type IS NOT NULL
  ORDER BY object_type;
```

---

## Decision 3: Grid Settings as Editor Session State (Not Persisted)

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Grid mode (snap/free) and cell size are editor session state stored in React component state and `localStorage`, not persisted in the database |
| **Why now** | The object editor grid system is being built. A decision is needed on whether grid preferences are per-object (stored in DB) or per-session (stored locally). |
| **Why this** | Grid settings are an authoring preference, not a property of the game object itself. Objects store final pixel positions regardless of how they were placed. Persisting grid settings in the database would couple editor UX preferences to the data model consumed by the game runtime. |
| **Known unknowns** | Whether different objects benefit from different default grid sizes (e.g., 16px for small items, 32px for buildings). If so, a per-object grid hint could be added to `metadata` later without schema changes. |
| **Kill criteria** | If users consistently need to switch grid sizes when editing different objects and find it frustrating to reconfigure each time, add an optional `gridHint` field to `metadata`. |

### Options Considered

1. **Editor session state only -- React state + localStorage (Selected)**
   - Overview: Grid mode (snap/free) and cell size stored in React `useState` with persistence to `localStorage` for cross-session continuity. Objects store final pixel coordinates only.
   - Pros:
     - Clean separation: objects represent game data, grid is an authoring tool
     - No schema change needed
     - Instant toggling without API calls
     - `localStorage` preserves preferences across browser sessions
     - Game runtime never needs to know about editor grid settings
   - Cons:
     - Grid preferences don't follow the user to a different browser/device
     - No per-object grid memory (must reconfigure when switching between objects with different ideal grid sizes)
   - Effort: 0 days (standard React pattern)

2. **Per-object grid settings in `metadata` JSONB**
   - Overview: Store `gridMode` and `gridCellSize` in `game_objects.metadata` for each object.
   - Pros:
     - Grid settings travel with the object
     - Different objects can have different grid sizes
     - No schema migration (uses existing `metadata` column)
   - Cons:
     - Couples editor UX preference to game data model
     - Game runtime must ignore grid fields it doesn't use
     - Increases object payload size for non-game data
     - Grid settings are not meaningful outside the editor context
   - Effort: 0.5 day

3. **Dedicated `grid_mode` and `grid_cell_size` columns on `game_objects`**
   - Overview: Add two new columns for grid settings.
   - Pros:
     - First-class schema support for grid preferences
     - Can set defaults at the database level
   - Cons:
     - Schema change for editor-only data
     - Pollutes the game object schema with non-game data
     - Every API response includes grid settings that only the editor uses
     - Most egregious coupling of editor state to data model
   - Effort: 1 day

### Comparison

| Criterion | Session State + localStorage | metadata JSONB | Dedicated Columns |
|-----------|------------------------------|----------------|-------------------|
| Schema impact | None | None (existing column) | Migration required |
| Separation of concerns | Clean (editor vs game data) | Mixed | Poor (editor data in schema) |
| Per-object memory | No | Yes | Yes |
| Cross-device sync | No | Yes (via API) | Yes (via API) |
| Runtime payload | Clean (no editor cruft) | Includes editor fields | Includes editor columns |
| Implementation effort | 0 days | 0.5 day | 1 day |

### Decision

**Editor session state (React + localStorage) selected.** Grid settings are an authoring preference that belongs to the editor session, not to the game object data model. The game runtime does not need to know whether an object was placed with snap-to-grid or freeform positioning -- it only needs the final pixel coordinates stored in the `layers` array. Storing grid settings in `localStorage` provides sufficient persistence for a single-user internal tool, and adding per-object grid hints to `metadata` remains a low-cost future option if needed.

**Implementation Pattern:**

```typescript
// React hook for grid settings with localStorage persistence
const [gridMode, setGridMode] = useState<'snap' | 'free'>(() => {
  return (localStorage.getItem('gridMode') as 'snap' | 'free') ?? 'snap';
});
const [gridCellSize, setGridCellSize] = useState<number>(() => {
  return parseInt(localStorage.getItem('gridCellSize') ?? '16', 10);
});

// Persist on change
useEffect(() => { localStorage.setItem('gridMode', gridMode); }, [gridMode]);
useEffect(() => { localStorage.setItem('gridCellSize', String(gridCellSize)); }, [gridCellSize]);
```

---

## Consequences

### Positive Consequences

- **Direct Phaser 3 compatibility**: The `CollisionZone` data structure maps 1:1 to Phaser 3 Arcade Physics `StaticBody` creation -- no intermediate transformation layer needed. Each zone becomes one `setSize(width, height)` + `setOffset(x, y)` call.
- **Clear two-level collision model**: Frame-level collision (`atlas_frames.customData.collisionRect/passable`) handles tilemap collisions, while object-level collision (`game_objects.collision_zones`) handles composed object collisions. The distinction is explicit and documented.
- **Schema consistency**: All three decisions maintain the established patterns -- JSONB for structured data, varchar for simple text fields, no enums, no new reference tables.
- **Clean data model**: Game objects contain only game-relevant data (collision zones, classification). Editor preferences (grid settings) stay in the editor.
- **Low migration risk**: Adding two varchar columns and one nullable JSONB column to an existing table is an additive-only migration with zero risk to existing data.
- **Flexible classification**: Free-text category and type fields support rapid iteration of game design vocabulary without migration overhead.

### Negative Consequences

- **No database-level validation of collision zone structure**: The `CollisionZone` TypeScript interface is enforced at the application level only. Malformed JSONB (e.g., missing `width` field) would not be caught by the database. This is the same trade-off accepted for `layers`, `tags`, and `metadata`.
- **Potential category/type inconsistency**: Free-text fields allow typos and near-duplicates (e.g., "Furniture" vs "furniture"). Mitigated by autocomplete UI and optional application-level normalization, but not prevented by the schema.
- **Two similar-but-different collision concepts**: `atlas_frames.customData.collisionRect` (frame-level) and `game_objects.collision_zones` (object-level) serve different purposes but have overlapping naming. Clear documentation in the schema file and ADR is required to prevent confusion.
- **Grid preferences not portable**: Grid settings in `localStorage` don't travel between browsers or devices. Acceptable for a single-user internal tool.

### Neutral Consequences

- **Existing `metadata` column remains generic**: The `metadata` JSONB column on `game_objects` continues to serve as a catch-all for unstructured data. Collision zones have their own column, preventing `metadata` from accumulating game-critical data.
- **No index on `collision_zones`**: At expected scale (<10K objects), no GIN index is needed on the JSONB column. Can be added later if query patterns require it.
- **`shape` field is always `'rectangle'`**: The `shape` field in `CollisionZone` is currently always `'rectangle'` (Arcade Physics limitation). Including it in the schema provides forward compatibility if the project ever migrates to Matter.js physics (which supports circles and polygons).

## Implementation Guidance

- Define the `CollisionZone` TypeScript interface in `packages/db/src/schema/game-objects.ts` alongside the existing `GameObjectLayer` interface
- Add `collisionZones` as a nullable JSONB column to the `game_objects` table schema, defaulting to `null` (no collision zones)
- Add `category` and `objectType` as nullable `varchar(100)` columns to the `game_objects` table schema
- Generate a Drizzle migration for the three new columns using `drizzle-kit generate`
- Update `CreateGameObjectData` and `UpdateGameObjectData` interfaces in the service layer to include the new fields
- Validate `CollisionZone[]` structure at the API layer before database insertion (check required fields, positive dimensions, valid `type` values)
- Use `crypto.randomUUID()` for collision zone IDs at creation time in the editor UI
- Implement autocomplete API endpoints using `SELECT DISTINCT category/object_type FROM game_objects WHERE ... IS NOT NULL ORDER BY ...`
- Store grid preferences in `localStorage` with keys `gridMode` and `gridCellSize`
- Document the frame-level vs object-level collision distinction in code comments on both schema files

## Related Information

- [ADR-0007: Sprite Management Storage and Schema](ADR-0007-sprite-management-storage-and-schema.md) -- Established the `game_objects` table schema, JSONB patterns, and `atlas_frames.customData` reserved keys
- [Design Doc 007: Sprite Management](../design/design-007-sprite-management.md) -- Design document for the sprite management tool including `game_objects` table design
- Existing schema: `packages/db/src/schema/game-objects.ts` (current `game_objects` table), `packages/db/src/schema/atlas-frames.ts` (`customData` with `passable`/`collisionRect`)
- Existing service: `packages/db/src/services/game-object.ts` (CRUD operations that will need new field support)
- Existing UI: `apps/genmap/src/components/atlas-zone-canvas.tsx` (rectangle drawing canvas that can be adapted for collision zone authoring)

## References

- [Phaser 3 Arcade Physics Concepts](https://docs.phaser.io/phaser/concepts/physics/arcade) -- Official Arcade Physics documentation covering body types, collision detection, and AABB constraints
- [Phaser 3 Arcade Physics API: StaticBody](https://docs.phaser.io/api-documentation/class/physics-arcade-staticbody) -- StaticBody API reference for `setSize()` and `setOffset()` methods
- [Phaser 3 Arcade Physics: Multiple Collision Bodies Discussion](https://phaser.discourse.group/t/arcade-physics-create-one-sprite-with-multiple-collision-bodies-compounded-sprite/3773) -- Community discussion on compound collision bodies with Arcade Physics using StaticGroups
- [Phaser 3 Arcade Physics: Multiple Bounding Boxes](https://phaser.discourse.group/t/multiple-collision-overlap-bounding-boxes-in-a-sprite/2349) -- Community patterns for multiple collision/overlap areas per sprite
- [Phaser 3 StaticBody setOffset Issue #3465](https://github.com/phaserjs/phaser/issues/3465) -- Known issue with `setOffset()` on static group bodies
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html) -- Official JSONB type documentation
- [PostgreSQL as a JSON Database: Advanced Patterns (AWS)](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/) -- Best practices for JSONB schema design
- [7 Postgres JSONB Patterns for Semi-Structured Speed](https://medium.com/@connect.hashblock/7-postgres-jsonb-patterns-for-semi-structured-speed-69f02f727ce5) -- JSONB performance patterns and indexing strategies
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview) -- ORM used for schema definitions and migrations

## Date

2026-02-19
