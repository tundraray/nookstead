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
