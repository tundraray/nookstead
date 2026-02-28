# Quality Fixer Memory

## Project Structure
- Monorepo: Nx 22.5.0 with pnpm workspaces
- Key apps: `game` (Next.js), `genmap` (Next.js map editor), `game-e2e` (Playwright), `server`
- Key packages: `shared` (types), `map-lib` (map generation/rendering), `map-renderer`, `db` (Drizzle ORM)

## Genmap App
- Path: `apps/genmap`
- No `typecheck` Nx target; use `cd apps/genmap && npx tsc --noEmit` directly
- Root page at `src/app/(app)/page.tsx` (redirects to /sprites), NOT `src/app/page.tsx`
- Uses Next.js route groups: `(app)` and `(editor)`
- Path alias: `@/*` -> `./src/*`
- TSConfig references: shared, map-lib, db packages

## Cell Type (shared)
- `Cell` interface in `packages/shared/src/types/map.ts`
- Required fields: `terrain` (TerrainCellType), `elevation` (number), `meta` (Record<string, number>)
- Optional fields: `action?` (CellAction)
- TerrainCellType is auto-generated in `terrain-cell-type.generated.ts`

## Material Cache (game)
- `apps/game/src/game/services/material-cache.ts`
- `getMaterialProperties(terrainKey)` returns properties from API-loaded cache
- Cache is null until `loadMaterialCache()` is called (fetches from `/api/materials`)
- Returns DEFAULT_PROPERTIES (speedModifier: 1.0) when cache is null
- Tests MUST mock this module for terrain-dependent behavior

## Deleted Directories (migration)
- `apps/game/src/game/mapgen/` - types moved to `@nookstead/shared`
- Type-only imports from deleted paths don't fail at runtime (erased by TS)
- But they DO fail typecheck - always update import paths

## Quality Check Commands
- Lint: `pnpm nx lint genmap`
- Test: `pnpm nx test genmap`
- TypeScript: `cd apps/genmap && npx tsc --noEmit`
- Full gate: `pnpm nx run-many -t lint test build typecheck e2e`

## DB Package Lint Warnings (known, non-blocking)
- `tilesets.ts:30` - @typescript-eslint/no-explicit-any
- `seed-tilesets.ts:502` - unused 'err' variable
- `tileset.ts:65` - non-null assertion
