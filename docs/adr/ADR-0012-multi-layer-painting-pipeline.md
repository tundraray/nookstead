# ADR-0012: Multi-Layer Painting Pipeline

## Status

Proposed

## Context

The Nookstead genmap map editor supports multiple tile layers via `EditorLayer[]` and tracks which layer the user has selected via `MapEditorState.activeLayerIndex`. However, the current paint pipeline has two critical defects:

1. **activeLayerIndex is ignored during rendering.** The `writeToLayers()` method in `RetileEngine` (line 1125-1144 of `retile-engine.ts`) uses `.find()` to locate the FIRST non-object layer and writes all computed frame data there. This means brush, fill, rectangle, and eraser tools always modify `layer[0]` regardless of which layer the user selected.

2. **activeLayerIndex is not captured in commands.** `RoutingPaintCommand` and `RoutingFillCommand` (in `routing-commands.ts`) do not store the target layer index. Their `execute()` and `undo()` methods call `engine.applyMapPatch(state, patches)` without any layer context. If the user switches layers between an operation and its undo, the undo writes to the wrong layer.

3. **Object placement renders nothing.** The `PLACE_OBJECT` dispatch correctly updates the `ObjectLayer.objects[]` array, but `objectRenderData` is never populated in `page.tsx`, so `canvas-renderer.ts` has no sprite/frame data to draw placed objects. The `GameObjectsPanel` loads this data internally (sprite images and atlas frames) but does not expose it upward.

These three issues share a common root cause: data that should flow through the paint/render pipeline is either dropped or never connected.

## Decision

### Decision 1: Thread `activeLayerIndex` Through the Paint Pipeline

| Item | Content |
|------|---------|
| **Decision** | Add an optional `activeLayerIndex` parameter to `RetileEngine.applyMapPatch()`, `rebuildCells()`, and `writeToLayers()`, defaulting to `0` for backward compatibility |
| **Why now** | Users can create multiple tile layers but cannot paint on any layer except the first, making the layer system non-functional |
| **Why this** | Minimal-surface change (3 method signatures + 4 tool files + 2 command classes) that preserves all existing behavior when the parameter is omitted |
| **Known unknowns** | Whether future layer types (e.g., decoration layers with blending modes) will need a different write strategy |
| **Kill criteria** | If layer-aware rendering requires per-layer material grids (one grid per layer rather than a shared grid), this approach would need fundamental redesign |

### Decision 2: Full Rebuild Writes to ALL Tile Layers

| Item | Content |
|------|---------|
| **Decision** | When `rebuild(state, 'full')` is called (tileset change, map resize), iterate all tile layers and write frame data to each one, rather than targeting a single layer |
| **Why now** | Full rebuilds currently write to layer[0] only, leaving other tile layers stale after tileset changes |
| **Why this** | Full rebuilds affect the shared grid, so all tile layers must reflect the new computed frames to stay consistent |
| **Known unknowns** | Performance impact of writing to N layers instead of 1 during full rebuild (mitigated by full rebuilds being infrequent) |
| **Kill criteria** | If tile layers evolve to have independent grids, full rebuild would need per-layer grid recomputation |

### Decision 3: Shared Object Render Data via Hook

| Item | Content |
|------|---------|
| **Decision** | Extract sprite/frame loading logic from `GameObjectsPanel` into a shared React hook (`useObjectRenderData`) that returns `Map<objectId, ObjectRenderEntry>`, consumed by both the panel (thumbnails) and the canvas renderer (placed object rendering) |
| **Why now** | Object placement dispatch works correctly but objects are invisible on the canvas because render data is siloed inside the panel component |
| **Why this** | A hook is the idiomatic React pattern for sharing derived data between sibling components; avoids prop-drilling or global state |
| **Known unknowns** | Whether the S3 signed URLs for sprites expire during long editing sessions (may need refresh logic) |
| **Kill criteria** | If object render data needs server-side rendering or WebGL texture management, a hook-based approach may be insufficient |

## Rationale

### Options Considered

#### Decision 1: activeLayerIndex Threading

1. **Option A: Pass activeLayerIndex as method parameter (Selected)**
   - Pros: Minimal API change, backward compatible via default value, explicit data flow
   - Cons: Requires updating 4 tool files and 2 command classes

2. **Option B: Store activeLayerIndex on RetileEngine instance**
   - Pros: No method signature changes needed
   - Cons: Creates mutable state on an otherwise stateless-per-call engine; breaks undo/redo correctness because the engine's activeLayerIndex would reflect current UI state, not the state at command creation time

3. **Option C: Read activeLayerIndex from MapEditorState inside writeToLayers**
   - Pros: No command changes needed
   - Cons: **Fatal flaw for undo/redo**: When undoing after a layer switch, the state's `activeLayerIndex` is the CURRENT layer, not the layer where the original paint occurred. This would write undo data to the wrong layer.

Option A was selected because it correctly captures the target layer at command creation time, ensuring undo/redo integrity across layer switches.

#### Decision 2: Full Rebuild Layer Policy

1. **Option A: Write to ALL tile layers (Selected)**
   - Pros: All layers stay consistent with the shared grid after tileset changes
   - Cons: Slightly more work during full rebuild (iterating N layers)

2. **Option B: Write only to the active layer**
   - Pros: Faster full rebuild
   - Cons: Other layers become stale; user must manually trigger rebuild per layer

3. **Option C: Write to layer[0] only (current behavior)**
   - Pros: No change needed
   - Cons: Multi-layer maps are broken after tileset changes

Option A was selected because grid state is shared across all tile layers, so a full rebuild must update all of them.

#### Decision 3: Object Render Data Sharing

1. **Option A: Shared hook (Selected)**
   - Pros: Idiomatic React, no global state, testable, automatic cleanup
   - Cons: Sprite data loaded twice if hook instances don't share cache (mitigated by shared image cache)

2. **Option B: Lift sprite loading to page.tsx**
   - Pros: Single source of truth
   - Cons: page.tsx already has extensive state; adding sprite loading increases complexity

3. **Option C: Global store (Zustand/Context)**
   - Pros: Any component can access render data
   - Cons: Over-engineered for two consumers; adds a dependency

Option A was selected because it keeps the loading logic encapsulated while making the data available to both consumers through React's composition model.

## Consequences

### Positive Consequences

- Users can paint on any tile layer and see the results on that specific layer
- Undo/redo correctly targets the layer where the operation was originally performed
- Full rebuild operations keep all tile layers in sync
- Placed game objects become visible on the canvas
- All existing single-layer tests pass without modification (backward compatible defaults)

### Negative Consequences

- Every command instance now stores an additional integer field (`activeLayerIndex`)
- Full rebuild performance scales linearly with the number of tile layers (negligible for typical 2-5 layer maps)
- The shared hook introduces a second loading path for sprite data (panel thumbnails + canvas rendering)

### Neutral Consequences

- The `writeToLayers()` method gains a new parameter but retains its existing behavior when called without it
- Command constructors gain a new parameter, requiring updates to all tool creation sites

## Implementation Guidance

- **Capture at creation, not execution**: `activeLayerIndex` must be stored as an immutable field on command instances at construction time. Commands must never read `activeLayerIndex` from the state passed to `execute()` or `undo()`.
- **Default to layer 0**: All new parameters default to `0` to preserve backward compatibility with existing code and tests.
- **Use optional parameters**: New parameters should be optional with defaults, not required, to avoid breaking existing callers.
- **Iterate tile layers for full rebuild**: When `mode === 'full'`, `writeToLayers` should iterate all layers with `type !== 'object'` and write to each one.
- **T3a/T3b triggers follow full-rebuild policy**: T3a/T3b triggers (`updateTileset`, `addTileset`, `removeTileset`) shall follow the same all-layers policy as full rebuild, since tileset changes affect visual representation regardless of which layer is active. `updateTileset` writes to layers directly and must iterate all tile layers; `rebuildAffectedMaterials` (called by `addTileset`/`removeTileset`) passes through `rebuildCells` which must also target all tile layers.
- **Hook deduplication**: The shared `useObjectRenderData` hook should cache loaded images to avoid redundant network requests.

## Related Information

- [ADR-0011: Autotile Routing Architecture](ADR-0011-autotile-routing-architecture.md) -- establishes the RetileEngine pipeline this ADR modifies
- [Design-015: Autotile Routing System](../design/design-015-autotile-routing-system.md) -- original routing system design
- [Design-017: Multi-Layer Painting and Object Placement](../design/design-017-multi-layer-painting-and-object-placement.md) -- implementation details for this ADR
