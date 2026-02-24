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

## TDD Plan Patterns
- When spec files already exist (TDD), frame tasks as "make X.spec.ts GREEN" not "create spec"
- Track test resolution per phase: "0/14 -> 14/14" format shows progress clearly
- Include cumulative GREEN count table in Testing Strategy section
- Spec file that needs to be WRITTEN (vs already existing) should be noted in status column
- Separate deletion phase (Phase 7) from integration (Phase 6) for safety
- 8-phase structure works well for TDD refactors: 4 impl phases + commands + integration + cleanup + QA

## Key Files for Routing System
- Tool files that import PaintCommand/FillCommand: brush-tool.ts, fill-tool.ts, eraser-tool.ts, rectangle-tool.ts
- use-map-editor.ts reducer handles LOAD_MAP (recompute) and PUSH_COMMAND (delegated to command.execute)
- canvas-renderer.ts reads layer.frames[y][x] and layer.tilesetKeys[y][x] -- unchanged by routing work
