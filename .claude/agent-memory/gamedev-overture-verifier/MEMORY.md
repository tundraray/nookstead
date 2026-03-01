# Verifier Agent Memory

## Project Architecture Notes

### Map Editor Rendering Pipeline
- Terrain commands: computed by `renderTerrain()` in `packages/map-lib/src/core/terrain-renderer.ts`
- Tileset selection for SOLID_FRAME: uses `registry.findAnyFor(materialKey)` which returns FIRST tileset with that fromMaterialKey
- Canvas rendering: `apps/genmap/src/components/map-editor/canvas-renderer.ts` draws terrain commands, then legacy layers on top
- Frame coordinate calculation: `srcX = (frame % 12) * 16`, `srcY = Math.floor(frame / 12) * 16` for 12-column, 16x16 tilesheet

### Tileset Registry
- Built from DB records via `buildTilesetRegistry()` in `packages/map-lib/src/core/tileset-registry.ts`
- `findAnyFor` uses first-in-wins from `fromMap`, order depends on API response (sortOrder field)
- 3-tier fallback: direct -> inverse -> solid_fill

### Key Seed Data Location
- Tileset definitions: `packages/db/src/seeds/seed-tilesets.ts`
- 26 tilesets, 21 materials
- Tileset PNGs: `apps/game/public/assets/tilesets/terrain-XX.png` (192x64 RGBA, 12 cols x 4 rows of 16x16)

### Redundant useEffect Pattern
- Editor page (maps/[id]/page.tsx) has a useEffect that re-dispatches SET_TERRAIN_COMMANDS on every grid change
- This is redundant with PUSH_COMMAND reducer which already calls renderTerrain
- Both produce identical results (pure function), so not harmful but wasteful

## Verification Patterns Learned
- Always check visual assets when investigating rendering bugs, not just code logic
- Test data may differ from production seed data (e.g., test has 'water-only' tileset, production does not)
- When user says "painted tile shows wrong, neighbors correct" -- focus on SOLID_FRAME code path vs transition frame code path
- Blob-47 standard: frame 1 = solid fill in every tileset, but asset quality varies
