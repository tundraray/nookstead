# Task Decomposer Memory

## Project: Nookstead ui-component

### Key Patterns Confirmed

- **Task directory naming**: `docs/plans/tasks/{plan-name}/` where plan-name is the plan filename without `.md`
- **Task file naming**: `task-{two-digit-number}.md` (e.g., `task-01.md` through `task-18.md`)
- **Phase completion files**: `phase{number}-completion.md` (one per phase, generated when plan contains "Phase" string)
- **Overview file**: `_overview.md` always generated first

### Project Structure Notes

- Monorepo with pnpm workspaces. Projects: `@nookstead/db`, `@nookstead/shared`, `@nookstead/server`, `@nookstead/game`, `@nookstead/genmap`
- DB services pattern: `(db: DrizzleClient, ...params)` with object types for 3+ params
- Schema pattern: follow `editor-maps.ts` (UUID PK via `uuid('id').defaultRandom().primaryKey()`)
- Barrel exports in `packages/db/src/index.ts`
- Test runner: Jest (via `pnpm nx test @nookstead/{project}`)
- Typecheck: `pnpm nx typecheck @nookstead/{project}`
- E2E: `pnpm nx e2e game-e2e`

### Task Decomposition Conventions for This Project

- L3 = typecheck passes, L2 = unit tests pass, L1 = functional operation verified
- Phase completion files contain: task checklist + operational verification procedures copied from work plan + AC gate
- Each task file includes: exact code samples from Design Doc where available
- Implementation steps follow TDD: Red (write/identify failing state) → Green (minimal implementation) → Refactor
