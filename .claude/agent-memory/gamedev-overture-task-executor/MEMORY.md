# Task Executor Memory - Genmap

## Project Structure
- Genmap is at `apps/genmap/` within the Nx monorepo at `D:\git\github\nookstead\server`
- No `typecheck` Nx target for genmap. Use `npx tsc --noEmit` from `apps/genmap/` directory instead.
- Available Nx targets: build, dev, start, serve-static, lint, test
- Task files are at `docs/plans/tasks/plan-{name}/task-{n}.md` (relative to monorepo root, NOT genmap root)
- Work plans are at `docs/plans/plan-{name}.md`

## Key File Locations
- Map editor page: `apps/genmap/src/app/(editor)/maps/[id]/page.tsx`
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

## Tileset Management (plan-011)
- API routes follow Next.js 16 pattern: `{ params }: { params: Promise<{ id: string }> }` (params is async)
- DB package uses `export *` from services in `packages/db/src/index.ts`; must run `pnpm nx typecheck db` first to generate declarations before genmap typecheck works
- S3 helpers: `uploadToS3`, `buildS3Url`, `deleteS3Object`, `generatePresignedGetUrl` from `@/lib/s3`
- URL helpers pattern: `withTilesetSignedUrl`/`withTilesetSignedUrls` in `@/lib/tileset-url.ts` (mirrors `sprite-url.ts`)
- Image processing: `tileset-image.ts` has `validateTilesetDimensions`, `splitTilesetImage`, `validateFrameContent`
- Next.js App Router: literal path segments (e.g., `tags/`, `matrix/`) take precedence over dynamic `[id]/`
- GET /api/tilesets now returns tags array per tileset (Phase 8 integration change)
- `useTilesets` hook returns `TilesetWithTags[]` (extends Tileset with `tags: string[]`)
- `useTilesetImages` hook fetches from API with presigned S3 URLs (replaces static `/tilesets/terrain-XX.png`)
- TerrainPalette accepts `tilesets: PaletteTileset[]` prop and groups by first tag
- TERRAINS/TILESETS/TERRAIN_NAMES/SURFACE_PROPERTIES are @deprecated in map-lib but NOT removed (game app dependency)
- `autotile-utils.ts` still imports TERRAINS for terrain-key-to-name mapping (legitimate autotile dependency)
- SOLID_FRAME constant replaced with literal 47 in terrain-palette.tsx

## map-lib Package
- Jest config created at `packages/map-lib/jest.config.ts` (follows db package pattern)
- Jest uses `--testPathPatterns` (plural) not `--testPathPattern` (singular) in this repo's Jest version
- Fence autotile engine at `packages/map-lib/src/core/fence-autotile.ts` - pure functions, zero imports
- Exports added to `packages/map-lib/src/index.ts` (no core/index.ts barrel file)

## Map-lib Declaration Generation
- Genmap's tsconfig.json uses project references (`references: [{ path: "../../packages/map-lib" }]`)
- With project references, tsc resolves `@nookstead/map-lib` via `dist/*.d.ts` declarations, NOT source files
- When new modules are added to map-lib (e.g., tileset-registry, terrain-renderer), declarations must be regenerated via `pnpm nx typecheck map-lib` before genmap can see them
- If map-lib typecheck fails (e.g., legacy code errors), declarations are NOT generated and genmap gets "has no exported member" errors
- Fix: resolve map-lib type errors first, then run `pnpm nx typecheck map-lib` to regenerate declarations

## Drizzle Migrations (packages/db)
- drizzle.config.ts is at `packages/db/drizzle.config.ts`
- Migration output directory: `packages/db/src/migrations/` (NOT `packages/db/drizzle/`)
- Generate command: `cd packages/db && pnpm db:generate` (runs `drizzle-kit generate`)
- Validate command: `cd packages/db && pnpm db:check` (runs `drizzle-kit check`)
- Migrations use sequential numbering: `0000_name.sql`, `0001_name.sql`, etc.
- drizzle-kit generate diffs schema against snapshots in `src/migrations/meta/`, does NOT require DB connection
- As of 2026-03-07, 16 migrations exist (0000 through 0015)

## AI Dialogue Integration (plan-021)
- AI SDK v6 (`ai@^6.0.105`): `streamText()` returns `StreamTextResult` synchronously (NOT a Promise)
- Use `maxOutputTokens` (NOT `maxTokens`) in AI SDK v6 -- the old name was removed
- `openai.chat(modelId)` for Chat Completions API; `openai(modelId)` uses Responses API
- `createOpenAI({ apiKey })` from `@ai-sdk/openai` creates the provider
- `result.textStream` is `AsyncIterableStream<string>` -- use `for await` to consume
- Server typecheck: `pnpm nx typecheck server` (NOT standalone tsc)
- Pre-existing BotManager test fixture errors after persona columns added (Task 2) -- not blocking DialogueService

## Colyseus Schema v4 Internals
- [project_colyseus_v4_schema.md](./project_colyseus_v4_schema.md) - Field metadata access, decorator behavior differences from older versions

## Canvas Coordinate Conversion
- `pixelToTile` function in map-editor-canvas.tsx already handles screen->tile conversion
- Uses `Math.floor(worldCoord / TILE_SIZE)` which produces integer tile coords
- The `onCursorMove` callback reuses tile coords from `pixelToTile` rather than recomputing
- Phase 4 placeholder props (`placedObjects`, `onObjectPlace`, `objectRenderData`) are prefixed with `_` in destructuring to suppress unused var warnings
