# Work Planner Memory

## Project Conventions
- Work plans stored at `docs/plans/` with naming convention `plan-NNN-description.md`
- Test files co-located as `*.spec.ts` next to source files in `packages/map-lib/src/core/`
- Zero-build TS source pattern: map-lib exports `.ts` directly
- Test patterns: `makeCell`, `makeMaterial` factory helpers
- Nx monorepo: use `pnpm nx test map-lib`, `pnpm nx typecheck map-lib`

## Plan Structure
- User prefers design-doc-aligned phases over the generic 6-phase game dev structure
- For algorithmic/library refactors, horizontal slice (foundation-driven) phases work well
- Always include migration strategy and rollback plan for refactoring work
- Design Doc acceptance criteria (AC1-AC9) should be referenced per-phase
- Performance targets go in final QA phase with specific thresholds
