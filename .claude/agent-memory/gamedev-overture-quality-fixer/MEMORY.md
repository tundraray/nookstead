# Quality Fixer Memory

## Project Structure
- Monorepo: Nx 22.5.0 with pnpm workspaces
- Key apps: `game` (Next.js), `genmap` (Next.js map editor), `game-e2e` (Playwright)
- Key packages: `shared` (types), `map-lib` (map generation/rendering), `db` (Drizzle ORM)

## Genmap App
- Path: `apps/genmap`
- No `typecheck` Nx target; use `cd apps/genmap && npx tsc --noEmit` directly
- Pre-existing test failure: `specs/index.spec.tsx` (Cannot find module `../src/app/page`) - this is a known issue
- Path alias: `@/*` -> `./src/*`
- TSConfig references: shared, map-lib, db packages

## Cell Type (shared)
- `Cell` interface in `packages/shared/src/types/map.ts`
- Required fields: `materialKey` (string), `elevation` (number), `meta` (Record<string, number>)
- Optional fields: `terrain?` (TerrainCellType, deprecated), `action?` (CellAction)
- When creating empty cells, always include `materialKey` (e.g., `materialKey: 'deep_water'`)

## Quality Check Commands
- Lint: `pnpm nx lint genmap`
- Test: `pnpm nx test genmap`
- TypeScript: `cd apps/genmap && npx tsc --noEmit`
- Full gate: `pnpm nx run-many -t lint test build typecheck e2e`
