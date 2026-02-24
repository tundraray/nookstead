# Agent Memory - Acceptance Test Generator

## Project Test Conventions (packages/map-lib)
- **Framework**: Jest with ts-jest, `.spec.ts` extension
- **Location**: Co-located in `packages/map-lib/src/core/` next to source files
- **Naming**: `describe('ModuleName')` / `it('should [behavior] when [condition]')`
- **Helpers**: Factory pattern: `makeCell(terrain)`, `makeMaterial(key, overrides)`, `makeTileset(key, from, to?)`
- **Integration tests**: Named `*.integration.spec.ts`, placed alongside unit tests
- **Indentation**: 2-space indent (from .editorconfig)
- **Run command**: `pnpm nx test map-lib --testPathPattern=<pattern>`

## Reference Tileset Set (Design Doc 015)
11 tilesets (5 base + 6 transition), 5 materials (deep-water, water, grass, soil, sand).
Priority Preset A: deep-water=100, water=90, sand=50, grass=30, soil=10.
Preferences: ['water', 'grass', 'sand', 'soil', 'deep-water'].

## Key Routing Table Entries
- nextHop(deep-water, soil) = water (3-hop: dw->water->grass->soil)
- nextHop(soil, deep-water) = grass
- nextHop(deep-water, sand) = water (2-hop)
- nextHop(water, deep-water) = deep-water (direct)
