# Quality Fixer Agent Memory

## Project Structure
- Nx monorepo at `D:\git\github\nookstead\ui-component`
- Key packages: db, map-lib, map-renderer, s3, shared
- Key apps: game (Next.js), server (Colyseus), genmap (editor), game-e2e
- All quality commands run from workspace root via `pnpm nx`

## Known Issues
- **Windows Nx cache issue**: `pnpm nx build game` exits with code 1 due to "Cannot create a file when that file already exists (os error 183)" even when the build itself succeeds. This is a known Windows symlink/cache race condition in Nx, not a build failure. Verify success by checking for "Successfully ran target build" in output.

## Domain Type Split
- `packages/db` uses MapType = 'homestead' | 'city' | 'open_world' (DB domain)
- `packages/map-lib` + `apps/genmap` use MapType = 'player_homestead' | 'town_district' | 'template' (editor domain)
- Import/export service maps between these two type systems
- Tests verify the mapping (e.g., player_homestead -> homestead)

## Quality Check Results (plan-009 refactor)
- 9 projects lint successfully (0 errors, warnings only - non-null assertions in tests)
- 6 projects test successfully (53 suites, 723 tests, 0 failures)
- 7 projects typecheck successfully
- Game build compiles successfully (10 routes generated)
