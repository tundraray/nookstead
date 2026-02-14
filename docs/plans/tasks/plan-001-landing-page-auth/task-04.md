# Task 2.1: Replace global.css with Pixel Art Dark Theme

**Phase**: Phase 2 - Landing Page UI
**Estimated Duration**: 10 minutes
**Dependencies**: None (independent of Phase 1)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Replace the Nx boilerplate global CSS with a pixel art themed dark mode stylesheet. This establishes the visual foundation for the entire app: dark background, pixel-perfect rendering, and the Press Start 2P font stack.

## Target Files

### Modified
- `apps/game/src/app/global.css` - Complete replacement

## Implementation Steps

### TDD Cycle

**RED (Verify current state)**:
1. Start dev server: `npx nx dev game`
2. Navigate to `/` - should show Nx default light theme
3. Inspect element styles - should see Nx boilerplate CSS

**GREEN (Implement dark theme)**:

### 1. Replace global.css content

Replace the entire content of `apps/game/src/app/global.css` with:

```css
/* Pixel Art Dark Theme - Global Styles */

/* CSS Reset for consistent rendering across browsers */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  /* Press Start 2P loaded via layout.tsx */
  font-family: 'Press Start 2P', monospace;

  /* Dark theme color palette */
  background-color: #0a0a1a;
  color: #e0e0e0;

  /* Disable anti-aliasing for pixel-perfect rendering */
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;

  /* Ensure pixelated rendering for images and canvas */
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}

body {
  min-height: 100vh;
  overflow-x: hidden;
  line-height: 1.6;
}

/* Remove default button styles */
button {
  font-family: inherit;
  cursor: pointer;
}

/* Remove default link underlines */
a {
  color: inherit;
  text-decoration: none;
}

/* Ensure images are responsive by default */
img {
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
}
```

### 2. Verify dev server hot-reload

After saving, the dev server should hot-reload. Navigate to `/` and verify:
- Background is now dark (`#0a0a1a`)
- Text is light (`#e0e0e0`)
- Fonts will appear as fallback `monospace` until Task 2.2 loads Press Start 2P

**REFACTOR**:
- Verify CSS comments are clear
- Ensure no Nx boilerplate CSS remains
- Confirm pixel rendering properties are correct

### 3. Verify game page is not broken

**CRITICAL VERIFICATION**: Navigate to `/game` and verify the Phaser game canvas still renders correctly.

**Why this matters**: The game page uses CSS Modules for its styles. Global CSS changes should not affect it, but we must verify CSS isolation is working.

**Expected result**: Game page renders with no visual regressions.

**If game page breaks**: Review the global CSS for overly broad selectors that might override CSS Modules. The above CSS uses only element selectors and should not conflict.

## Implementation Details

### CSS Reset

The reset ensures consistent rendering across browsers by:
- Setting `box-sizing: border-box` on all elements (padding/border included in width)
- Removing default margins and padding
- Normalizing font rendering

### Dark Theme Palette

- **Background**: `#0a0a1a` - Very dark blue-black (softer than pure black)
- **Text**: `#e0e0e0` - Light gray (easier on eyes than pure white)

These colors are referenced in the Design Doc and will be used by all pixel art UI components.

### Pixel-Perfect Rendering

```css
-webkit-font-smoothing: none;
-moz-osx-font-smoothing: grayscale;
image-rendering: pixelated;
```

These properties disable anti-aliasing and ensure crisp pixel edges for the retro aesthetic.

### Font Fallback

`font-family: 'Press Start 2P', monospace;`

Press Start 2P will be loaded in Task 2.2. Until then, the browser's default monospace font will be used.

## Acceptance Criteria

- [ ] `apps/game/src/app/global.css` contains dark theme reset
- [ ] Background color is `#0a0a1a`
- [ ] Text color is `#e0e0e0`
- [ ] Pixel rendering properties are set (`image-rendering: pixelated`)
- [ ] Font smoothing is disabled
- [ ] Landing page (`/`) displays with dark theme
- [ ] Game page (`/game`) still renders correctly (no CSS regressions)
- [ ] `npx nx build game` succeeds

## Verification Steps

1. Start dev server: `npx nx dev game`
2. Navigate to `/` - verify dark background and light text
3. Navigate to `/game` - verify Phaser canvas renders correctly
4. Run build: `npx nx build game` - should succeed
5. Inspect element in browser DevTools - verify `html` has correct background color and font properties

## Rollback Procedure

If global CSS causes issues, restore Nx default:

```bash
git checkout apps/game/src/app/global.css
npx nx dev game
```

Verify landing page and game page both work, then re-attempt the task.

## Notes

- This task is independent of auth tasks (1.1, 1.2, 1.3) and can start immediately
- Font will appear as monospace fallback until Task 2.2 adds Press Start 2P
- Global CSS applies to ALL pages, but game page uses CSS Modules and should be isolated
- The dark theme will be used by LoginButton (Task 2.3) and landing page (Task 2.4)
