# ADR-003: Radix UI Dialog Primitives for GameModal Component

## Status

Accepted

## Context

Nookstead requires a modal/dialog component (GameModal) for in-game UI interactions such as NPC dialogue, inventory management, settings menus, and confirmation prompts. The modal must support pixel art NineSlice borders -- a core visual element of the game's 2D pixel art aesthetic -- which means the solution must allow complete CSS customization without fighting against built-in styles.

Key requirements:

1. **Fully unstyled / headless** -- the component must impose zero default CSS so that custom pixel art NineSlice borders and game-themed styling can be applied without overrides
2. **Accessibility out-of-the-box** -- WAI-ARIA Dialog pattern compliance, focus trapping, keyboard navigation (ESC to close, Tab cycling), scroll lock, and screen reader support
3. **React 19 compatible** -- the project uses React 19 (`react@^19.0.0`) with Next.js 16
4. **PostCSS + global CSS compatible** -- the project explicitly uses PostCSS with `postcss-preset-env` and a single global stylesheet with BEM-lite naming (see CSS migration design doc). Tailwind CSS has been intentionally rejected as a styling approach.
5. **Portal rendering** -- modal content must render outside the Phaser game canvas DOM hierarchy to avoid z-index and overflow issues
6. **Lightweight** -- minimal bundle impact for a game client where every kilobyte matters

Currently, the project has no UI component library installed. The only production dependencies are `next`, `next-auth`, `phaser`, `react`, and `react-dom`.

### Alternatives Considered

#### 1. shadcn/ui Dialog

- Pros:
  - Well-documented, popular in the React ecosystem
  - Built on Radix UI primitives underneath
  - Copy-paste model avoids npm dependency
- Cons:
  - **Hard dependency on Tailwind CSS** -- all component code uses Tailwind utility classes (`className="fixed inset-0 bg-black/80"`, etc.)
  - Conflicts directly with the project's explicit anti-Tailwind architecture decision (PostCSS + global CSS with BEM-lite naming)
  - Adding Tailwind alongside the existing PostCSS pipeline introduces two competing styling paradigms
  - Would require rewriting every copied component to remove Tailwind classes, defeating the purpose

#### 2. Custom Implementation from Scratch

- Pros:
  - Zero external dependencies
  - Complete control over every behavior
- Cons:
  - Requires manually implementing focus trapping (Tab/Shift+Tab cycling within modal)
  - Requires manual ESC key handling with proper event propagation
  - Requires manual click-outside-to-close with correct event target detection
  - Requires manual scroll lock (prevent body scroll while modal is open)
  - Requires manual ARIA attribute management (`role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`)
  - Requires manual portal rendering
  - Each of these is a solved problem with known edge cases (iOS scroll lock, nested modals, focus restoration). Reimplementing them is error-prone and ongoing maintenance burden.
  - Estimated effort: 3-5 days to implement correctly with all edge cases vs. hours with a primitive library

#### 3. Base UI (formerly MUI Base)

- Pros:
  - Headless/unstyled approach similar to Radix
  - From the creators of Material UI, established team
  - Supports React 19
- Cons:
  - Heavier overall dependency footprint than Radix primitives
  - Smaller ecosystem adoption compared to Radix for headless primitives
  - API surface is broader and more complex than needed for a single Dialog component
  - Less community content and fewer examples for headless usage patterns
  - The library underwent a significant rebrand/restructure (MUI Base to Base UI), creating documentation fragmentation

### Comparison

| Criterion | Radix UI Dialog | shadcn/ui Dialog | Custom | Base UI |
|---|---|---|---|---|
| Unstyled / headless | Yes | No (Tailwind) | Yes | Yes |
| PostCSS compatible | Yes | No | Yes | Yes |
| Accessibility (built-in) | Full WAI-ARIA | Full (via Radix) | Manual | Full WAI-ARIA |
| React 19 support | Yes (unified pkg) | Yes | N/A | Yes |
| Bundle impact | ~5KB (tree-shaken) | N/A (copy-paste) | 0KB | ~10-15KB |
| Implementation effort | Hours | Days (rewrite) | 3-5 days | Hours |
| Community adoption | Very high | Very high | N/A | Medium |
| Portal rendering | Built-in | Built-in (via Radix) | Manual | Built-in |
| Focus trapping | Built-in | Built-in (via Radix) | Manual | Built-in |

## Decision

We will use **Radix UI Dialog primitives** from the unified `radix-ui` npm package for the GameModal component.

### Decision Details

| Item | Content |
|---|---|
| **Decision** | Use `radix-ui` (unified package) Dialog primitives for the GameModal component |
| **Why now** | The GameModal is the first modal component needed in the game UI; establishing the primitive library now sets the pattern for future dialog-based components (NPC dialogue, inventory, settings) |
| **Why this** | Radix UI Dialog is the only option that is simultaneously headless (no CSS opinions), fully accessible, React 19 compatible, and lightweight. shadcn/ui requires Tailwind which conflicts with our architecture. Custom implementation reinvents solved accessibility problems. Base UI is heavier with less community adoption for headless usage. |
| **Known unknowns** | (1) Radix UI animation integration with CSS-only approaches (no Tailwind `animate-*` utilities) -- may require custom CSS `@keyframes` for open/close transitions. (2) Interaction between Radix portal rendering and Phaser canvas z-index layering has not been verified. |
| **Kill criteria** | If Radix UI drops React 19 support or the unified package introduces breaking changes that prevent tree-shaking of the Dialog primitive, evaluate migrating to Base UI or a custom implementation. |

### Architecture Decisions

- **Unified package**: Install `radix-ui` (not individual `@radix-ui/react-dialog`) to get a single dependency that tree-shakes to only the Dialog primitive code.
- **Import pattern**: `import { Dialog } from "radix-ui"` with compound component access (`Dialog.Root`, `Dialog.Trigger`, `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content`, `Dialog.Title`, `Dialog.Description`, `Dialog.Close`).
- **Styling approach**: All Dialog visual styling through the project's global CSS file using BEM-lite class names (e.g., `.game-modal__overlay`, `.game-modal__content`). No inline styles except dynamic values.
- **NineSlice integration**: The `Dialog.Content` element receives CSS classes that apply the pixel art NineSlice border pattern, consistent with the existing `NineSlicePanel` component approach.
- **Custom wrapper component**: Create a `GameModal` component that abstracts `Dialog.Overlay`, `Dialog.Portal`, and `Dialog.Close` into a simpler API, following Radix's documented custom API pattern.

## Rationale

Radix UI Dialog was selected because it uniquely satisfies all project constraints simultaneously:

1. **Headless architecture** aligns perfectly with the PostCSS + global CSS styling approach. Unlike shadcn/ui which requires Tailwind, Radix primitives render semantic HTML with zero CSS opinions. This means the pixel art NineSlice border system works without fighting against or overriding library styles.

2. **Comprehensive accessibility** eliminates the most error-prone aspect of modal implementation. Focus trapping, ESC handling, click-outside behavior, scroll lock, and ARIA attributes are all handled correctly out-of-the-box, including edge cases like iOS scroll lock and nested modal focus restoration.

3. **React 19 compatibility** via the unified `radix-ui` package avoids the peer dependency issues that plague older individual `@radix-ui/react-*` packages. The unified package was specifically created to resolve version fragmentation.

4. **Tree-shakable bundle** ensures only Dialog-related code is included, keeping the game client's bundle lean.

5. **Compound component API** (`Dialog.Root`, `Dialog.Content`, etc.) provides fine-grained control over each part of the modal while maintaining a clean, composable architecture.

## Consequences

### Positive

1. **Zero CSS conflicts** -- headless primitives work seamlessly with the existing PostCSS + global CSS pipeline and BEM-lite naming convention
2. **Pixel art styling freedom** -- NineSlice borders, custom pixel art close buttons, and game-themed overlays can be applied purely through CSS classes
3. **Accessibility compliance** -- WAI-ARIA Dialog pattern, keyboard navigation (ESC, Tab, Shift+Tab), focus trapping, scroll lock, and screen reader support are handled automatically
4. **React 19 compatible** -- the unified `radix-ui` package is tested and released with React 19 support
5. **Future component reuse** -- once `radix-ui` is installed, other primitives (Tooltip, Popover, DropdownMenu, etc.) are available at no additional install cost via tree-shaking
6. **Small bundle impact** -- Dialog primitive tree-shakes to approximately 5KB gzipped
7. **Well-documented custom API pattern** -- Radix documents how to abstract primitives into project-specific wrapper components

### Negative

1. **New runtime dependency** -- adds `radix-ui` to production dependencies (first UI primitive library in the project)
2. **Learning curve** -- team must learn Radix compound component patterns (`Root`, `Trigger`, `Portal`, `Content`, etc.) and the `asChild` prop pattern for element polymorphism
3. **Animation approach** -- without Tailwind utility classes, open/close animations require custom CSS `@keyframes` definitions and `data-state="open|closed"` attribute selectors in global CSS
4. **Radix-specific patterns** -- `forwardRef` usage, `asChild` composition, and `data-state` CSS selectors are Radix-specific conventions that differ from vanilla React patterns

### Neutral

- The unified `radix-ui` package replaces the older pattern of installing individual `@radix-ui/react-*` packages. Documentation may reference either import style; the project will standardize on the unified import.
- Radix Dialog renders content via a React Portal by default (`Dialog.Portal`), which creates DOM nodes outside the React component tree. This is desirable for z-index management above the Phaser canvas but means Dialog content is not a DOM child of its React parent.

## Implementation Guidance

- Use the compound component pattern to build a `GameModal` wrapper that encapsulates `Dialog.Portal`, `Dialog.Overlay`, and `Dialog.Close` into a simpler project-specific API
- Style all Dialog parts exclusively through global CSS using `data-state` attribute selectors for open/close animations (e.g., `.game-modal__overlay[data-state="open"]`)
- Follow the existing BEM-lite naming convention established in the CSS migration (component prefix + element, e.g., `.game-modal__content`, `.game-modal__title`)
- Keep accessibility defaults intact -- do not suppress or override Radix's built-in ARIA attributes, focus management, or keyboard handlers
- Use `Dialog.Title` and `Dialog.Description` to ensure every modal instance has proper accessible labeling

## Related Information

- [CSS Modules to Global CSS Migration Design Doc](../design/css-modules-to-global-postcss.md) -- establishes the PostCSS + global CSS + BEM-lite styling approach that this ADR aligns with
- [ADR-001: Procedural Island Map Generation](adr-001-map-generation-architecture.md) -- precedent for evaluating library dependencies by bundle size and TypeScript support
- [ADR-002: Player Authentication with NextAuth.js v5](adr-002-nextauth-authentication.md) -- precedent for documenting React 19 / Next.js 16 compatibility constraints

## References

- [Radix UI Dialog Documentation](https://www.radix-ui.com/primitives/docs/components/dialog) - Official Dialog primitive API, accessibility features, and usage examples
- [Radix UI Primitives Releases](https://www.radix-ui.com/primitives/docs/overview/releases) - Unified package release notes and React 19 compatibility
- [radix-ui on npm](https://www.npmjs.com/package/radix-ui) - Unified package providing tree-shakable access to all Radix primitives
- [WAI-ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) - The accessibility pattern that Radix Dialog implements
- [Base UI (MUI)](https://github.com/mui/base-ui) - Alternative headless library evaluated and rejected
- [shadcn/ui](https://ui.shadcn.com/) - Tailwind-based component system evaluated and rejected due to Tailwind dependency

## Date

2026-02-15
