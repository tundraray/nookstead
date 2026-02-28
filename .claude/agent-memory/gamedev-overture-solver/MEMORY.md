# Solver Agent Memory

## Project Architecture Patterns

### Tileset Registry (packages/map-lib/src/core/tileset-registry.ts)
- `fromMap` stores FIRST entry per material key (first-in-wins)
- `findAnyFor()` returns ANY tileset with that fromMaterialKey -- does NOT distinguish standalone vs transition
- Standalone tilesets = fromMaterial set, toMaterial null/empty
- Transition tilesets = both fromMaterial and toMaterial set
- The registry skips tilesets with null fromMaterial entirely (line 68)

### Terrain Renderer (packages/map-lib/src/core/terrain-renderer.ts)
- SOLID_FRAME branch (line 135-137): uses findAnyFor() which can return transition tilesets
- Design doc at docs/design/design-material-terrain.md line 745-749 confirms this pattern
- Edge/transition rendering (frames 2-47) uses registry.resolve() -- works correctly

### Seed Data (packages/db/src/seeds/seed-tilesets.ts)
- RELATIONSHIPS dict only covers tilesets 1-16 (transition tilesets)
- Tilesets 18-26 are standalone materials but get fromMaterialId=null in DB (bug)
- STANDALONE_MATERIALS array exists but only adds to material table, not to tileset fromMaterial
- Tileset 11 (clay_ground) and 17 (alpha_props_fence) have no relationships

### Key Affected Files for Tileset Changes
- packages/map-lib/src/core/tileset-registry.ts -- registry interface and implementation
- packages/map-lib/src/core/terrain-renderer.ts -- SOLID_FRAME rendering logic
- packages/db/src/seeds/seed-tilesets.ts -- seed data definitions
- apps/genmap/src/components/map-editor/canvas-renderer.ts -- client-side rendering
- apps/genmap/src/app/(editor)/maps/[id]/page.tsx -- registry construction from API data
- Mock locations: apps/game/src/game/scenes/Game.spec.ts, Preloader.spec.ts, use-map-editor.test.ts

## Solution Patterns Learned
- When autotile transition tilesets are incorrectly used for solid interior rendering, prefer adding a standalone tileset concept rather than fixing individual assets
- Solid_fill fallback (tilesetKey=null, use material color) is always available as graceful degradation
