# ADR-0011: Game Object Type System

## Status

Proposed (Amends ADR-0008 Decision 2)

## Context

This ADR amends ADR-0008 Decision 2 (Category and Object Type as Free-Text Varchar Columns). The original decision chose free-text `varchar(100)` with autocomplete for `category` and `objectType` fields on the `game_objects` table. The rationale was: "The game design is in early iteration -- object categories and types will evolve frequently."

### Why Amend Now

The game design has matured through multiple feature implementations (fences, terrain system, zone system). A consistent category vocabulary has emerged organically:

- The GDD defines clear spatial domains: **house interior**, **yard/exterior**, **farm**, and **public town** areas
- Each domain has distinct object types: furniture and decor (interior), fences and paths (exterior), crops and enclosures (farm), buildings and stalls (public)
- Code that needs to handle objects by category (e.g., placement validation -- "only furniture objects can be placed indoors") currently has no TypeScript-level guidance. Developers must guess string values or query the database for `SELECT DISTINCT` values.
- Free-text allows typos and inconsistency (e.g., "Furniture" vs "furniture" vs "furnishing") with no compile-time detection

### Current State of the Codebase

The `category` and `objectType` fields exist as nullable `varchar(100)` columns on the `game_objects` table (`packages/db/src/schema/game-objects.ts:33-34`). The editor hook (`apps/genmap/src/hooks/use-object-editor.ts:79-80`) stores them as free-text strings. The service layer (`packages/db/src/services/game-object.ts:83-95`) provides a `getDistinctValues()` function that powers autocomplete dropdowns via `SELECT DISTINCT`.

No TypeScript types, constants, or enums exist for category or objectType values anywhere in the codebase. The `@nookstead/shared` package (`packages/shared/src/types/`) defines types for terrain, fences, maps, and room state but has no game object classification types.

### Constraints

- **Fence types remain separate**: Fences have their own classification system via the `fence_types` database table (ADR-0010). They are not game objects and are not classified by this system.
- **No existing data in DB**: The database has no game object rows yet -- this is a fresh start with no migration concerns.
- **DB stays VARCHAR(100)**: No `pgEnum`, no new tables. The schema established in ADR-0008 is preserved.
- **Existing autocomplete still works**: The `getDistinctValues()` function continues to operate alongside predefined values.

---

## Decision 1: Soft-Enforced TypeScript Types for Game Object Classification

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Define TypeScript const arrays and union types in `@nookstead/shared` for a two-level hierarchy (Category -> ObjectType). Keep DB as VARCHAR(100) for backward compatibility. Soft enforcement -- predefined values shown first in editor dropdowns, but custom values still accepted. |
| **Why now** | Multiple feature implementations (fences, terrain, zones) have stabilized the game's spatial domain model. The GDD vocabulary is consistent enough to codify, and upcoming features (indoor placement validation, shop inventory filtering) need category-aware logic with type safety. |
| **Why this** | Soft enforcement provides TypeScript-level guidance for developers (autocomplete, exhaustive switch checks) without blocking rapid iteration. Custom values remain possible for edge cases and experimentation, avoiding the rigidity that ADR-0008 originally sought to prevent. |
| **Known unknowns** | Whether the four top-level categories (interior, exterior, farm, public) will remain stable as more GDD features are implemented. The `public` category may need subdivision (e.g., "civic", "commercial") as town features develop. The GDD's Dock/Garage homestead area (transport departure point) does not map cleanly to any of the four categories -- transport-related objects (dock, garage, bus stop) may warrant their own category or be classified under `exterior` or `public`. Deferred until transport features are designed. |
| **Kill criteria** | If more than 30% of game objects in the database use custom (non-predefined) category values, the predefined types are not capturing reality and should be revisited or expanded significantly. |

### Options Considered

1. **Soft-enforced TypeScript types (Selected)**
   - Overview: Define `const` arrays and union types in `@nookstead/shared` for a two-level hierarchy. Editor shows predefined values first in dropdowns but allows custom input via a freeform field. API accepts any string but logs warnings for non-standard values. VARCHAR(100) stays in DB unchanged.
   - Pros:
     - TypeScript-level type safety: developers get autocomplete and can write exhaustive `switch` statements over known categories
     - No migration required -- database schema is unchanged from ADR-0008
     - Flexible for rapid iteration -- custom values still accepted, avoiding the rigidity concern from ADR-0008
     - Gradual adoption -- existing `getDistinctValues()` autocomplete coexists with predefined values
     - Shared package makes types available to game client, server, and editor simultaneously
     - Two-level hierarchy (Category -> ObjectType) matches the GDD's spatial domain model
   - Cons:
     - Custom values bypass the type system -- code using `GameObjectCategory` type must handle the `string` escape hatch
     - Two sources of truth for dropdown values: predefined types + database `SELECT DISTINCT` results
     - Developers may forget to update the shared types when adding genuinely new categories
   - Effort: 1 day

2. **Hard-enforced TypeScript types with API validation**
   - Overview: Same TypeScript types as Option 1, but the API layer rejects non-standard category/objectType values with a 400 error. Only predefined values are accepted.
   - Pros:
     - Strict consistency -- impossible to create objects with typos or non-standard categories
     - Single source of truth for allowed values (the TypeScript const arrays)
     - Simpler editor UI -- dropdown only, no freeform input needed
     - Type narrowing in consuming code is guaranteed (no `string` escape hatch)
   - Cons:
     - Every new category or type requires a code change, package publish, and deploy before any object can use it
     - Blocks rapid iteration during game design exploration -- directly conflicts with ADR-0008's original rationale
     - Breaking change if any existing objects (future) have non-standard values
     - Removes the flexibility that has served the project well during early development
   - Effort: 1.5 days

3. **DB-driven reference table**
   - Overview: Create `object_categories` and `object_types` tables. Foreign keys from `game_objects.category` and `game_objects.object_type` to these reference tables. Types seeded from initial values, new categories added via CRUD.
   - Pros:
     - Full referential integrity -- foreign key constraints prevent invalid values
     - Can store metadata per category (icon, description, sort order, color) for rich editor UI
     - Rename cascades -- change a category name in one row, all game objects update
     - Standard relational pattern, well-understood by any database engineer
     - Admin UI can manage categories without code changes
   - Cons:
     - Introduces a new pattern: no reference/lookup tables exist anywhere in the asset pipeline schema
     - JOIN complexity: listing game objects with category names requires a JOIN (or denormalization)
     - Must seed initial data in a migration -- adds deployment dependency
     - CRUD overhead: creating a new category requires an API call to the reference table before using it
     - Over-engineered for an internal tool with fewer than 10K objects expected
     - Conflicts with ADR-0008's principle of keeping the schema simple and avoiding new tables for classification
   - Effort: 3 days

### Comparison

| Criterion | Soft-Enforced TS Types | Hard-Enforced TS + API | DB Reference Tables |
|-----------|----------------------|----------------------|-------------------|
| Type safety in TS code | High (union types, autocomplete) | Highest (guaranteed narrowing) | None (strings from DB) |
| Flexibility for new values | High (custom values accepted) | None (code change required) | Medium (insert row required) |
| DB schema changes | None | None | New tables + FKs + seed migration |
| Iteration speed | Fast (type a new value) | Slow (code + deploy per value) | Medium (DB insert per value) |
| Data consistency | Medium (soft warnings) | High (API rejection) | High (FK constraints) |
| Pattern consistency | Follows existing VARCHAR | Follows existing VARCHAR | New pattern for asset pipeline |
| Developer experience | Good (autocomplete + escape hatch) | Good (strict autocomplete) | Poor (must query ref tables) |
| Migration effort | Zero | Zero | 1 migration + seed data |
| Runtime overhead | None | Validation per request | JOIN per query |
| Metadata per category | No (add later if needed) | No (add later if needed) | Yes (dedicated columns) |

### Decision

**Soft-enforced TypeScript types selected.** This approach provides the type safety and developer guidance that free-text VARCHAR lacks, while preserving the flexibility that ADR-0008 correctly prioritized for early-stage game design. The two-level hierarchy maps directly to the GDD's spatial domain model (interior/exterior/farm/public, each with specific object types).

Hard enforcement (Option 2) is the strongest alternative for data consistency but creates friction that is inappropriate at this stage -- the game design is still iterating, and blocking object creation on a deploy cycle would slow down art asset integration. DB reference tables (Option 3) are the right pattern for a production game with a content management pipeline but introduce unnecessary schema complexity for an internal editor tool.

The soft enforcement approach can be tightened to hard enforcement later (by adding API validation) without any schema changes, making it a safe incremental step.

**Type Definitions (to be placed in `packages/shared/src/types/game-object.ts`):**

```typescript
/**
 * Two-level game object classification hierarchy.
 * Derived from GDD spatial domains (house interior, yard/exterior, farm, public town).
 *
 * Soft-enforced: these are the predefined values shown first in editor dropdowns.
 * Custom values are accepted by the DB (VARCHAR) but not represented in these types.
 */
export const GAME_OBJECT_CATEGORIES = [
  'interior',
  'exterior',
  'farm',
  'public',
] as const;

export type GameObjectCategory = (typeof GAME_OBJECT_CATEGORIES)[number];

export const GAME_OBJECT_TYPES = {
  interior: ['furniture', 'decor', 'lighting'] as const,
  exterior: [
    'fence',
    'gate',
    'path',
    'bench',
    'lantern',
    'flowerbed',
    'utility_building',
  ] as const,
  farm: ['crop', 'tree', 'animal_enclosure', 'crafting_station'] as const,
  public: ['town_building', 'market_stall', 'transport_station'] as const,
} as const satisfies Record<GameObjectCategory, readonly string[]>;

export type GameObjectType<C extends GameObjectCategory = GameObjectCategory> =
  (typeof GAME_OBJECT_TYPES)[C][number];

/**
 * Type guard: check if a string is a known GameObjectCategory.
 */
export function isGameObjectCategory(
  value: string
): value is GameObjectCategory {
  return (GAME_OBJECT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Type guard: check if a string is a known GameObjectType for a given category.
 */
export function isGameObjectType(
  category: GameObjectCategory,
  value: string
): value is GameObjectType<typeof category> {
  return (
    GAME_OBJECT_TYPES[category] as readonly string[]
  ).includes(value);
}

/**
 * Get all known object types as a flat array (across all categories).
 */
export function getAllGameObjectTypes(): string[] {
  return Object.values(GAME_OBJECT_TYPES).flat();
}
```

**Editor Dropdown Behavior:**

The editor shows predefined values at the top of the dropdown (grouped by source), followed by any additional values from `getDistinctValues()` that are not in the predefined list. A freeform text input at the bottom allows entering custom values.

```
Category dropdown:
  -- Predefined --
  interior
  exterior
  farm
  public
  -- From existing objects --
  [any custom values from SELECT DISTINCT]
  -- Custom --
  [freeform text input]
```

**API Warning Behavior:**

```typescript
// In API handler, after accepting the value:
if (data.category && !isGameObjectCategory(data.category)) {
  logger.warn('Non-standard game object category used', {
    category: data.category,
    objectId: result.id,
  });
}
```

---

## Consequences

### Positive Consequences

- **TypeScript-level developer guidance**: Developers get autocomplete for known categories and types, can write exhaustive `switch` statements, and get compile-time feedback when handling category-dependent logic.
- **GDD alignment**: The two-level hierarchy (Category -> ObjectType) directly maps to the GDD's spatial domains, making the code self-documenting for the game design vocabulary.
- **Zero migration risk**: The database schema is completely unchanged -- `category` and `objectType` remain nullable `varchar(100)` exactly as ADR-0008 established.
- **Backward-compatible**: Existing `getDistinctValues()` autocomplete and all current service layer code continues to work without modification.
- **Incremental tightening path**: Can upgrade to hard enforcement (API validation) at any time by adding a validation check, without any schema or type definition changes.
- **Shared across packages**: Types defined in `@nookstead/shared` are available to game client, game server, editor, and any future package that needs category-aware logic.

### Negative Consequences

- **Two sources of dropdown values**: The editor must merge predefined types with `SELECT DISTINCT` results, adding minor UI complexity. Predefined values that have never been used in the DB will appear in dropdowns but not in `getDistinctValues()` results.
- **Custom values escape the type system**: Code that receives `category` from the database gets `string | null`, not `GameObjectCategory | null`. Consuming code must use the type guard (`isGameObjectCategory`) or accept the wider type.
- **Maintenance burden for type definitions**: When the GDD evolves and a new category or object type is needed, the shared package types must be updated. If forgotten, the new values work fine (soft enforcement) but miss out on type safety benefits.
- **Soft enforcement does not prevent inconsistency**: A developer can still write `"Exterior"` instead of `"exterior"`. The warning log helps detect this, but does not block it.

### Neutral Consequences

- **ADR-0008 Decision 2 is amended, not superseded**: The database schema (VARCHAR columns, no enums, no reference tables) remains as decided. Only the application-level treatment of those values changes from fully freeform to soft-guided.
- **Fence classification remains separate**: Fences use the `fence_types` table (ADR-0010) and are not classified as game objects. The `exterior.fence` and `exterior.gate` object types in this hierarchy are for decorative fence/gate objects (e.g., a garden archway), not for the fence system's auto-connecting fence segments.
- **`getDistinctValues()` function unchanged**: The existing service function continues to work. It can be enhanced to merge predefined values with DB values, but this is an editor UI concern, not a service layer change.

## Implementation Guidance

- Define const arrays, union types, and type guards in a new file `packages/shared/src/types/game-object.ts` and export from the shared package index
- Use `as const satisfies Record<GameObjectCategory, readonly string[]>` to ensure the type hierarchy stays in sync (adding a category to the array without adding its types causes a compile error)
- Keep the database schema as-is -- no migration, no `pgEnum`, no reference tables
- In the editor UI, present predefined values first in dropdowns, followed by any non-predefined values from `getDistinctValues()`, and allow freeform custom input
- In the API layer, accept any string for `category` and `objectType` but log a warning when a non-predefined value is used
- In consuming code that needs category-dependent behavior, use the `isGameObjectCategory()` type guard to narrow from `string` to `GameObjectCategory` before branching
- Add `category` and `objectType` optional filter parameters to `listGameObjects()` in the service layer to support filtering by classification
- In the API layer, normalize `category` and `objectType` values with `.trim().toLowerCase()` before database insertion to prevent case-variant duplicates (e.g., "Exterior" vs "exterior"). This aligns with the normalization strategy described in ADR-0008 Decision 2
- Use lowercase snake_case for all predefined values to match existing conventions (`deep_water`, `grass`, `fence_types.key`)

## Related Information

- [ADR-0008: Object Editor Collision Zones and Metadata](ADR-0008-object-editor-collision-zones-and-metadata.md) -- Original decision establishing `category` and `objectType` as free-text VARCHAR columns (Decision 2). This ADR amends that decision by adding soft-enforced TypeScript types while preserving the VARCHAR schema.
- [ADR-0010: Fence System Architecture](ADR-0010-fence-system-architecture.md) -- Established fences as a separate system with its own `fence_types` table, distinct from game object classification.
- [ADR-0007: Sprite Management Storage and Schema](ADR-0007-sprite-management-storage-and-schema.md) -- Established the `game_objects` table schema and JSONB patterns.
- Existing schema: `packages/db/src/schema/game-objects.ts` -- `game_objects` table with `category` and `objectType` VARCHAR columns
- Existing service: `packages/db/src/services/game-object.ts` -- `getDistinctValues()` autocomplete function, `listGameObjects()` that needs filter params
- Existing editor hook: `apps/genmap/src/hooks/use-object-editor.ts` -- `category` and `objectType` as free-text strings in editor state
- Shared types location: `packages/shared/src/types/` -- where new type definitions will be added
- GDD object references: `docs/nookstead-gdd-v3.md` -- spatial domains (house interior, yard/exterior, farm, public town) and object descriptions

## References

- [TypeScript `as const` Assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions) -- Official TypeScript documentation for const assertions used in the type definitions
- [TypeScript `satisfies` Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator) -- Official TypeScript documentation for the `satisfies` keyword used to validate the category-to-types mapping

## Date

2026-02-21
