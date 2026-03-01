# Task Executor Memory - Genmap

## Project Structure
- Genmap is at `apps/genmap/` within the Nx monorepo at `D:\git\github\nookstead\server`
- No `typecheck` Nx target for genmap. Use `npx tsc --noEmit` from `apps/genmap/` directory instead.
- Available Nx targets: build, dev, start, serve-static, lint, test
- Task files are at `docs/plans/tasks/plan-{name}/task-{n}.md` (relative to monorepo root, NOT genmap root)
- Work plans are at `docs/plans/plan-{name}.md`

## Key File Locations
- Map editor page: `apps/genmap/src/app/maps/[id]/page.tsx`
- Editor state types: `apps/genmap/src/hooks/map-editor-types.ts`
- Editor reducer: `apps/genmap/src/hooks/use-map-editor.ts`
- Map editor components: `apps/genmap/src/components/map-editor/`

## Map Editor UI Redesign (plan-009)
- Phase 1 layout shell components: EditorHeader, ActivityBar, EditorSidebar
- MapEditorToolbar kept in Options Bar placeholder through Phase 1; Task 2.5 replaces it
- EditorSidebar renders panels (TerrainPalette, LayerPanel, MapPropertiesPanel, ZonePanel) via switch on activeTab
- page.tsx uses negative margin trick to break out of container: `margin: -1.5rem; width: calc(100% + 3rem)`

## Design Doc Field Naming
- Task spec had `state.mapName` but actual MapEditorState field is `state.name`
- Task spec showed `zoneDispatch` but actual canvas uses individual zone props (zones, selectedZoneId, zoneVisibility)
- Always check actual component interfaces rather than trusting task spec pseudocode exactly

## Phaser Naming Conflicts
- Phaser `Scene` base class has a public `renderer` property (type `CanvasRenderer | WebGLRenderer`)
- Do NOT name a private field `renderer` in Scene subclasses -- use `mapRenderer` or similar
- `noUnusedLocals: true` in tsconfig.base.json also flags unused private class members (TS6133)
- No `typecheck` Nx target for `game` project either; use `npx tsc --noEmit` from `apps/game/`
