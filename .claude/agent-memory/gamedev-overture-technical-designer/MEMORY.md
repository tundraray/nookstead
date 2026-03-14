# Technical Designer Memory

## Autotile Routing System (Design-015)
- S1 conflict resolution: NEIGHBOR priority determines reassignment. Higher-priority neighbors "own" edges, causing the current cell to DROP that BG requirement.
- Preset A (water-side-owns): deep-water=100 > water=90 > sand=50 > grass=30 > soil=10. Land cells at multi-material junctions prefer grass BG (water-side edges get reassigned).
- Preset B (land-side-owns): reverses priorities, land cells prefer water BG at junctions.
- When verifying worked examples, always run S1 step-by-step with actual priority numbers; do not assume which edge gets reassigned.
- OOB neighbors: bit=1 for mask computation (matching), but SKIP for BG resolution (no BG requirement).
- Diagonal gating is purely FG-mask-based; virtual BG never affects it.
- Render graph is DIRECTED (A->B means A_B tileset exists). Compat graph is undirected.

## Key File Paths
- Design doc: `docs/design/design-015-autotile-routing-system.md`
- ADR: `docs/adr/ADR-0011-autotile-routing-architecture.md`
- Autotile engine: `packages/map-lib/src/core/autotile.ts`
- Current autotile layers: `packages/map-lib/src/core/autotile-layers.ts`
- Neighbor mask: `packages/map-lib/src/core/neighbor-mask.ts`
- Types: `packages/map-lib/src/types/material-types.ts`, `editor-types.ts`

## Design Doc Review Patterns
- Always verify S1 conflict resolution with actual priority numbers from the specified preset
- Always verify mask computations step by step (raw -> gated -> FRAME_TABLE lookup)
- Always verify routing table entries via BFS traversal of compat graph
- Check render graph DIRECTION for tileset existence (A_B != B_A)

## NPC Responsive World (Design-012)
- [project_responsive_world.md](./project_responsive_world.md) — 4 new subsystems for "world that notices you"
