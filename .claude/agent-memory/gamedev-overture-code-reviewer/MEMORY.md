# Code Reviewer Agent Memory

## Project Patterns

### Autotile Routing System (design-015)
- 6-module pipeline: TilesetRegistry -> GraphBuilder -> Router -> EdgeResolver -> CellTilesetSelector -> RetileEngine
- All modules in `packages/map-lib/src/core/`
- Types in `packages/map-lib/src/types/routing-types.ts`
- Reference data uses hyphenated keys (`deep-water`); production data uses underscored (`deep_water`)
- Tests co-located as `.spec.ts` files; integration tests use `.integration.spec.ts` suffix
- Performance tests use `.performance.spec.ts`; real-data tests use `.realdata.spec.ts`
- Commands: RoutingPaintCommand, RoutingFillCommand in routing-commands.ts
- Editor integration: use-map-editor.ts reducer + tool files in apps/genmap

### Material Key Convention
- Production DB uses underscores: `deep_water`, `fertile_soil`, `tilled_soil`
- Reference test data uses hyphens: `deep-water`, `deep-sand`
- Tileset keys use hyphens: `deep-water_water`, `grass_water`
- This inconsistency is a known source of test failures

### Design Doc Structure
- Main design doc has AC1-AC10 acceptance criteria in EARS format
- Neighbor repaint policy is a separate supplement doc (v2, in Russian)
- The v2 doc adds classifyEdge (C1-C5) and commit policy on top of existing pipeline

### Test Suite Stats (as of 2026-02-24)
- 18 test suites, 279 tests total
- 6 failures in retile-engine.realdata.spec.ts (production data edge cases)
- Performance: T1=1.09ms, T4=51.91ms, BFS=0.51ms, Fill=19.46ms
