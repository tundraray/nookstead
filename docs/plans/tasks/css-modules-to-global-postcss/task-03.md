# Task 3: Rewrite global.css

## Overview

Replace the entire contents of `global.css` (currently ~502 lines of Nx boilerplate) with a consolidated game UI stylesheet containing all component styles from the 11 CSS Module files. Use CSS nesting syntax for component sub-elements.

## Related Documents

- **Work Plan**: Phase 1, Task 3
- **Design Doc**: Section "3. Complete Global CSS" (full CSS provided)

## Prerequisites

- Task 2 must be completed (`postcss.config.js` created and Next.js build succeeds)

## Target Files

- `D:/git/github/nookstead/main/apps/game/src/app/global.css` (complete rewrite)

## Implementation Steps

### Step 1: Replace global.css contents

Replace the **entire contents** of `D:/git/github/nookstead/main/apps/game/src/app/global.css` with the CSS provided in Design Doc Section "3. Complete Global CSS".

The new CSS should contain the following sections in order:

1. **Section 1: CSS Reset** (lines 1-41)
   - Minimal reset for game UI
   - `box-sizing: border-box`, margin/padding reset

2. **Section 2: Game App Wrapper** (lines 43-53)
   - `.game-app` class for full-viewport container

3. **Section 3: Loading Screen** (lines 55-109)
   - `.loading-screen` with nested sub-elements
   - `@keyframes loading` animation

4. **Section 4: HUD System** (lines 111-917)
   - `.hud` container with `--ui-scale` custom property
   - Nine-Slice Panel (`.nine-slice`)
   - Clock Panel (`.clock-panel`)
   - Currency Display (`.currency-display`)
   - Menu Button (`.menu-button`)
   - Energy Bar (`.energy-bar` + `@media (prefers-reduced-motion)`)
   - Hotbar (`.hotbar`)
   - Hotbar Slot (`.hotbar-slot`)

### Step 2: Verify CSS structure

**Critical elements to preserve**:
- CSS custom properties: `--ui-scale`, `--font-pixel`
- `image-rendering: pixelated` declarations (for pixel art)
- `pointer-events: none` on HUD overlay + `auto` on interactive elements
- `@keyframes loading` animation
- `@media (prefers-reduced-motion: reduce)` query for energy bar
- CSS nesting syntax for all component sub-elements

### Step 3: Verify build succeeds

Run build to confirm PostCSS compiles the nesting syntax correctly:

```bash
npx nx build game
```

**Expected behavior**:
- Build succeeds (exit code 0)
- No CSS syntax errors
- PostCSS compiles CSS nesting to flat selectors

If build fails:
- Check for CSS syntax errors in global.css
- Verify postcss.config.js exists and is correct (Task 2)
- Verify postcss-preset-env is installed (Task 1)

### Step 4: Verify nesting compilation

Inspect the build output to confirm CSS nesting was compiled:

```bash
# Check for compiled CSS in build output
# (actual path may vary based on Next.js build structure)
ls .next/static/css/*.css
```

The compiled CSS should contain flat selectors (e.g., `.loading-screen .loading-screen__container`) instead of nested syntax.

## Completion Criteria

- [ ] `global.css` contains all 9 sections from Design Doc
- [ ] CSS custom properties `--ui-scale` and `--font-pixel` preserved
- [ ] `image-rendering: pixelated` preserved
- [ ] `pointer-events` interaction model preserved
- [ ] `@keyframes loading` animation present
- [ ] `@media (prefers-reduced-motion)` query present
- [ ] All component styles use CSS nesting syntax
- [ ] `npx nx build game` succeeds (PostCSS compiles nesting correctly)

## Verification Procedure

1. Replace entire `apps/game/src/app/global.css` with content from Design Doc Section "3. Complete Global CSS"
2. Verify file contains all required sections:
   ```bash
   grep "Section 1: CSS Reset" apps/game/src/app/global.css
   grep "Section 2: Game App Wrapper" apps/game/src/app/global.css
   grep "Section 3: Loading Screen" apps/game/src/app/global.css
   grep "Section 4: HUD System" apps/game/src/app/global.css
   ```
3. Verify critical patterns:
   ```bash
   grep "var(--ui-scale)" apps/game/src/app/global.css
   grep "image-rendering: pixelated" apps/game/src/app/global.css
   grep "@keyframes loading" apps/game/src/app/global.css
   grep "prefers-reduced-motion" apps/game/src/app/global.css
   ```
4. Run build:
   ```bash
   npx nx build game
   ```
5. Expected: Build succeeds with no CSS errors

## Notes

- This file is 917 lines (vs. 502 lines of Nx boilerplate)
- All Nx boilerplate is removed -- only game UI styles remain
- CSS nesting syntax is used for all component sub-elements (e.g., `.clock-panel { & .clock-panel__content { ... } }`)
- The full CSS is provided in the Design Doc -- copy it exactly
- This is a prerequisite for Tasks 4a/4b/4c (TSX component migration)
