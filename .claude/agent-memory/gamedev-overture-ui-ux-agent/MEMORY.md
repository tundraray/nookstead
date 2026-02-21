# UI/UX Agent Memory

## Project Structure
- Genmap editor: `apps/genmap/` -- Next.js + Canvas-based sprite/tile map/game object editor
- shadcn/ui component library with Tailwind CSS
- Key canvas components: `SpriteGridCanvas`, `ObjectGridCanvas`, `TilePicker`, `ObjectPreview`
- Hooks pattern: `apps/genmap/src/hooks/` (e.g., `use-keyboard-shortcuts.ts`)
- Existing UXRD: `docs/uxrd/uxrd-001-game-header-navigation.md` -- reference for style/format

## Conventions
- UXRD docs go in `docs/uxrd/` with format `uxrd-NNN-feature-name.md`
- Use mermaid diagrams for user flows
- Canvas components use `requestAnimationFrame` for rendering
- Coordinate mapping accounts for CSS scaling via `getBoundingClientRect` vs `naturalWidth/Height`
- `useCallback` + `useEffect` pattern for canvas re-rendering

## Design Patterns Found
- Canvas event handling: `getCellFromEvent` pattern (clientX/Y -> scale -> grid coords)
- State management: parent page owns state, canvas components are controlled
- Toast notifications via `sonner` library
- Keyboard shortcuts via global `useKeyboardShortcuts` hook
- localStorage used for preference persistence (pattern established in UXRD-002)

## Key Decisions (UXRD-002)
- Marquee: 3px drag threshold, Shift=add, Ctrl=subtract, no modifier=replace
- Background: global preference in localStorage, 5 presets + custom color picker
- Floating panel: no library dependency, native pointer events, React portal

## Key Decisions (UXRD-003 -- Photoshop Redesign)
- Dark theme scoped to editor page only via `data-theme="editor-dark"` attribute
- Activity Bar (40px) + push sidebar (280px) pattern (VS Code style)
- Options bar replaces toolbar: static controls + tool-specific section
- 6 sidebar tabs: Terrain, Layers, Properties, Zones, Frames, Game Objects
- Number keys 1-6 toggle sidebar tabs
- Status bar (24px): zoom, cursor position, active layer, save status
- Compact header (36px) with inline map name edit
- Sidebar tab persisted to localStorage key `genmap-editor-sidebar-tab`
- Existing panels (TerrainPalette, LayerPanel, etc.) moved unchanged into sidebar
- Frames panel uses existing `/api/frames/search` endpoint
- Game Objects panel uses existing `/api/objects` endpoint + drag-to-place

## Key Decisions (UXRD-004 -- Tileset Management)
- 6 pages: tileset list, upload, edit, materials, transition matrix, editor integration
- Tileset image format: 192px wide (12 cols x 16px), height multiple of 64px (4 rows x 16px)
- Multi-tileset upload: auto-detect count from height/64, per-tileset naming + material assignment
- Materials table: new DB entity replacing hardcoded terrain-properties.ts
- Transition matrix: materials on both axes, click empty cell -> upload pre-configured
- Test canvas: 10x10 grid, two-brush paint, autotile recalc on mouseup
- Terrain palette migration: API-sourced tilesets grouped by first tag (replaces hardcoded TILESETS)
- Nav additions: /tilesets and /materials top-level items
- Route groups: tilesets/materials pages under `(app)` layout group
- Autotile preview: 8x6 grid of 24x24 cells showing all 47 variants
- Tag editor: reusable component with autocomplete from /api/tilesets/tags
