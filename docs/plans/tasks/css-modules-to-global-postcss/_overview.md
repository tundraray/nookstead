# Overall Design Document: CSS Modules to Global CSS with PostCSS Migration

Generation Date: 2026-02-14
Target Plan Document: css-modules-to-global-postcss.md

## Project Overview

### Purpose and Goals

Migrate the Nookstead game client from CSS Modules to a single global stylesheet with PostCSS compilation. The goal is to consolidate scattered styles, remove module import boilerplate, enable CSS nesting, and clean up Nx boilerplate from global.css.

### Background and Context

The project currently uses CSS Modules for component styling, but with only ~15 UI components and no class name collision risk, CSS Modules add unnecessary indirection. The global.css file contains ~502 lines of unused Nx starter template CSS. This work consolidates all styles into a single file with CSS nesting via postcss-preset-env.

## Task Division Design

### Division Policy

**Approach**: Vertical slice (atomic migration) -- all changes happen together since CSS Modules and global CSS cannot be mixed incrementally for the same component set.

**Rationale**: This is not a feature-by-feature migration. The entire styling system must be replaced atomically because:
1. CSS Modules and global CSS with the same class names cannot coexist
2. Incremental migration would require temporary class renaming, adding complexity
3. The component set is small (11 files), making atomic migration feasible

**Verifiability Level Distribution**:
- Phase 1 (PostCSS Setup): **L3** (Build Success) -- verify PostCSS pipeline works
- Phase 2 (TSX Migration): **L2** (Test Operation) -- verify type checking passes
- Phase 3 (Cleanup): **L3** (Build Success) -- verify no dangling imports
- Phase 4 (Quality Assurance): **L1** (Functional Operation) -- verify visual rendering

### Inter-task Relationship Map

```
Task 1: Install postcss-preset-env → Deliverable: package.json update
  ↓
Task 2: Create postcss.config.js → Deliverable: apps/game/postcss.config.js
  ↓
Task 3: Rewrite global.css → Deliverable: apps/game/src/app/global.css
  ↓ (parallel after Task 3)
Task 4a: Migrate game components
Task 4b: Migrate HUD components
Task 4c: Migrate page.tsx
  ↓ (all 4a/4b/4c must complete)
Task 5: Delete .module.css files
  ↓
Phase 1 Completion: Verify Phase 1 criteria
  ↓
Phase 4 Completion: Build + visual verification
```

### Interface Change Impact Analysis

| Existing Interface | New Interface | Conversion Required | Corresponding Task |
|-------------------|---------------|-------------------|-------------------|
| `import styles from './X.module.css'` | *(removed)* | Yes | Tasks 4a/4b/4c |
| `styles.className` | `"component__class-name"` | Yes | Tasks 4a/4b/4c |
| `${styles.a} ${styles.b}` | `"component__a component__b"` | Yes | Tasks 4a/4b/4c |
| Next.js default PostCSS | postcss-preset-env | Yes | Task 2 |
| Nx boilerplate in global.css | Game-specific styles | Yes | Task 3 |

### Common Processing Points

**Naming Convention**: BEM-lite with component prefix
- Pattern: `.component-name__element`
- Example: `.clock-panel__content`
- Shared across all TSX updates (Tasks 4a/4b/4c)

**CSS Custom Properties**: Must preserve `--ui-scale` and `--font-pixel` patterns
- Used across all HUD components
- Preserved in Task 3 (global.css rewrite)

**PostCSS Compilation**: Single pipeline for all CSS
- Configured in Task 2
- Processes global.css in all subsequent builds

## Implementation Considerations

### Principles to Maintain Throughout

1. **Visual Pixel-Identity**: All components must render identically to before migration
2. **Preserve Interaction Model**: `pointer-events: none` on HUD overlay + `auto` on interactive elements
3. **Preserve Accessibility**: NineSlicePanel `className` prop passthrough, focus-visible outlines
4. **Atomic Migration**: No intermediate state where some components use modules and others use global CSS

### Risks and Countermeasures

- **Risk**: Class name typo in TSX breaks component styling (no runtime error, just missing styles)
  - **Countermeasure**: Use Design Doc "Naming Convention Mapping" table as authoritative checklist during Tasks 4a/4b/4c. Cross-reference each `styles.xxx` replacement against the table.

- **Risk**: postcss-preset-env version incompatibility with Next.js 16
  - **Countermeasure**: Run `npx nx build game` immediately after Task 2 (PostCSS setup). If build fails, pin a known compatible version.

- **Risk**: CSS nesting compiled incorrectly by postcss-preset-env
  - **Countermeasure**: Verify build output after Task 3 to confirm nesting compiles to flat CSS. postcss-preset-env nesting is well-tested and widely used.

- **Risk**: Global class name collision with future components
  - **Countermeasure**: BEM-lite naming convention with component prefix (e.g., `.clock-panel__content`) prevents collisions. Document convention for future component additions.

- **Risk**: Landing page (page.tsx) loses Nx boilerplate styling
  - **Countermeasure**: This is expected and documented. The landing page is Nx scaffold content to be replaced with the actual game entry point.

### Impact Scope Management

**Allowed Change Scope**:
- All 11 CSS Module files → global.css
- All 11 TSX component files (className updates only)
- PostCSS configuration
- package.json devDependencies

**No-Change Areas**:
- Component logic, props, state, or behavior
- Phaser.js game engine code
- Next.js font loader configuration
- Any file outside `apps/game/src/`
- Layout.tsx (still imports `./global.css` the same way)

### Implementation Order Optimization

**Phase-Based Order** (vertical slice, but with logical build-up):
1. **Foundation** (Tasks 1-2): Install tooling, configure PostCSS
2. **Data Migration** (Task 3): Migrate all styles to global.css
3. **Client Migration** (Tasks 4a/4b/4c): Update all TSX consumers (parallelizable)
4. **Cleanup** (Task 5): Delete unused .module.css files
5. **Verification** (Phase 1 Completion, Phase 4 Completion): Confirm correctness

**Reasoning for Order**:
- PostCSS must be configured before global.css uses nesting syntax
- global.css must contain all styles before .module.css files are deleted
- TSX updates can happen in parallel once global.css is ready
- .module.css deletion must be last to avoid import errors during transition

## Quality Assurance

### Phase Completion Verification

**Phase 1 Completion** (after Task 3):
- [ ] `postcss-preset-env` listed in root `package.json` devDependencies
- [ ] `apps/game/postcss.config.js` exists with valid config
- [ ] `apps/game/src/app/global.css` contains all component styles with CSS nesting
- [ ] `npx nx build game` succeeds (verifies PostCSS pipeline works)

**Phase 4 Completion** (final):
- [ ] `npx nx build game` passes
- [ ] `npx nx typecheck game` passes
- [ ] `npx nx lint game` passes
- [ ] All Design Doc acceptance criteria verified
- [ ] Visual inspection confirms pixel-identical rendering

### Rollback Plan

Since this is an atomic change:
- **Rollback method**: `git revert` to the commit before migration
- **Partial rollback**: Not meaningful (all changes are interdependent)

## References

- **Design Doc**: `docs/design/css-modules-to-global-postcss.md` (full technical specification)
- **Work Plan**: `docs/plans/css-modules-to-global-postcss.md` (phase structure and acceptance criteria)
- **Naming Convention Mapping**: Design Doc Section "Naming Convention Mapping" (authoritative class name table)
