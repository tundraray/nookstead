# ADR-0011: Autotile Routing Architecture -- Graph-Based BFS Replacement

## Status

Accepted

## Context

The map editor's autotile system determines which tileset spritesheet and which Blob-47 frame to render for every cell on the map, based on its material and its neighbors' materials. The current implementation (ADR-0010, `autotile-layers.ts`) uses a **dominant-neighbor** pipeline:

1. `computeNeighborMaskByMaterial` -- direct string comparison for the 8-bit mask.
2. `findDominantNeighbor` -- pick the most-common foreign material among neighbors.
3. Forward/reverse pair lookup in `buildTilesetPairMap` ("from:to" -> tilesetKey).
4. `findIndirectTileset` -- a single-hop intermediate search when no direct pair exists.
5. Fallback to `baseTilesetKey`.

This approach works for simple material graphs (grass-water, water-deep_water) but has structural limitations:

- **1-hop limit**: `findIndirectTileset` only searches one intermediate material. If three or more hops are needed (e.g., deep_water -> water -> sand -> desert), the system falls back to the base tileset, producing a visually incorrect hard cut.
- **Non-deterministic tie-breaking**: `findDominantNeighbor` breaks ties by iteration order, producing different results depending on material map arrangement.
- **No edge ownership model**: When two cells share a border, both independently resolve their tileset. There is no coordinated decision about which cell "owns" the transition, leading to visual seam inconsistencies when materials have asymmetric priority relationships (e.g., water should always be the "background" when adjacent to land).
- **One-transition-per-cell ceiling**: Each cell can only show a single transition (toward the dominant neighbor). Cells at three-way material junctions get simplified to a two-material transition, with the minority neighbor ignored.
- **Monolithic recompute**: `recomputeAutotileLayers` processes all layers for each recalc cell, mixing tileset resolution, mask computation, and frame lookup in a single 350-line function. The command system (`applyDeltas`, `PaintCommand`, `FillCommand`) is tightly coupled to this monolithic recompute.

The project needs an architecture that can route through an arbitrary material compatibility graph, coordinate edge ownership between cells, and handle conflict resolution when the one-layer constraint (one tileset per cell) is violated.

## Decision

### Decision 1: Replace Current Dominant-Neighbor Pipeline

| Item | Content |
|------|---------|
| **Decision** | Full replacement of the current dominant-neighbor pipeline (`recomputeAutotileLayers`, `findDominantNeighbor`, `findIndirectTileset`, `buildTilesetPairMap`) with a graph-based BFS routing system. |
| **Why now** | The current 1-hop indirect resolution cannot scale to material graphs with 3+ hops between distant materials. As more biome materials are added (deep_water, water, sand, grass, forest, mountain, etc.), the number of unreachable pairs grows combinatorially. |
| **Why this** | A graph-based BFS router naturally extends to N-hop paths without additional special-case code. The dominant-neighbor approach is fundamentally a greedy local heuristic; replacing it with shortest-path routing provides optimal transitions. |
| **Known unknowns** | Whether the BFS overhead for large maps (256x256) stays within the 16ms frame budget when many cells are dirty simultaneously (e.g., large flood fill). |
| **Kill criteria** | If BFS routing for a full-map repaint (65,536 cells) exceeds 100ms on a mid-range laptop, the approach needs caching or incremental optimization beyond dirty-cell sets. |

### Decision 2: Replace Command System with RetileEngine Integration

| Item | Content |
|------|---------|
| **Decision** | Replace `applyDeltas` / `PaintCommand` / `FillCommand` with a new command system integrated with an incremental `RetileEngine` that manages dirty-cell recomputation. |
| **Why now** | Current commands directly mutate grid copies and trigger the monolithic `recomputeAutotileLayers`. The new routing pipeline requires per-cell incremental recomputation with dirty propagation to neighbors. |
| **Why this** | A dedicated `RetileEngine` encapsulates the dirty-cell tracking, BFS routing, edge resolution, and tileset selection into a single cohesive module. Commands become thin wrappers that mark cells dirty and delegate recomputation to the engine. |
| **Known unknowns** | The optimal dirty propagation radius -- whether 1-ring (8 neighbors) is always sufficient or whether multi-hop routing changes can cascade further. |
| **Kill criteria** | If the RetileEngine requires more than 3 rounds of dirty propagation per paint stroke to stabilize, the incremental approach is not converging fast enough and batch recompute should be reconsidered. |

### Decision 3: Explicit fromMaterialKey / toMaterialKey on TilesetInfo

| Item | Content |
|------|---------|
| **Decision** | Require explicit `fromMaterialKey` AND `toMaterialKey` fields on `TilesetInfo` for any tileset that participates in the routing graph. No name-parsing fallback. |
| **Why now** | The routing graph is built from tileset edges. Ambiguous or missing edge data produces incorrect routes. |
| **Why this** | Explicit fields are unambiguous and already stored in the database (`tilesets` table with `from_material_id` and `to_material_id` foreign keys). Name parsing (e.g., extracting "water" and "grass" from "water_grass") is fragile for multi-word material names like "deep-water" or "dark-sand". |
| **Known unknowns** | Whether existing standalone tilesets (only `fromMaterialKey`, no `toMaterialKey`) need migration or can simply be excluded from routing. |
| **Kill criteria** | If more than 20% of existing tilesets lack the required fields after a data audit, the migration effort outweighs the benefit and a hybrid approach with fallback parsing should be reconsidered. |

### Decision 4: One-Layer Constraint (Single Tileset Per Cell)

| Item | Content |
|------|---------|
| **Decision** | Each cell uses exactly one tileset at render time. No multi-layer blending of overlapping transition tilesets. |
| **Why now** | The renderer and the existing Blob-47 frame system are designed around a single frame index per cell per layer. Multi-layer blending would require a fundamentally different rendering pipeline. |
| **Why this** | The single-layer constraint matches the existing `EditorLayer.frames[y][x]` and `EditorLayer.tilesetKeys[y][x]` parallel array structure. It keeps the rendering pipeline simple and the autotile frame count at 47 per tileset. |
| **Known unknowns** | Whether single-tileset-per-cell produces acceptable visual quality at three-way material junctions, or whether artists will need to create dedicated junction tilesets. |
| **Kill criteria** | If artists report that more than 30% of material boundaries look visually broken due to the one-tileset constraint, multi-layer blending should be re-evaluated. |

### Decision 5: Per-Edge Ownership with Configurable Priority Presets

| Item | Content |
|------|---------|
| **Decision** | Introduce a per-edge ownership model with two configurable priority presets: Preset A (water-side-owns) and Preset B (land-side-owns). |
| **Why now** | Without coordinated edge ownership, two cells sharing a border independently pick their tileset, potentially selecting conflicting transition tilesets that create a visible seam. |
| **Why this** | Per-edge ownership makes the seam deterministic. Configurable presets allow the art team to experiment with which visual style (water bleeding into land vs. land bleeding into water) produces better results. |
| **Known unknowns** | Whether two presets are sufficient or whether per-material-pair ownership overrides will be needed. |
| **Kill criteria** | If neither preset produces acceptable results for more than 2 material pairs, per-pair overrides must be added to the ownership model. |

### Decision 6: Two-Strategy Conflict Resolution

| Item | Content |
|------|---------|
| **Decision** | When the one-layer constraint causes a conflict (cell borders multiple different materials and cannot satisfy all edges with a single tileset), apply Strategy S1 (owner reassign with max iterations) first, then fall back to Strategy S2 (BG priority-based tileset selection). |
| **Why now** | The one-layer constraint means a cell at a three-way junction must pick one tileset. Without explicit conflict resolution, the result depends on processing order. |
| **Why this** | S1 attempts to redistribute edge ownership to neighboring cells that can accommodate the transition. S2 provides a deterministic fallback when redistribution fails: the cell selects the tileset for the background material (lowest priority), and higher-priority materials "paint on top" visually. |
| **Known unknowns** | The optimal max iteration count for S1 and whether it always converges. |
| **Kill criteria** | If S1 fails to converge within 4 iterations for more than 5% of cells on a test map, S1 should be simplified or removed in favor of S2-only resolution. |

## Rationale

### Options Considered

#### Decision 1: Tileset Resolution Strategy

1. **Extend Current Dominant-Neighbor with Multi-Hop**
   - Overview: Keep the existing `findIndirectTileset` approach but extend it to search N hops deep by iterating through intermediate materials recursively.
   - Pros: Minimal code change, builds on existing tested code, no new data structures required.
   - Cons: Recursive search without a graph structure is exponential in hop count. No guarantee of finding the shortest path. Difficult to detect cycles (e.g., material A -> B -> C -> A). `findDominantNeighbor` tie-breaking issues remain unsolved.
   - Effort: 2 days

2. **Weighted Dijkstra on Material Graph**
   - Overview: Build a weighted graph where each edge is a tileset with a cost (e.g., visual quality score), and use Dijkstra's algorithm to find the minimum-cost path between any two materials.
   - Pros: Optimal path when costs vary, well-understood algorithm, handles weighted preferences (e.g., prefer "water_grass" over "mud_grass").
   - Cons: Costs are not naturally defined -- all tilesets are equally valid transitions. Overhead of priority queue is unnecessary for unweighted graphs. More complex implementation for no practical benefit given uniform edge weights.
   - Effort: 4 days

3. **BFS on Unweighted Material Compatibility Graph (Selected)**
   - Overview: Build an adjacency graph from `TilesetInfo` entries where each node is a material and each edge is a tileset with `fromMaterialKey` and `toMaterialKey`. Use BFS to find the shortest path between any two materials. Cache the full shortest-path table (Floyd-Warshall or all-pairs BFS) at graph construction time.
   - Pros: Shortest path guaranteed. O(V+E) per query (or O(1) with precomputed table). Cycle-proof by BFS nature. Simple implementation. Unweighted graph matches the domain -- all tilesets are equally valid.
   - Cons: Requires precomputed routing table (memory: O(V^2) where V = number of materials, typically < 20). Graph must be rebuilt when tilesets change (rare during editing sessions).
   - Effort: 3 days

#### Comparison: Tileset Resolution Strategy

| Criterion | Extend Dominant-Neighbor | Weighted Dijkstra | BFS Graph (Selected) |
|---|---|---|---|
| Multi-hop support | Fragile (recursive) | Yes (optimal weighted) | Yes (optimal unweighted) |
| Cycle safety | No (must add detection) | Yes (by algorithm) | Yes (by algorithm) |
| Path optimality | Not guaranteed | Optimal (weighted) | Optimal (shortest hop) |
| Implementation complexity | Low | High | Medium |
| Runtime per query | O(T^N) worst case | O((V+E) log V) | O(1) with precomputed table |
| Domain fit | Poor (heuristic) | Over-engineered | Natural fit |

#### Decision 2: Command System Integration

1. **Patch Existing Commands to Call New Router**
   - Overview: Keep `applyDeltas`, `PaintCommand`, `FillCommand` as-is but replace the `recomputeAutotileLayers` call with a new routing function.
   - Pros: Minimal changes to command interface, existing undo/redo preserved exactly.
   - Cons: `applyDeltas` still mixes grid mutation, frame application, and recompute triggering. Dirty-cell tracking must be bolted onto the existing function. Debug logging interleaved with business logic persists.
   - Effort: 2 days

2. **New Command Classes with Shared RetileEngine**
   - Overview: New `RoutingPaintCommand` and `RoutingFillCommand` classes that apply terrain deltas and delegate all recomputation to a `RetileEngine.retile(dirtyCells)` method. The engine handles dirty propagation, graph routing, edge resolution, and frame computation.
   - Pros: Single responsibility for each component. Engine is independently testable. Commands are thin and predictable. Debug logging moves to engine hooks.
   - Cons: Breaking change to command interface (existing `PaintCommand`/`FillCommand` removed). All consumers of `applyDeltas` must migrate.
   - Effort: 3 days

3. **Event-Driven Pipeline with Command Bus (Selected Against)**
   - Overview: Commands emit events ("cells-painted"), subscribers handle routing, edge resolution, frame computation independently.
   - Pros: Maximum decoupling, easy to add new pipeline stages.
   - Cons: Over-engineered for a single-consumer system. Event ordering becomes critical. Harder to reason about undo/redo correctness. Debugging requires tracing through event handlers.
   - Effort: 5 days

**Selected: Option 2 -- New Command Classes with Shared RetileEngine.** The engine pattern provides clean separation without the indirection cost of event-driven architecture. Commands remain synchronous and deterministic, which is critical for undo/redo correctness.

#### Decision 3: Tileset Registry Data Source

1. **Name Parsing Fallback**
   - Overview: If `fromMaterialKey` or `toMaterialKey` is missing, parse the tileset name (e.g., "water_grass") to extract material identifiers.
   - Pros: Backward compatible with older tileset data. No migration required.
   - Cons: Fragile for multi-word names ("deep-water_dark-sand" is ambiguous). Underscore could be part of the material name or the separator. Non-deterministic parsing.
   - Effort: 1 day

2. **Explicit Fields Required, Missing Tilesets Excluded from Graph (Selected)**
   - Overview: Only tilesets with both `fromMaterialKey` and `toMaterialKey` participate in the routing graph. Standalone tilesets (only `fromMaterialKey`) serve as base tilesets but are not graph edges.
   - Pros: Unambiguous graph construction. DB already stores these fields. Validation can flag missing fields at load time.
   - Cons: Requires all transition tilesets to have both fields populated. Data audit needed.
   - Effort: 1 day

3. **Configuration File Mapping**
   - Overview: Maintain a separate JSON/YAML configuration file that maps tileset keys to material pairs, independent of `TilesetInfo` fields.
   - Pros: Decoupled from DB schema. Easy to edit without DB migration.
   - Cons: Second source of truth for material relationships. Sync issues between config and DB. Additional file to maintain.
   - Effort: 2 days

#### Decision 4: Layer Model

1. **Multi-Layer Blending (One Tileset Per Layer, Stack Layers)**
   - Overview: Each transition gets its own render layer. A cell at a grass-water-sand junction would have three layers stacked with alpha blending.
   - Pros: Visually richer transitions. Each material pair rendered independently. No conflict resolution needed.
   - Cons: Layer count grows with material adjacency complexity (O(material pairs) layers in worst case). Renderer must composite multiple layers per cell. Breaks existing `EditorLayer` model. Major rendering pipeline rewrite.
   - Effort: 10+ days

2. **Single Tileset Per Cell, One Render Layer (Selected)**
   - Overview: Each cell picks exactly one tileset. The frame within that tileset encodes the transition shape. Conflicts at multi-material junctions are resolved by priority.
   - Pros: Matches existing renderer. No layer explosion. Simple, predictable output. Existing frame table (47 Blob masks) is sufficient.
   - Cons: Visual limitation at three-way junctions. May require dedicated junction tilesets for complex cases.
   - Effort: 0 days (existing model)

3. **Deferred Multi-Pass Rendering**
   - Overview: Single layer in data, but render each cell in multiple passes with stencil/clip masking per transition direction.
   - Pros: Richer visuals without data model changes. Each direction rendered independently.
   - Cons: Requires WebGL or canvas stencil support. 2-4x render cost per cell. Blob-47 frame model no longer applies (each direction is a separate mask).
   - Effort: 8+ days

#### Decision 5: Edge Ownership Model

1. **No Edge Ownership (Current Approach)**
   - Overview: Each cell independently resolves its tileset based on its own material and neighbors. No coordination between adjacent cells.
   - Pros: Simple. No inter-cell communication during resolve.
   - Cons: Seam artifacts when two cells pick different tilesets for the same border. Non-deterministic visual output.
   - Effort: 0 days

2. **Global Priority-Based Ownership**
   - Overview: Every material has a global priority number. At any border, the lower-priority material always "owns" the edge (its cell uses the transition tileset).
   - Pros: Deterministic. Simple to implement. Single configuration value per material.
   - Cons: Inflexible -- the same priority ordering applies everywhere. Cannot have water own edges against sand but sand own edges against grass.
   - Effort: 1 day

3. **Per-Edge Ownership with Configurable Presets (Selected)**
   - Overview: Edge ownership is determined per-edge using a configurable strategy. Two presets ship initially: Preset A (lower-priority material owns = "water side owns") and Preset B (higher-priority material owns = "land side owns"). Per-material-pair overrides can be added later.
   - Pros: Flexible. Art team can experiment. Deterministic within a preset. Extensible to per-pair overrides without architecture change.
   - Cons: More complex than global priority. Presets must be tested with all material combinations.
   - Effort: 2 days

#### Decision 6: Conflict Resolution at Multi-Material Junctions

1. **Ignore Conflicts (Current Approach)**
   - Overview: Cell picks dominant neighbor, ignores minority neighbors. Visual artifacts accepted.
   - Pros: Simple. Fast.
   - Cons: Visible artifacts at three-way junctions. Non-deterministic when dominance is tied.
   - Effort: 0 days

2. **S1-Only: Edge Reassignment**
   - Overview: When a cell cannot satisfy all edges with one tileset, reassign conflicting edges to neighboring cells. Iterate until stable or max iterations reached.
   - Pros: Can resolve many conflicts. Produces locally optimal assignments.
   - Cons: May not converge. Cascading reassignments can ripple across the map. No fallback if convergence fails.
   - Effort: 3 days

3. **S2-Only: BG Priority Fallback**
   - Overview: At a conflict, the cell always selects the tileset for the lowest-priority (background) material pair. Higher-priority materials are expected to visually override.
   - Pros: Always deterministic. O(1) resolution. No iteration.
   - Cons: Produces suboptimal visual results when the background material is not the best visual choice. No attempt at finding a better assignment.
   - Effort: 1 day

4. **S1 then S2 Cascade (Selected)**
   - Overview: Try S1 (edge reassignment, max 4 iterations) first. If S1 does not resolve the conflict, fall back to S2 (BG priority). This gives the system an opportunity to find the best local assignment while guaranteeing termination.
   - Pros: Best visual results when S1 succeeds. Guaranteed termination via S2 fallback. Bounded iteration count.
   - Cons: Most complex option. S1 adds processing time. Must be profiled for large dirty sets.
   - Effort: 4 days

## Consequences

### Positive Consequences

- **N-hop routing**: Any two materials connected by a chain of transition tilesets will produce a correct visual transition, regardless of path length. The routing table precomputes all shortest paths.
- **Deterministic edge ownership**: The configurable preset system eliminates seam artifacts caused by independent per-cell resolution. The art team can choose the visual style that best fits the game's aesthetic.
- **Modular architecture**: Six focused modules (TilesetRegistry, GraphBuilder, Router, EdgeResolver, CellTilesetSelector, RetileEngine) replace one monolithic function. Each module is independently testable with well-defined inputs and outputs.
- **Incremental recomputation**: The RetileEngine's dirty-cell approach avoids full-map rescans. Only painted cells and their neighbors are reprocessed.
- **Extensible conflict resolution**: The S1/S2 cascade pattern can accommodate additional strategies without changing the overall pipeline.

### Negative Consequences

- **Breaking changes**: `recomputeAutotileLayers`, `findDominantNeighbor`, `findIndirectTileset`, `buildTilesetPairMap`, `applyDeltas`, `PaintCommand`, and `FillCommand` are all removed. All consumers must migrate to the new API.
- **Increased module count**: The `packages/map-lib/src/core/` directory grows from approximately 8 files to approximately 14. Each new module is small and focused, but the surface area of the package increases.
- **Precomputed routing table memory**: The all-pairs shortest-path table for V materials requires O(V^2) storage. With V < 20 (typical), this is under 400 entries -- negligible. At V = 100 it reaches 10,000 entries, still small.
- **Edge ownership complexity**: The per-edge ownership model adds a coordination step that the current system does not have. This adds latency to the per-cell resolve, though the dirty-cell approach bounds the total work.

### Neutral Consequences

- **Blob-47 frame system unchanged**: The 47-frame autotile engine (`autotile.ts`), `getFrame()`, `gateDiagonals()`, and the bit constants (N, NE, E, SE, S, SW, W, NW) are retained without modification. The routing architecture changes which tileset is selected and how the mask is computed, but the final frame lookup remains the same.
- **`computeNeighborMaskByMaterial` retained**: The direct material string comparison mask function is still needed for same-material mask computation within the routing pipeline.
- **Renderer unchanged**: `canvas-renderer.ts` continues to read `layer.frames[y][x]` and `layer.tilesetKeys[y][x]` and render accordingly. The routing architecture only changes how those arrays are populated.

## Implementation Guidance

### Module Responsibilities (Principled)

- **TilesetRegistry**: Single source of truth for tileset and material data. All routing modules read from the registry; none directly access raw `TilesetInfo[]` arrays.
- **GraphBuilder**: Constructs the material compatibility graph from the registry. Edges represent transition tilesets. Graph is rebuilt only when the tileset set changes (not on every paint stroke).
- **Router**: Precomputes shortest paths between all material pairs using BFS. Exposes `getPath(fromMaterial, toMaterial): TilesetInfo[]` for any pair. Returns `null` for disconnected pairs.
- **EdgeResolver**: Determines which cell owns each edge at a material boundary. Uses the configured priority preset. Operates per-edge, not per-cell.
- **CellTilesetSelector**: Given a cell's material, its neighbors, and the resolved edge ownership, selects the single tileset and computes the Blob-47 frame. Handles conflict resolution (S1 then S2).
- **RetileEngine**: Orchestrates the full pipeline. Accepts dirty cells, expands to neighbor ring, invokes EdgeResolver and CellTilesetSelector for each, updates `frames` and `tilesetKeys` arrays. Returns new immutable layer state.

### Dependency Injection

- All new modules accept their dependencies as constructor/function parameters. No module imports from `@nookstead/db` or any React/UI package.
- The `RetileEngine` receives `TilesetRegistry`, `Router`, `EdgeResolver`, and `CellTilesetSelector` as injected dependencies. This allows unit testing each component independently with mock data.

### Immutability

- All state updates must return new arrays/objects. Input grid, layers, and material maps are never mutated. This preserves React state compatibility and undo/redo correctness.

### Backward Compatibility

- `computeNeighborMaskByMaterial` is retained in `neighbor-mask.ts` and continues to be exported from `map-lib/index.ts`.
- `computeTransitionMask` and `computeNeighborMask` may be deprecated but are not removed in this change, to avoid breaking external consumers.
- The `EditorCommand` interface is preserved; new command classes implement the same `execute(state)` / `undo(state)` contract.

### Performance Boundaries

- Graph construction (BFS all-pairs) runs once per tileset set change. For V=20 materials and E=30 edges, BFS completes in microseconds.
- Per-paint-stroke retiling targets: under 5ms for brush (1-9 cells dirty), under 50ms for flood fill (up to 10,000 cells dirty).
- The skip optimization for same-material SOLID cells should be preserved in the RetileEngine to avoid unnecessary recomputation.

### Testing Strategy

- Each module (TilesetRegistry, GraphBuilder, Router, EdgeResolver, CellTilesetSelector) should have dedicated unit tests with small hand-crafted material graphs.
- RetileEngine integration tests should use a 5x5 grid with 3-4 materials and verify the full pipeline from dirty cells to final frames/tilesetKeys.
- Regression tests should verify that the new system produces equivalent output to the old system for simple 2-material cases (grass/water).

```mermaid
graph TD
    subgraph "Current Architecture (Being Replaced)"
        A1[PaintCommand / FillCommand] --> A2[applyDeltas]
        A2 --> A3[recomputeAutotileLayers]
        A3 --> A4[findDominantNeighbor]
        A3 --> A5[buildTilesetPairMap]
        A3 --> A6[findIndirectTileset]
        A3 --> A7[computeNeighborMaskByMaterial]
        A3 --> A8[computeTransitionMask]
    end

    subgraph "New Architecture"
        B1[RoutingPaintCommand / RoutingFillCommand] --> B2[RetileEngine.retile]
        B2 --> B3[TilesetRegistry]
        B2 --> B4[Router]
        B2 --> B5[EdgeResolver]
        B2 --> B6[CellTilesetSelector]
        B4 --> B7[GraphBuilder]
        B7 --> B3
        B6 --> B8[computeNeighborMaskByMaterial]
        B6 --> B9[getFrame]
    end

    style A1 fill:#f99,stroke:#900
    style A2 fill:#f99,stroke:#900
    style A3 fill:#f99,stroke:#900
    style A4 fill:#f99,stroke:#900
    style A5 fill:#f99,stroke:#900
    style A6 fill:#f99,stroke:#900
    style B1 fill:#9f9,stroke:#090
    style B2 fill:#9f9,stroke:#090
    style B3 fill:#9f9,stroke:#090
    style B4 fill:#9f9,stroke:#090
    style B5 fill:#9f9,stroke:#090
    style B6 fill:#9f9,stroke:#090
    style B7 fill:#9f9,stroke:#090
```

```mermaid
graph LR
    subgraph "Material Compatibility Graph (Example)"
        DW[deep_water] -->|"dw-w tileset"| W[water]
        W -->|"w-s tileset"| S[sand]
        W -->|"w-g tileset"| G[grass]
        S -->|"s-g tileset"| G
        G -->|"g-f tileset"| F[forest]
    end

    subgraph "BFS Routing: deep_water -> grass"
        R1["deep_water"] -.->|"hop 1: dw-w"| R2["water"]
        R2 -.->|"hop 2: w-g"| R3["grass"]
    end
```

## Files Affected

### Removed / Rewritten

| File | Current Function | Disposition |
|------|-----------------|-------------|
| `packages/map-lib/src/core/autotile-layers.ts` | `recomputeAutotileLayers`, `findDominantNeighbor`, `findIndirectTileset`, `buildTilesetPairMap` | Complete rewrite; new modules replace all functions |
| `packages/map-lib/src/core/commands.ts` | `applyDeltas`, `PaintCommand`, `FillCommand` | Replaced by new command classes integrated with RetileEngine |

### Retained

| File | Function | Notes |
|------|----------|-------|
| `packages/map-lib/src/core/autotile.ts` | `getFrame`, `gateDiagonals`, bit constants, `FRAME_TABLE` | Unchanged; used by CellTilesetSelector |
| `packages/map-lib/src/core/neighbor-mask.ts` | `computeNeighborMaskByMaterial` | Retained; used by CellTilesetSelector. `computeTransitionMask` deprecated but not removed. |
| `packages/map-lib/src/types/editor-types.ts` | `EditorLayer`, `MapEditorState`, `CellDelta`, `EditorCommand` | Interface preserved; command implementations change |
| `packages/map-lib/src/types/material-types.ts` | `TilesetInfo`, `MaterialInfo` | Unchanged; consumed by TilesetRegistry |
| `apps/genmap/src/components/map-editor/canvas-renderer.ts` | `renderMapCanvas` | Unchanged; reads `frames` and `tilesetKeys` as before |

### New Modules

| Module | Location | Responsibility |
|--------|----------|---------------|
| TilesetRegistry | `packages/map-lib/src/core/tileset-registry.ts` | Tileset/material data access, validation |
| GraphBuilder | `packages/map-lib/src/core/graph-builder.ts` | Material compatibility graph construction |
| Router | `packages/map-lib/src/core/router.ts` | All-pairs shortest-path BFS, path queries |
| EdgeResolver | `packages/map-lib/src/core/edge-resolver.ts` | Per-edge ownership determination |
| CellTilesetSelector | `packages/map-lib/src/core/cell-tileset-selector.ts` | Per-cell tileset + frame selection, conflict resolution |
| RetileEngine | `packages/map-lib/src/core/retile-engine.ts` | Dirty-cell orchestration, pipeline coordinator |
| Routing types | `packages/map-lib/src/types/routing-types.ts` | Shared types for routing modules |

## Related Information

- [ADR-0010 / ADR-0010-map-lib-algorithm-extraction.md](ADR-0010-map-lib-algorithm-extraction.md) -- Established the current autotile pipeline and material resolver architecture being superseded
- [ADR-0009 / ADR-0009-tileset-management-architecture.md](ADR-0009-tileset-management-architecture.md) -- Database-driven tilesets with `fromMaterialId` / `toMaterialId` foreign keys
- [ADR-0006 / adr-006-map-editor-architecture.md](adr-006-map-editor-architecture.md) -- Three-package architecture and zero-build pattern
- [docs/autotile-transition-mechanics.md](../autotile-transition-mechanics.md) -- Current dominant-neighbor algorithm documentation (superseded by this ADR)
- [docs/design/autotile-system-reference.md](../design/autotile-system-reference.md) -- Comprehensive reference of the current Blob-47 autotile system

## References

- [Tile/Map-Based Game Techniques: Handling Terrain Transitions (GameDev.net)](https://www.gamedev.net/articles/programming/general-and-gameplay-programming/tilemap-based-game-techniques-handling-terrai-r934/) - Foundational article on terrain transition mechanics in tile-based games
- [Breadth First Search - Algorithms for Competitive Programming](https://cp-algorithms.com/graph/breadth-first-search.html) - BFS algorithm reference for shortest-path in unweighted graphs
- [Blob Tileset Article (cr31.co.uk)](https://web.archive.org/web/20230101000000*/cr31.co.uk/stagecast/wang/blob.html) - Blob-47 autotile algorithm reference
- [Autotiling Technique (Excalibur.js)](https://excaliburjs.com/blog/Autotiling%20Technique/) - Modern autotiling implementation patterns
- [Connecting Multiple Autotiles (Godot Forum)](https://forum.godotengine.org/t/connecting-multiple-autotiles/129928) - Discussion of multi-material autotile transition challenges
- [Amit's Game Programming Information](http://www-cs-students.stanford.edu/~amitp/gameprog.html) - Comprehensive game programming algorithms reference including pathfinding and tile grids

## Date

2026-02-22
