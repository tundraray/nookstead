# Game Object Type System Design Document

## Overview

This document defines the implementation of soft-enforced TypeScript types for game object classification, as decided in ADR-0011. The system introduces a two-level hierarchy (Category -> ObjectType) defined in `@nookstead/shared`, adds category/objectType filtering to the service layer and API, enhances the suggestions API to merge predefined values with DB-sourced values, replaces free-text inputs in the editor UI with searchable dropdowns, and consolidates a duplicated `CollisionZone` interface as a technical debt cleanup.

**Related Documents:**
- **ADR-0011:** `docs/adr/ADR-0011-game-object-type-system.md` -- Soft-enforced TypeScript types for game object classification
- **ADR-0008:** `docs/adr/ADR-0008-object-editor-collision-zones-and-metadata.md` -- Original decision for free-text VARCHAR columns (amended by ADR-0011)

## Design Summary (Meta)

```yaml
design_type: "extension"
risk_level: "low"
complexity_level: "low"
complexity_rationale: >
  No database migration, no new tables, no new async coordination. Changes are
  additive: new type definitions, optional filter params on an existing query,
  merged suggestion lists, and dropdown UI components replacing text inputs.
  The only cross-cutting concern is the CollisionZone deduplication, which is a
  straightforward import replacement.
main_constraints:
  - "DB schema is unchanged -- category and objectType remain VARCHAR(100)"
  - "Soft enforcement only -- API never rejects custom values"
  - "Fence types remain a separate system (ADR-0010)"
  - "No existing data in DB to migrate"
  - "satisfies constraint ensures compile error if category added without types"
biggest_risks:
  - "Editor dropdown UX regression if suggestions API latency increases"
  - "Developers forgetting to update shared types when GDD evolves"
unknowns:
  - "Whether the four top-level categories will remain stable long-term"
```

---

## Background and Context

### Prerequisite ADRs

- **ADR-0011 (Game Object Type System):** Defines the two-level hierarchy, const arrays, union types, and type guards to be implemented in `@nookstead/shared`. This design doc implements that decision.
- **ADR-0008 (Object Editor Collision Zones and Metadata):** Original decision establishing `category` and `objectType` as free-text VARCHAR columns. ADR-0011 amends Decision 2 to add soft-enforced types while preserving the VARCHAR schema.
- **ADR-0010 (Fence System Architecture):** Fences use their own `fence_types` table and are explicitly excluded from game object classification.

No common ADRs exist in the repository (`docs/adr/ADR-COMMON-*` was checked and none were found).

### Agreement Checklist

#### Scope
- [x] New TypeScript type definitions in `@nookstead/shared` (`packages/shared/src/types/game-object.ts`)
- [x] Service layer: add `category` and `objectType` filter params to `listGameObjects()`
- [x] API route: accept `category` and `objectType` query params on `GET /api/objects`
- [x] Suggestions API: merge predefined values with DB-sourced distinct values
- [x] Editor UI: replace free-text inputs with searchable dropdowns (new/edit pages)
- [x] Technical debt: consolidate duplicated `CollisionZone` interface

#### Non-Scope (Explicitly not changing)
- [x] Database schema (`packages/db/src/schema/game-objects.ts`) -- no migration, no pgEnum
- [x] Map editor game objects panel (`game-objects-panel.tsx`) -- already groups by category string
- [x] Object card component (`object-card.tsx`) -- displays category/objectType as strings, unchanged
- [x] Editor hook internal state type (`useObjectEditor`) -- `category` and `objectType` remain `string`
- [x] Fence type system -- entirely separate, per ADR-0010

#### Constraints
- [x] Parallel operation: Not applicable (single-developer editor tool)
- [x] Backward compatibility: Required -- existing code that reads `category`/`objectType` as `string | null` from DB must continue to work
- [x] Performance measurement: Not required -- no hot paths affected

### Problem to Solve

The `category` and `objectType` fields on `game_objects` are nullable `varchar(100)` columns with no TypeScript-level guidance. Developers must guess valid string values or query the database. There is no compile-time detection of typos (e.g., "Furniture" vs "furniture"), no autocomplete for known categories, and no ability to write exhaustive `switch` statements over category values.

### Current Challenges

1. **No type safety**: `category` and `objectType` are plain strings throughout the codebase
2. **No predefined vocabulary**: The GDD defines clear spatial domains but the code does not codify them
3. **Duplicated interfaces**: `CollisionZone` is defined identically in 3 files
4. **Filtering gap**: `listGameObjects()` has no category/objectType filtering
5. **Editor UX**: Free-text inputs provide no guidance about what values are standard

### Requirements

#### Functional Requirements

1. TypeScript const arrays and union types for the GDD's two-level hierarchy must be defined in `@nookstead/shared`
2. `listGameObjects()` must support optional `category` and `objectType` filter params
3. `GET /api/objects` must accept `category` and `objectType` query params
4. Suggestions API must return predefined values merged with DB distinct values
5. Editor UI must show searchable dropdowns with predefined values displayed first
6. `CollisionZone` interface must be consolidated to a single source

#### Non-Functional Requirements

- **Performance**: No measurable impact -- adding WHERE clauses to an existing query; suggestion merging is O(n) on small sets
- **Maintainability**: Types are centralized in `@nookstead/shared`, single source of truth for both predefined values and interface definitions
- **Reliability**: Soft enforcement means the system never blocks object creation

## Acceptance Criteria (AC) - EARS Format

### AC1: Type Definitions in @nookstead/shared

- [ ] The system shall export `GAME_OBJECT_CATEGORIES`, `GameObjectCategory`, `GAME_OBJECT_TYPES`, `GameObjectType`, `isGameObjectCategory`, `isGameObjectType`, and `getAllGameObjectTypes` from `@nookstead/shared`
- [ ] **When** a new category key is added to `GAME_OBJECT_CATEGORIES` without a corresponding entry in `GAME_OBJECT_TYPES`, **then** the TypeScript compiler shall emit an error (via `satisfies Record<GameObjectCategory, readonly string[]>`)
- [ ] The system shall define exactly 4 categories: `interior`, `exterior`, `farm`, `public`
- [ ] **When** `isGameObjectCategory('interior')` is called, **then** it shall return `true`
- [ ] **When** `isGameObjectCategory('custom_value')` is called, **then** it shall return `false`

### AC2: Service Layer Filtering

- [ ] **When** `listGameObjects(db, { category: 'interior' })` is called, **then** only objects with `category = 'interior'` shall be returned
- [ ] **When** `listGameObjects(db, { objectType: 'furniture' })` is called, **then** only objects with `object_type = 'furniture'` shall be returned
- [ ] **When** both `category` and `objectType` filters are provided, **then** both conditions shall be applied (AND)
- [ ] **When** no filters are provided, **then** all objects shall be returned (backward compatible)

### AC3: API Route Filtering

- [ ] **When** `GET /api/objects?category=interior` is requested, **then** the response shall contain only objects with `category = 'interior'`
- [ ] **When** `GET /api/objects?category=interior&objectType=furniture` is requested, **then** both filters shall be applied
- [ ] **When** `GET /api/objects` is requested without filter params, **then** all objects shall be returned (backward compatible)

### AC4: Suggestions API Merge

- [ ] **When** `GET /api/objects/suggestions?field=category` is requested, **then** the response shall include all predefined categories plus any additional DB-sourced values not in the predefined list
- [ ] **When** `GET /api/objects/suggestions?field=objectType&category=interior` is requested, **then** the response shall include predefined types for `interior` plus any additional DB-sourced values
- [ ] Predefined values shall appear before DB-only values in the response array

### AC5: Editor Dropdowns

- [ ] **When** the category input is focused in the new/edit object page, **then** a searchable dropdown shall appear showing predefined categories first, followed by any DB-only values
- [ ] **When** a category is selected, **then** the objectType dropdown shall show only the predefined types for that category, plus any DB-only values
- [ ] **When** the user types a custom value not in the dropdown, **then** the value shall be accepted (soft enforcement)

### AC6: CollisionZone Consolidation

- [ ] The `CollisionZone` interface shall be defined in exactly one location (`packages/db/src/schema/game-objects.ts`) and imported by all consumers
- [ ] **When** the codebase is searched for `interface CollisionZone`, **then** exactly one definition shall be found

## Applicable Standards

| Standard | Type | Source | Impact on Design |
|----------|------|--------|-----------------|
| Prettier: single quotes, 2-space indent | Explicit | `.prettierrc`, `.editorconfig` | All new code must use single quotes and 2-space indentation |
| ESLint: @nx/eslint-plugin with module boundary enforcement | Explicit | `eslint.config.mjs` | Cross-package imports must follow Nx module boundary rules |
| TypeScript: strict mode, ES2022 target, bundler module resolution | Explicit | `tsconfig.base.json` | New types must be strict-mode compliant, use `as const` and `satisfies` |
| Nx plugin-inferred targets (no project.json) | Explicit | `nx.json` | No project.json changes needed; typecheck target is inferred |
| Path alias: `@/*` maps to `apps/genmap/src/*` | Explicit | `apps/genmap/tsconfig.json` | Editor imports use `@/` prefix |
| Lowercase snake_case for value constants | Implicit | Observed in `fence_types.key`, terrain keys (`deep_water`, `grass`), shared constants | All predefined category/objectType values must use lowercase snake_case |
| Service functions accept `DrizzleClient` as first param | Implicit | All files in `packages/db/src/services/` | New filter params are added to the existing function signature |
| API routes use Next.js App Router patterns | Implicit | `apps/genmap/src/app/api/` routes | Route handlers export named HTTP method functions |
| Shared types exported via barrel index | Implicit | `packages/shared/src/index.ts` exports all types | New game-object types must be re-exported from the shared index |
| Editor suggestion UI: popover dropdown with onMouseDown/onBlur pattern | Implicit | `apps/genmap/src/app/(app)/objects/new/page.tsx:267-293` | Dropdown implementation must follow the existing focus/blur pattern |

## Existing Codebase Analysis

### Implementation Path Mapping

| Type | Path | Description |
|------|------|-------------|
| New | `packages/shared/src/types/game-object.ts` | Game object type hierarchy definitions |
| Existing | `packages/shared/src/index.ts` | Barrel export -- add new type re-exports |
| Existing | `packages/db/src/schema/game-objects.ts` | `CollisionZone` canonical definition (keep) |
| Existing | `packages/db/src/services/game-object.ts` | `listGameObjects()` -- add filter params; `getDistinctValues()` -- unchanged |
| Existing | `packages/db/src/index.ts` | DB barrel export -- no changes needed (already exports service) |
| Existing | `apps/genmap/src/app/api/objects/route.ts` | GET handler -- add query param parsing |
| Existing | `apps/genmap/src/app/api/objects/suggestions/route.ts` | Merge predefined + DB values |
| Existing | `apps/genmap/src/app/(app)/objects/new/page.tsx` | Replace free-text with dropdown |
| Existing | `apps/genmap/src/app/(app)/objects/[id]/page.tsx` | Replace free-text with dropdown |
| Existing | `apps/genmap/src/hooks/use-object-editor.ts` | Remove duplicate `CollisionZone`, import from `@nookstead/db` |
| Existing | `apps/genmap/src/components/map-editor/game-objects-panel.tsx` | Remove duplicate `CollisionZone`, import from `@nookstead/db` |
| No change | `apps/genmap/src/components/object-card.tsx` | Reads `category`/`objectType` as strings, no changes needed |

### Integration Points

- **Shared types -> Service layer**: The service does not import the shared types (it operates on `string | null`). The shared types are consumed by the UI and any future game logic.
- **Shared types -> Suggestions API**: The suggestions route imports `GAME_OBJECT_CATEGORIES` and `GAME_OBJECT_TYPES` from `@nookstead/shared` to merge with DB values.
- **Shared types -> Editor UI**: The editor pages import predefined values to populate dropdowns.
- **Service layer -> API route**: `listGameObjects()` gains new filter params; the API route passes them through.

### Code Inspection Evidence

| File Inspected | Key Finding | Design Impact |
|---------------|-------------|---------------|
| `packages/db/src/services/game-object.ts:45-60` | `listGameObjects` uses chained `.limit()` and `.offset()` on a select query | Filter params will use the same chaining pattern with `.where()` clauses |
| `packages/db/src/services/game-object.ts:83-95` | `getDistinctValues` returns `string[]` from SELECT DISTINCT | Suggestions API merges predefined arrays with this return value |
| `packages/shared/src/types/fence-layer.ts` | Follows pattern: JSDoc comments, exported interfaces, one file per domain | New `game-object.ts` follows the same structure |
| `packages/shared/src/index.ts:65-70` | Fence types exported with `export type { ... } from './types/fence-layer'` | Game object types follow the same export pattern |
| `apps/genmap/src/app/(app)/objects/new/page.tsx:66-85` | Fetches suggestions from `/api/objects/suggestions?field=category` on mount | Same endpoint, now returns merged predefined + DB values |
| `apps/genmap/src/app/(app)/objects/new/page.tsx:267-293` | Category input with suggestion dropdown using onFocus/onBlur pattern | Enhanced dropdown replaces this pattern with grouped sections |
| `packages/db/src/schema/game-objects.ts:18-27` | Canonical `CollisionZone` interface | This definition is kept; duplicates in other files are removed |
| `apps/genmap/src/hooks/use-object-editor.ts:8-17` | Duplicate `CollisionZone` interface (identical to schema) | Will import from `@nookstead/db` instead |
| `apps/genmap/src/components/map-editor/game-objects-panel.tsx:26-35` | Duplicate `CollisionZone` interface (identical to schema) | Will import from `@nookstead/db` instead |
| `apps/genmap/src/app/api/objects/route.ts:9-44` | GET handler parses `limit`/`offset` from searchParams | New `category`/`objectType` params follow the same parsing pattern |
| `apps/genmap/src/app/api/objects/suggestions/route.ts:1-18` | Simple GET returning `getDistinctValues(db, field)` | Enhanced to merge predefined values before DB values |

---

## Design

### Change Impact Map

```yaml
Change Target: Game Object Classification System
Direct Impact:
  - packages/shared/src/types/game-object.ts (new file)
  - packages/shared/src/index.ts (add exports)
  - packages/db/src/services/game-object.ts (listGameObjects filter params)
  - apps/genmap/src/app/api/objects/route.ts (GET query params)
  - apps/genmap/src/app/api/objects/suggestions/route.ts (merge predefined values)
  - apps/genmap/src/app/(app)/objects/new/page.tsx (dropdown UI)
  - apps/genmap/src/app/(app)/objects/[id]/page.tsx (dropdown UI)
Indirect Impact:
  - apps/genmap/src/hooks/use-object-editor.ts (import change for CollisionZone)
  - apps/genmap/src/components/map-editor/game-objects-panel.tsx (import change for CollisionZone)
Indirect Impact:
  - apps/genmap/src/app/api/objects/[id]/route.ts (add non-standard value warning to PATCH handler)
No Ripple Effect:
  - packages/db/src/schema/game-objects.ts (schema unchanged)
  - apps/genmap/src/components/object-card.tsx (reads strings, unchanged)
  - Fence system (entirely separate per ADR-0010)
  - Game client (apps/game) -- no game object classification logic exists yet
```

### Architecture Overview

The game object type system is a thin TypeScript layer that lives in `@nookstead/shared` and is consumed by the editor UI and API routes. It does not introduce new runtime dependencies or architectural layers.

```mermaid
graph TD
    GDD["GDD Vocabulary<br/>(interior, exterior, farm, public)"]
    SHARED["@nookstead/shared<br/>game-object.ts<br/>(const arrays, union types, type guards)"]
    SERVICE["@nookstead/db<br/>game-object service<br/>(listGameObjects with filters)"]
    API_LIST["GET /api/objects<br/>(category, objectType query params)"]
    API_SUGGEST["GET /api/objects/suggestions<br/>(merged predefined + DB values)"]
    EDITOR_NEW["Editor: New Object Page<br/>(searchable dropdown)"]
    EDITOR_EDIT["Editor: Edit Object Page<br/>(searchable dropdown)"]
    DB[(PostgreSQL<br/>game_objects table<br/>VARCHAR(100))]

    GDD -->|"defines vocabulary"| SHARED
    SHARED -->|"type imports"| API_SUGGEST
    SHARED -->|"type imports"| EDITOR_NEW
    SHARED -->|"type imports"| EDITOR_EDIT
    SERVICE -->|"query"| DB
    API_LIST -->|"calls"| SERVICE
    API_SUGGEST -->|"calls getDistinctValues"| SERVICE
    EDITOR_NEW -->|"fetches"| API_LIST
    EDITOR_NEW -->|"fetches"| API_SUGGEST
    EDITOR_EDIT -->|"fetches"| API_SUGGEST
```

### Data Flow

```
Editor Page loads
  -> fetch GET /api/objects/suggestions?field=category
  -> Suggestions API:
       1. Import GAME_OBJECT_CATEGORIES from @nookstead/shared
       2. Call getDistinctValues(db, 'category')
       3. Merge: predefined values first, then DB-only values
       4. Return merged array
  -> Editor renders dropdown with predefined values first, then DB-only values (flat list)

User selects category "interior"
  -> fetch GET /api/objects/suggestions?field=objectType&category=interior
  -> Suggestions API:
       1. Import GAME_OBJECT_TYPES from @nookstead/shared
       2. Get predefined types for 'interior': ['furniture', 'decor', 'lighting']
       3. Call getDistinctValues(db, 'objectType')
       4. Filter DB values that are not in predefined list
       5. Return merged array
  -> Editor updates objectType dropdown

User saves object with category="interior", objectType="furniture"
  -> POST/PATCH /api/objects
  -> API accepts any string (soft enforcement)
  -> If value not in predefined list, log warning
  -> DB stores VARCHAR value as-is
```

### Integration Points List

| Integration Point | Location | Old Implementation | New Implementation | Switching Method |
|-------------------|----------|-------------------|-------------------|------------------|
| Service list filter | `packages/db/src/services/game-object.ts:listGameObjects()` | Params: `{ limit?, offset? }` | Params: `{ limit?, offset?, category?, objectType? }` | Extend existing params interface |
| API list query | `apps/genmap/src/app/api/objects/route.ts:GET` | Parses `limit`, `offset` from searchParams | Also parses `category`, `objectType` from searchParams | Add new param parsing blocks |
| Suggestions response | `apps/genmap/src/app/api/objects/suggestions/route.ts:GET` | Returns `getDistinctValues(db, field)` directly | Merges predefined values with DB values | Import from `@nookstead/shared`, merge before response |
| Editor category input | `new/page.tsx` and `[id]/page.tsx` | Free-text `<Input>` with suggestion popup | Searchable dropdown with grouped sections | Replace JSX block |
| CollisionZone import | `use-object-editor.ts`, `game-objects-panel.tsx` | Local `interface CollisionZone { ... }` | `import type { CollisionZone } from '@nookstead/db'` | Delete local interface, add import |

### Main Components

#### Component 1: Type Definitions (`packages/shared/src/types/game-object.ts`)

- **Responsibility**: Single source of truth for the game object category/objectType vocabulary
- **Interface**: Exports const arrays, union types, type guards, and a utility function
- **Dependencies**: None (pure TypeScript definitions)

#### Component 2: Service Layer Filter (`packages/db/src/services/game-object.ts`)

- **Responsibility**: Add WHERE clauses for category and objectType filtering
- **Interface**: Extended `listGameObjects` params type
- **Dependencies**: Drizzle ORM `eq` operator (already imported)

#### Component 3: Suggestions API Enhancement (`apps/genmap/src/app/api/objects/suggestions/route.ts`)

- **Responsibility**: Merge predefined values from `@nookstead/shared` with DB-sourced distinct values
- **Interface**: Enhanced GET response; new optional `category` query param for objectType context
- **Dependencies**: `@nookstead/shared` (type imports), `@nookstead/db` (getDistinctValues)

#### Component 4: Editor Dropdown UI (editor pages)

- **Responsibility**: Replace free-text inputs with searchable dropdowns showing predefined values first
- **Interface**: Same `editor.setCategory()` / `editor.setObjectType()` callbacks
- **Dependencies**: Suggestions API endpoint

### Contract Definitions

#### New Type Exports from `@nookstead/shared`

```typescript
// packages/shared/src/types/game-object.ts

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

export function isGameObjectCategory(
  value: string
): value is GameObjectCategory {
  return (GAME_OBJECT_CATEGORIES as readonly string[]).includes(value);
}

export function isGameObjectType(
  category: GameObjectCategory,
  value: string
): value is GameObjectType<typeof category> {
  return (GAME_OBJECT_TYPES[category] as readonly string[]).includes(value);
}

export function getAllGameObjectTypes(): string[] {
  return Object.values(GAME_OBJECT_TYPES).flat();
}
```

#### Extended Service Interface

```typescript
// packages/db/src/services/game-object.ts

// Before:
export async function listGameObjects(
  db: DrizzleClient,
  params?: { limit?: number; offset?: number }
)

// After:
export async function listGameObjects(
  db: DrizzleClient,
  params?: {
    limit?: number;
    offset?: number;
    category?: string;
    objectType?: string;
  }
)
```

### Data Contract

#### listGameObjects Filter

```yaml
Input:
  Type: { limit?: number; offset?: number; category?: string; objectType?: string }
  Preconditions: category and objectType are plain strings (not validated against predefined types)
  Validation: None -- soft enforcement, any string accepted

Output:
  Type: GameObject[] (same as before)
  Guarantees: Results filtered by provided category/objectType if present
  On Error: Drizzle propagates DB errors

Invariants:
  - When no filter params provided, behavior is identical to current implementation
  - Filter params are AND-combined (not OR)
```

#### Suggestions API Response

```yaml
Input:
  Type: { field: 'category' | 'objectType'; category?: string }
  Preconditions: field is required; category is optional context for objectType suggestions
  Validation: field must be 'category' or 'objectType' (existing validation)

Output:
  Type: string[]
  Guarantees:
    - Predefined values appear first in the array
    - DB-only values (not in predefined list) appear after predefined values
    - No duplicates
    - Predefined values appear in definition order (matching GDD priority); DB-only values are alphabetically sorted
  On Error: Returns 400 for invalid field param

Invariants:
  - If no objects exist in DB, response still includes predefined values
  - Predefined values are always present regardless of DB state
```

### Data Representation Decisions

| Data Structure | Decision | Rationale |
|---|---|---|
| `GameObjectCategory` (union type) | **New** dedicated type in shared | No existing type represents the category vocabulary; this is a new domain concept |
| `GameObjectType` (generic union type) | **New** dedicated type in shared | No existing type represents per-category object types; the generic parameter ensures type-level binding between category and its types |
| `CollisionZone` (interface) | **Reuse** existing from `@nookstead/db` schema | Identical interface already exists in `packages/db/src/schema/game-objects.ts`; the duplicates in hooks and components are removed |
| `listGameObjects` params | **Extend** existing inline type | Adding 2 optional fields to the existing params object is simpler than creating a new type |

### Field Propagation Map

```yaml
fields:
  - name: "category"
    origin: "Editor UI dropdown selection / custom text input"
    transformations:
      - layer: "Editor UI (React state)"
        type: "string"
        validation: "none (soft enforcement)"
      - layer: "API Request Body (POST/PATCH)"
        type: "string | null"
        transformation: "trim().toLowerCase(), empty string -> null"
      - layer: "Service Layer (createGameObject/updateGameObject)"
        type: "string | null"
        transformation: "none (pass-through)"
      - layer: "Database"
        type: "varchar(100) NULL"
        transformation: "none"
    destination: "game_objects.category column"
    loss_risk: "none"

  - name: "objectType"
    origin: "Editor UI dropdown selection / custom text input"
    transformations:
      - layer: "Editor UI (React state)"
        type: "string"
        validation: "none (soft enforcement)"
      - layer: "API Request Body (POST/PATCH)"
        type: "string | null"
        transformation: "trim().toLowerCase(), empty string -> null"
      - layer: "Service Layer"
        type: "string | null"
        transformation: "none (pass-through)"
      - layer: "Database"
        type: "varchar(100) NULL"
        transformation: "none"
    destination: "game_objects.object_type column"
    loss_risk: "none"

  - name: "category (filter)"
    origin: "API query parameter"
    transformations:
      - layer: "API Route"
        type: "string | null (from searchParams)"
        validation: "present and non-empty"
      - layer: "Service Layer (listGameObjects)"
        type: "string (optional param)"
        transformation: "passed to WHERE clause"
    destination: "SQL WHERE game_objects.category = $1"
    loss_risk: "none"
```

### Integration Boundary Contracts

```yaml
Boundary: Shared Types -> Suggestions API
  Input: Import of GAME_OBJECT_CATEGORIES, GAME_OBJECT_TYPES constants
  Output: Sync; used to build predefined value arrays at request time
  On Error: N/A (compile-time import, no runtime failure mode)

Boundary: Suggestions API -> Editor UI
  Input: GET /api/objects/suggestions?field=category (or objectType&category=X)
  Output: Sync HTTP response; JSON string array
  On Error: Editor falls back to showing only what the fetch returns (empty or partial)

Boundary: API Route -> Service Layer (filtering)
  Input: Parsed category/objectType strings from query params
  Output: Sync; filtered GameObject[] from DB
  On Error: DB errors propagate as 500 responses (existing error handling)

Boundary: DB Schema -> CollisionZone consumers
  Input: Import of CollisionZone type from @nookstead/db
  Output: Sync; type-only import, no runtime
  On Error: N/A (compile-time only)
```

### Interface Change Impact Analysis

| Existing Operation | New Operation | Conversion Required | Adapter Required | Compatibility Method |
|-------------------|---------------|-------------------|------------------|---------------------|
| `listGameObjects(db, { limit, offset })` | `listGameObjects(db, { limit, offset, category?, objectType? })` | None | Not Required | New params are optional, backward compatible |
| `GET /api/objects?limit=N&offset=N` | `GET /api/objects?limit=N&offset=N&category=X&objectType=Y` | None | Not Required | New query params are optional |
| `GET /api/objects/suggestions?field=F` | `GET /api/objects/suggestions?field=F&category=C` | None | Not Required | `category` param is optional, response format unchanged (string[]) |
| `CollisionZone` (local interface) | `CollisionZone` (imported from @nookstead/db) | Import change | Not Required | Interface is identical, only import path changes |

### Error Handling

- **Invalid filter values**: The API does not validate category/objectType values against predefined types (soft enforcement). Any string is accepted. If the DB has no matching rows, an empty array is returned.
- **Suggestions API with unknown category**: If `category` param is not a known `GameObjectCategory`, the API returns DB-only values (no predefined types to merge). This is intentional -- custom categories may have DB-sourced objectType values.
- **Non-standard value warning**: When creating/updating objects, the API logs a warning if the category or objectType is not in the predefined list. This uses `console.warn` (no structured logging framework exists in the project yet).

### Logging and Monitoring

- **Warning log on non-standard values**: In `POST /api/objects` and `PATCH /api/objects/:id`, if the submitted `category` or `objectType` is not in the predefined list, log: `Non-standard game object [category|objectType] used: { value, objectId }`
- **No new monitoring dashboards**: The editor is an internal tool with low traffic. The warning log is sufficient for detecting vocabulary drift.

---

## Implementation Plan

### Implementation Approach

**Selected Approach**: Vertical Slice (Feature-driven)
**Selection Reason**: Each change is small and independent. The type definitions can be created first, then each consumer (service, API, suggestions, UI) can be updated in sequence. Each slice produces a working, testable increment. There are no complex cross-cutting dependencies that would benefit from a horizontal approach.

### Technical Dependencies and Implementation Order

#### 1. Type Definitions (`@nookstead/shared`)
- **Technical Reason**: All other changes depend on importing these types
- **Dependent Elements**: Suggestions API, Editor UI

#### 2. CollisionZone Consolidation
- **Technical Reason**: Independent cleanup, can be done in parallel with types
- **Prerequisites**: None

#### 3. Service Layer Filter
- **Technical Reason**: API route depends on the service accepting filter params
- **Prerequisites**: None (does not import shared types)
- **Dependent Elements**: API route

#### 4. API Route Filter Params
- **Technical Reason**: Depends on service layer filter being available
- **Prerequisites**: Service layer filter (step 3)

#### 5. Suggestions API Enhancement
- **Technical Reason**: Depends on type definitions for predefined values
- **Prerequisites**: Type definitions (step 1)
- **Dependent Elements**: Editor UI (step 6)

#### 6. Editor UI Dropdowns
- **Technical Reason**: Depends on suggestions API returning merged values
- **Prerequisites**: Suggestions API enhancement (step 5)

### Integration Points

**Integration Point 1: Shared Types Export**
- Components: `packages/shared/src/types/game-object.ts` -> `packages/shared/src/index.ts`
- Verification: `pnpm nx typecheck game` passes; types are importable from `@nookstead/shared`

**Integration Point 2: Service -> API**
- Components: `listGameObjects` (service) -> `GET /api/objects` (route)
- Verification: `GET /api/objects?category=interior` returns filtered results (manual test or unit test)

**Integration Point 3: Shared Types -> Suggestions API**
- Components: `@nookstead/shared` -> `GET /api/objects/suggestions`
- Verification: `GET /api/objects/suggestions?field=category` returns predefined values even with empty DB

**Integration Point 4: Suggestions API -> Editor UI**
- Components: `GET /api/objects/suggestions` -> Editor dropdown component
- Verification: Editor shows grouped dropdown with "Predefined" and "From existing objects" sections

### Migration Strategy

No migration is needed. The database schema is unchanged, and there is no existing data to migrate. All changes are code-level additions and modifications.

---

## Detailed Implementation

### File 1: `packages/shared/src/types/game-object.ts` (NEW)

Create the file exactly as specified in ADR-0011 Decision 1. The full content is in the [Contract Definitions](#contract-definitions) section above.

### File 2: `packages/shared/src/index.ts` (MODIFY)

Add exports for the new game object types:

```typescript
// After existing fence type exports, add:

// Game object classification types (from types/game-object.ts)
export {
  GAME_OBJECT_CATEGORIES,
  GAME_OBJECT_TYPES,
  isGameObjectCategory,
  isGameObjectType,
  getAllGameObjectTypes,
} from './types/game-object';
export type {
  GameObjectCategory,
  GameObjectType,
} from './types/game-object';
```

### File 3: `packages/db/src/services/game-object.ts` (MODIFY)

Add filter params to `listGameObjects`:

```typescript
// Before (line 45-60):
export async function listGameObjects(
  db: DrizzleClient,
  params?: { limit?: number; offset?: number }
) {
  const query = db
    .select()
    .from(gameObjects)
    .orderBy(desc(gameObjects.createdAt));
  if (params?.limit !== undefined) {
    query.limit(params.limit);
  }
  if (params?.offset !== undefined) {
    query.offset(params.offset);
  }
  return query;
}

// After:
export async function listGameObjects(
  db: DrizzleClient,
  params?: {
    limit?: number;
    offset?: number;
    category?: string;
    objectType?: string;
  }
) {
  const conditions = [];
  if (params?.category !== undefined) {
    conditions.push(eq(gameObjects.category, params.category));
  }
  if (params?.objectType !== undefined) {
    conditions.push(eq(gameObjects.objectType, params.objectType));
  }

  const query = db
    .select()
    .from(gameObjects)
    .orderBy(desc(gameObjects.createdAt));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }
  if (params?.limit !== undefined) {
    query.limit(params.limit);
  }
  if (params?.offset !== undefined) {
    query.offset(params.offset);
  }
  return query;
}
```

Note: `and` must be added to the import from `drizzle-orm`:

```typescript
import { eq, desc, inArray, sql, and } from 'drizzle-orm';
```

### File 4: `apps/genmap/src/app/api/objects/route.ts` (MODIFY)

Add `category` and `objectType` query param parsing to the GET handler:

```typescript
// After existing limit/offset parsing, add:

const categoryParam = searchParams.get('category');
const objectTypeParam = searchParams.get('objectType');

const params: {
  limit?: number;
  offset?: number;
  category?: string;
  objectType?: string;
} = {};

// ... existing limit/offset parsing ...

if (categoryParam !== null && categoryParam.trim() !== '') {
  params.category = categoryParam.trim().toLowerCase();
}

if (objectTypeParam !== null && objectTypeParam.trim() !== '') {
  params.objectType = objectTypeParam.trim().toLowerCase();
}
```

Add non-standard value warning to the POST handler (after successful creation):

```typescript
// After createGameObject call succeeds:
if (
  obj.category &&
  !isGameObjectCategory(obj.category)
) {
  console.warn('Non-standard game object category used', {
    category: obj.category,
    objectId: obj.id,
  });
}
if (
  obj.objectType &&
  obj.category &&
  isGameObjectCategory(obj.category) &&
  !isGameObjectType(obj.category, obj.objectType)
) {
  console.warn('Non-standard game object type used', {
    objectType: obj.objectType,
    category: obj.category,
    objectId: obj.id,
  });
}
```

Import from `@nookstead/shared`:

```typescript
import { isGameObjectCategory, isGameObjectType } from '@nookstead/shared';
```

### File 5: `apps/genmap/src/app/api/objects/suggestions/route.ts` (MODIFY)

Replace the current implementation to merge predefined values:

```typescript
// Before:
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDistinctValues } from '@nookstead/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const field = searchParams.get('field');

  if (field !== 'category' && field !== 'objectType') {
    return NextResponse.json(
      { error: 'field must be "category" or "objectType"' },
      { status: 400 }
    );
  }

  const db = getDb();
  const values = await getDistinctValues(db, field);
  return NextResponse.json(values);
}

// After:
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDistinctValues } from '@nookstead/db';
import {
  GAME_OBJECT_CATEGORIES,
  GAME_OBJECT_TYPES,
  isGameObjectCategory,
} from '@nookstead/shared';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const field = searchParams.get('field');

  if (field !== 'category' && field !== 'objectType') {
    return NextResponse.json(
      { error: 'field must be "category" or "objectType"' },
      { status: 400 }
    );
  }

  const db = getDb();
  const dbValues = await getDistinctValues(db, field);

  let predefined: readonly string[];

  if (field === 'category') {
    predefined = GAME_OBJECT_CATEGORIES;
  } else {
    // For objectType, optionally scope to a specific category
    const category = searchParams.get('category');
    if (category && isGameObjectCategory(category)) {
      predefined = GAME_OBJECT_TYPES[category];
    } else {
      // No valid category context: return all known types
      predefined = Object.values(GAME_OBJECT_TYPES).flat();
    }
  }

  // Merge: predefined first, then DB-only values
  const predefinedSet = new Set(predefined);
  const dbOnly = dbValues.filter((v) => !predefinedSet.has(v));
  const merged = [...predefined, ...dbOnly];

  return NextResponse.json(merged);
}
```

### File 6: Editor Pages -- Dropdown Enhancement

Both `apps/genmap/src/app/(app)/objects/new/page.tsx` and `apps/genmap/src/app/(app)/objects/[id]/page.tsx` need identical changes to their category/objectType input sections. The current free-text `<Input>` with simple suggestion popup is replaced with a grouped dropdown.

**Change to suggestions fetch (both pages):**

```typescript
// Before:
useEffect(() => {
  fetch('/api/objects/suggestions?field=category')
    .then((r) => r.json())
    .then(setCategorySuggestions)
    .catch(() => {});
  fetch('/api/objects/suggestions?field=objectType')
    .then((r) => r.json())
    .then(setTypeSuggestions)
    .catch(() => {});
}, []);

// After:
useEffect(() => {
  fetch('/api/objects/suggestions?field=category')
    .then((r) => r.json())
    .then(setCategorySuggestions)
    .catch(() => {});
}, []);

// Refetch objectType suggestions when category changes
useEffect(() => {
  const categoryValue = editor.category.trim();
  const url = categoryValue
    ? `/api/objects/suggestions?field=objectType&category=${encodeURIComponent(categoryValue)}`
    : '/api/objects/suggestions?field=objectType';
  fetch(url)
    .then((r) => r.json())
    .then(setTypeSuggestions)
    .catch(() => {});
}, [editor.category]);
```

**Change to dropdown rendering (both pages):**

The existing suggestion dropdowns already show a list of suggestions filtered by the current input value. The key enhancement is that the suggestions API now returns predefined values first, so the dropdown naturally shows them at the top. The existing UI pattern (focus to open, blur to close, onMouseDown to select) is preserved.

The placeholder text is updated to reflect predefined values:

```typescript
// Category input placeholder change:
placeholder="e.g., building, decoration..."
// becomes:
placeholder="Select or type category..."

// Type input placeholder change:
placeholder="e.g., static, interactive..."
// becomes:
placeholder="Select or type object type..."
```

No structural changes to the dropdown JSX are needed because the suggestions API now returns the correctly ordered merged list.

### File 7: CollisionZone Consolidation

**`apps/genmap/src/hooks/use-object-editor.ts`:**

Remove the local `CollisionZone` interface (lines 8-17) and import from `@nookstead/db`:

```typescript
// Before (line 1-17):
'use client';

import { useState, useCallback } from 'react';
import type { FramePickerFrame } from '@/components/atlas-frame-picker';
import type { FrameLayer } from '@/components/object-grid-canvas';
import type { LayerPreviewData } from '@/components/object-preview';

export interface CollisionZone {
  id: string;
  label: string;
  type: 'collision' | 'walkable';
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

// After:
'use client';

import { useState, useCallback } from 'react';
import type { CollisionZone } from '@nookstead/db';
import type { FramePickerFrame } from '@/components/atlas-frame-picker';
import type { FrameLayer } from '@/components/object-grid-canvas';
import type { LayerPreviewData } from '@/components/object-preview';
```

The `export` on `CollisionZone` is removed from this file. The `[id]/page.tsx` file already imports `CollisionZone` from `use-object-editor.ts` -- this import must change to import from `@nookstead/db` directly:

```typescript
// In [id]/page.tsx, change:
import { useObjectEditor, type CollisionZone } from '@/hooks/use-object-editor';
// To:
import { useObjectEditor } from '@/hooks/use-object-editor';
import type { CollisionZone } from '@nookstead/db';
```

**`apps/genmap/src/components/map-editor/game-objects-panel.tsx`:**

Remove the local `CollisionZone` interface (lines 26-35) and import from `@nookstead/db`:

```typescript
// Before (lines 26-35):
interface CollisionZone {
  id: string;
  label: string;
  type: 'collision' | 'walkable';
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

// After: remove entirely, add import at top:
import type { CollisionZone } from '@nookstead/db';
```

The `GameObjectLayer` interface in this file (lines 18-24) is also duplicated from `@nookstead/db` schema, but this is out of scope for this design -- it can be consolidated in a future cleanup.

---

## Test Strategy

### Basic Test Design Policy

Tests are derived directly from acceptance criteria. Each AC maps to at least one test case.

### Unit Tests

**Type definitions (AC1):**
- Test `isGameObjectCategory` returns `true` for each of the 4 predefined categories
- Test `isGameObjectCategory` returns `false` for non-predefined strings
- Test `isGameObjectType('interior', 'furniture')` returns `true`
- Test `isGameObjectType('interior', 'custom_thing')` returns `false`
- Test `getAllGameObjectTypes()` returns a flat array of all object types across all categories
- Test `GAME_OBJECT_CATEGORIES` has exactly 4 entries
- Compile-time test: verify `satisfies` constraint catches missing category entries (this is verified by the TypeScript compiler, not a runtime test)

**Service layer filtering (AC2):**
- Test `listGameObjects(db, { category: 'interior' })` applies `WHERE category = 'interior'`
- Test `listGameObjects(db, { objectType: 'furniture' })` applies `WHERE object_type = 'furniture'`
- Test `listGameObjects(db, { category: 'interior', objectType: 'furniture' })` applies both WHERE clauses with AND
- Test `listGameObjects(db)` returns all objects (no WHERE clause)
- Test `listGameObjects(db, { limit: 10 })` still works (backward compatible)

### Integration Tests

**API route filtering (AC3):**
- Test `GET /api/objects?category=interior` returns filtered results
- Test `GET /api/objects?category=interior&objectType=furniture` applies both filters
- Test `GET /api/objects` without filters returns all (backward compatible)

**Suggestions API merge (AC4):**
- Test `GET /api/objects/suggestions?field=category` returns predefined categories even with empty DB
- Test `GET /api/objects/suggestions?field=category` with DB values returns predefined first, then DB-only
- Test `GET /api/objects/suggestions?field=objectType&category=interior` returns interior types
- Test `GET /api/objects/suggestions?field=objectType` without category returns all types
- Test no duplicates in response

### E2E Tests

**Editor dropdown (AC5):**
- E2E test not required for internal editor tool -- manual verification is sufficient
- The existing Playwright E2E setup (`apps/game-e2e`) tests the game client, not the genmap editor

### Performance Tests

Not required. The changes add simple WHERE clauses and small array merges on datasets expected to be under 10K objects.

---

## Security Considerations

- **No new attack surface**: The category/objectType filter params are plain strings passed to parameterized Drizzle ORM queries (SQL injection safe)
- **No authentication changes**: The genmap editor is an internal tool with no public-facing authentication
- **No sensitive data**: Category and objectType values are non-sensitive game design metadata

## Future Extensibility

1. **Hard enforcement**: If the kill criteria in ADR-0011 are met (>30% custom values), the soft enforcement can be upgraded to hard enforcement by adding validation in the API route. No type or schema changes needed.
2. **Category metadata**: A future ADR could add a `GAME_OBJECT_CATEGORY_META` map with display names, icons, and colors for each category, used by the editor UI.
3. **Game client usage**: When the Phaser game client implements object placement validation (e.g., "only furniture in interior zones"), it can import `isGameObjectCategory` and `isGameObjectType` from `@nookstead/shared`.
4. **Subcategory support**: If the `public` category needs subdivision (e.g., "civic", "commercial"), the `GAME_OBJECT_TYPES` structure already supports this -- just add entries under `public`.

## Alternative Solutions

### Alternative 1: Create a reusable `SearchableDropdown` component

- **Overview**: Extract the dropdown logic into a shared component used by both editor pages
- **Advantages**: Eliminates code duplication between new and edit pages; reusable for future dropdowns
- **Disadvantages**: Adds a new component file; the dropdown logic is relatively simple and tightly coupled to the suggestion fetch pattern
- **Reason for Deferral**: The current inline approach matches the existing codebase pattern. A shared component can be extracted later when a third dropdown use case appears (Rule of Three).

### Alternative 2: Add `category` filter to `getDistinctValues` at the service level

- **Overview**: Add a `category` filter param to `getDistinctValues` so the DB query itself filters objectType by category
- **Advantages**: More efficient DB query when category context is known
- **Disadvantages**: Overcomplicates the service function for a marginal optimization; the full distinct values list is small
- **Reason for Deferral**: The predefined values are merged in the API layer, and DB distinct values are already a small set. Filtering at the DB level adds complexity without measurable benefit.

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Predefined categories do not match actual usage | Low | Low | Kill criteria (>30% custom values) triggers review; soft enforcement means no blocking |
| Developer forgets to update shared types when GDD evolves | Low | Medium | Warning logs detect drift; periodic review of warning log frequency |
| CollisionZone import change breaks downstream types | Low | Low | Interface is identical; only import path changes; TypeScript compiler catches any mismatch |
| Suggestions API latency increase from DB + merge | Low | Low | DB query is already present; merge is O(n) on small arrays (<50 values) |

## References

- [TypeScript `as const` Assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions) -- Official TypeScript documentation for const assertions
- [TypeScript `satisfies` Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator) -- Official TypeScript documentation for the `satisfies` keyword
- [Drizzle ORM `and` operator](https://orm.drizzle.team/docs/operators#and) -- Combining multiple WHERE conditions
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) -- App Router API route patterns

## Update History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-21 | 1.0 | Initial version | AI |
