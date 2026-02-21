# ADR-0010: Map Algorithm Extraction to map-lib and Material-Based Painting Pipeline

## Status

Proposed

## Context

The map editor (`apps/genmap/`) has accumulated a substantial body of pure algorithmic code -- autotile neighbor computation, drawing algorithms (Bresenham line, flood fill), zone geometry, zone validation, and editor command infrastructure -- that is tightly coupled to the React/UI layer only through thin wrappers. This creates three problems:

1. **Untestable algorithms**: Pure functions like `computeNeighborMask`, `bresenhamLine`, `floodFill`, `rasterizePolygon`, and `validateAllZones` are embedded in app-specific files that import React types, `Dispatch`, and UI-specific interfaces (`ToolHandlers`, `PreviewRect`). Testing them requires mocking the entire editor environment.

2. **Divergent behavior**: The `computeBitmask` function in `transition-test-canvas.tsx` treats out-of-bounds cells as **not matching** (`return false`), while `computeNeighborMask` in `autotile-utils.ts` treats out-of-bounds as **matching** (`mask |= bit`). Both are correct for their use cases (isolated test canvas vs seamless map edges), but the divergence is undocumented and will cause subtle bugs if either is reused in the wrong context.

3. **Missing material pipeline**: The editor currently paints using terrain keys (e.g., `"terrain-03"`), which are low-level tileset identifiers. With the database-driven tileset/material system (ADR-0009), the user should paint with **materials** (e.g., "grass", "sand") and the system should automatically resolve which tilesets handle the transitions between adjacent materials, create/update the appropriate layers, and recompute autotile frames. The tilesets DB already stores `fromMaterialId` and `toMaterialId` foreign keys, but no resolution logic exists.

Additionally, `apps/game/src/game/scenes/Game.ts` contains inline Phaser stamp rendering logic (lines 52-69) that duplicates the `MapRenderer` class already available in `packages/map-renderer`. This is a straightforward code duplication that should be cleaned up as part of this effort.

The `packages/map-lib` package was created in ADR-0006 (Decision 1) with the explicit purpose of housing pure map algorithms. It currently contains only the Blob-47 autotile engine (`core/autotile.ts`) and type definitions. The algorithms listed above are natural additions to this package.

## Decision

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Extract all pure map algorithms from `apps/genmap/` into `packages/map-lib`, add a material-based painting resolution pipeline as a new module, and move the full `EditorLayer` type hierarchy to `map-lib/types/editor-types.ts`. |
| **Why now** | The map editor is about to gain material-based painting, which requires a `MaterialResolver` that composes multiple existing algorithms (neighbor mask, autotile recomputation, walkability). Building the resolver on top of scattered, UI-coupled code would deepen the coupling. Extracting first creates a clean foundation. |
| **Why this** | Moving pure algorithms to the shared library follows the architecture established in ADR-0006 (three-package split: map-lib for pure logic, map-renderer for Phaser). The material resolver is a new algorithm that depends on extracted functions and DB-sourced tileset/material data -- it belongs in map-lib, not in a UI component. |
| **Known unknowns** | Whether the `MaterialResolver` should cache the tileset transition lookup table or rebuild it on every paint operation. The answer depends on how frequently tilesets change during an editing session (likely: rarely, so caching is appropriate). |
| **Kill criteria** | If the extracted modules require more than 2 adapter types to bridge between map-lib and the genmap app (indicating the abstraction boundary is wrong), reconsider the extraction scope. |

## Rationale

### Options Considered

1. **No Extraction -- Keep Algorithms in genmap**
   - Overview: Leave all drawing, autotile, zone, and command code in `apps/genmap/`. Build the material resolver directly in the genmap hooks layer.
   - Pros: Zero refactoring effort, no cross-package import changes, all code co-located with its consumers, no risk of over-abstraction.
   - Cons: Pure algorithms remain untestable without mocking React dispatch and UI types. The divergent OOB behavior stays undocumented. The material resolver would depend on React-coupled code. `apps/game/` cannot reuse any of these algorithms (e.g., if the game client ever needs client-side autotile recomputation for predictive rendering). Continues to violate SRP by mixing pure logic with UI concerns.
   - Effort: 0 days (but ongoing maintenance cost)

2. **Partial Extraction -- Move Only Algorithms That Have Multiple Consumers**
   - Overview: Extract only code that is already needed by multiple apps (e.g., autotile computation, which is used by both genmap and the transition test canvas). Leave single-consumer code (flood fill, commands, zone validation) in genmap.
   - Pros: Smaller extraction scope, lower risk of over-abstraction, each extraction is justified by concrete multi-consumer need, reduces divergent OOB behavior for the most critical algorithm.
   - Cons: The "multiple consumers" criterion is too narrow today but will expand as the game client evolves. Leaves the material resolver building on top of a partially-extracted foundation, requiring the resolver to import from both map-lib and genmap hooks. Inconsistent boundary: some pure algorithms in map-lib, others in genmap, based on an accident of current usage rather than architectural principle.
   - Effort: 2 days

3. **Full Extraction with Material Pipeline (Selected)**
   - Overview: Extract all pure map algorithms into `packages/map-lib`. This includes: neighbor mask computation (with parameterized OOB behavior), autotile layer recomputation, walkability computation, drawing algorithms (Bresenham, flood fill, rectangle fill), editor commands (CellDelta, PaintCommand, FillCommand), zone geometry (bounds, polygon area, simple polygon check), and zone validation (rasterization, overlap detection). Add a new `MaterialResolver` module. Move `EditorLayer`, `TilesetInfo`, `MaterialInfo`, and related types to map-lib.
   - Pros: Clean separation of pure logic from UI concerns. All algorithms become independently testable with simple unit tests. Divergent OOB behavior is resolved by parameterizing `computeNeighborMask` with an `outOfBoundsMatches` option. Material resolver has a clean dependency graph (depends only on other map-lib modules). Game app can import any algorithm it needs. Consistent architectural boundary: map-lib = pure algorithms, genmap = UI integration.
   - Cons: Larger refactoring scope (more files to move, more imports to update). Risk of importing map-lib types that are genmap-specific (mitigated by keeping editor state and action types that reference React `Dispatch` in genmap). All genmap files that import from hooks/autotile-utils, hooks/map-editor-types, hooks/map-editor-commands, and tools/* must update imports.
   - Effort: 5 days

### Comparison

| Criterion | No Extraction | Partial Extraction | Full Extraction (Selected) |
|---|---|---|---|
| Algorithm testability | Poor (React deps) | Partial | Full (pure functions) |
| OOB divergence resolved | No | Partially | Yes (parameterized) |
| Material resolver foundation | Weak (UI-coupled) | Mixed | Clean (pure deps) |
| Future reuse by game app | None | Partial | Full |
| Import change scope | None | ~5 files | ~15 files |
| Architectural consistency | Violated | Inconsistent | Consistent |
| Implementation effort | 0 days | 2 days | 5 days |

### Decision

Full extraction selected. The core rationale is that every algorithm being extracted is a **pure function** -- it takes data in and returns data out with no side effects, no React state, no DOM access, no Phaser dependency. The current co-location with UI code is an accident of incremental development, not an architectural choice. Extracting creates a testable, reusable foundation that the new material resolver can cleanly build upon.

The parameterized `outOfBoundsMatches` option on `computeNeighborMask` resolves the documented divergence between the map editor (OOB = matching, for seamless edges) and the transition test canvas (OOB = not matching, for isolated tiles) without breaking either use case.

## Consequences

### Positive Consequences

- **Testability**: All extracted algorithms become unit-testable without any UI framework mocking. Tests can verify `bresenhamLine`, `floodFill`, `computeNeighborMask`, `rasterizePolygon`, etc., with simple grid inputs and expected outputs.
- **Single source of truth**: `EditorLayer`, `TilesetInfo`, `MaterialInfo`, and all pure map types live in one canonical location (`packages/map-lib/src/types/`). No more importing from `hooks/autotile-utils` or `hooks/map-editor-types` for type definitions.
- **Parameterized OOB behavior**: The `outOfBoundsMatches` parameter in `computeNeighborMask` makes the boundary behavior explicit and configurable, eliminating the silent divergence between the editor and transition test canvas.
- **Material resolver foundation**: The `MaterialResolver` module has a clean dependency graph: it composes `computeNeighborMask`, `recomputeAutotileLayers`, and `recomputeWalkability` from map-lib, plus tileset/material lookup data. No UI framework dependencies.
- **Game.ts cleanup**: Refactoring `Game.ts` to use `MapRenderer` removes code duplication and ensures rendering consistency between the game and editor.

### Negative Consequences

- **Breaking import changes**: Approximately 15 files in `apps/genmap/` must update their imports to point to `@nookstead/map-lib` instead of local hooks/tools files. This is a one-time cost with straightforward mechanical changes.
- **Increased map-lib surface area**: `packages/map-lib` grows from 3 source files to approximately 12. This is acceptable because all additions are pure algorithms that naturally belong together. The package remains focused on its stated responsibility: pure map data and algorithms.
- **EditorLayer coupling**: Moving `EditorLayer` to map-lib means that both genmap and any future consumer share the same type. If genmap needs editor-specific layer fields in the future, they must be added to the shared type (accepted trade-off per user decision: tight coupling, all consumers share the same type).

### Neutral Consequences

- **No runtime behavior change**: The extraction is a pure refactoring of existing code. All algorithms retain their current behavior. The only behavioral addition is the new `MaterialResolver` module.
- **Package dependency graph unchanged**: `apps/genmap/` already depends on `@nookstead/map-lib`. Adding more imports from the same package does not change the dependency topology.

## Implementation Guidance

- Follow the zero-build pattern established in ADR-0006 Decision 2 (direct TypeScript source exports, no `dist/` directory).
- Parameterize `computeNeighborMask` with `outOfBoundsMatches: boolean` (default `true` to preserve current editor behavior). The transition test canvas passes `false`.
- Keep UI-coupled tool creators (`createBrushTool`, `createFillTool`, `createRectangleTool`, `createEraserTool`) in `apps/genmap/`. These functions depend on React `Dispatch`, `ToolHandlers`, and `PreviewRect`. They import pure algorithms from `@nookstead/map-lib`.
- The `MaterialResolver` should accept tileset and material lookup data as constructor/function parameters (dependency injection), not import from `@nookstead/db` directly. This keeps map-lib free of database dependencies.
- `MapEditorState` and `MapEditorAction` types reference `EditorCommand`, `EditorLayer`, `TilesetInfo`, and `MaterialInfo` -- all of which move to map-lib. The state and action types themselves should also move to map-lib since they are pure data types with no React dependency (React `Dispatch<MapEditorAction>` is parameterized by the action type but does not require the action type to import React).
- Apply the same JSDoc documentation standards visible in the existing `core/autotile.ts` to all new modules.

## Related Information

- [ADR-0006 / adr-006-map-editor-architecture.md](adr-006-map-editor-architecture.md) -- Established the three-package architecture (map-lib, map-renderer, db) and zero-build pattern
- [ADR-0009 / ADR-0009-tileset-management-architecture.md](ADR-0009-tileset-management-architecture.md) -- Database-driven tilesets and materials with `fromMaterialId`/`toMaterialId` foreign keys
- [design-007-map-editor.md](../design/design-007-map-editor.md) -- Original map editor design document
- [design-011-tileset-management.md](../design/design-011-tileset-management.md) -- Tileset management design
- [design-013-map-lib-extraction.md](../design/design-013-map-lib-extraction.md) -- Companion Design Doc with implementation details

## References

- [Nx Blog: Managing TypeScript Packages in Monorepos](https://nx.dev/blog/managing-ts-packages-in-monorepos) - Zero-build TypeScript package patterns
- [Blob Tileset Article (cr31.co.uk)](https://web.archive.org/web/20230101000000*/cr31.co.uk/stagecast/wang/blob.html) - Blob-47 autotile algorithm reference
- [Bresenham's Line Algorithm (Wikipedia)](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm) - Standard line rasterization algorithm
- [Flood Fill Algorithm (Wikipedia)](https://en.wikipedia.org/wiki/Flood_fill) - BFS-based region fill algorithm

## Date

2026-02-21
