# Task 2.4: Create Landing Page with Pixel Art Design

**Phase**: Phase 2 - Landing Page UI
**Estimated Duration**: 25 minutes
**Dependencies**: Task 2.2 (font + metadata), Task 2.3 (LoginButton component)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Replace the Nx boilerplate landing page with the pixel art themed Nookstead entry point. This includes the animated logo, tagline, twinkling star background, and login buttons. The authenticated view (Play button) will be added in Task 3.4.

## Target Files

### Modified (Replaced)
- `apps/game/src/app/page.tsx` - Landing page component
- `apps/game/src/app/page.module.css` - Landing page styles

## Implementation Steps

### TDD Cycle

**RED (Verify current boilerplate)**:
1. Start dev server: `npx nx dev game`
2. Navigate to `/` - should show Nx boilerplate content

**GREEN (Implement pixel art landing page)**:

### 1. Replace page.tsx

Replace `apps/game/src/app/page.tsx` with:

```typescript
import { LoginButton } from '@/components/auth/LoginButton';
import styles from './page.module.css';

export default async function Page() {
  // Unauthenticated view only for now
  // Task 3.4 will add auth state check and conditional rendering

  return (
    <main className={styles.container}>
      {/* Animated star background */}
      <div className={styles.stars} aria-hidden="true"></div>

      {/* Logo with glow animation */}
      <h1 className={styles.logo}>NOOKSTEAD</h1>

      {/* Tagline */}
      <p className={styles.tagline}>
        A 2D pixel art MMO life sim with AI-powered NPCs
      </p>

      {/* Login buttons */}
      <div className={styles.actions}>
        <LoginButton provider="google" />
        <LoginButton provider="discord" />
      </div>
    </main>
  );
}
```

### 2. Replace page.module.css

Replace `apps/game/src/app/page.module.css` with:

```css
/* Landing Page Styles */

.container {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 2rem 1rem;
  overflow: hidden;
  background-color: #0a0a1a;
}

/* Animated star background */
.stars {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;

  /* Create twinkling stars using box-shadow */
  background: transparent;
  box-shadow:
    100px 200px 2px 1px rgba(255, 255, 255, 0.8),
    300px 400px 2px 1px rgba(255, 255, 255, 0.6),
    500px 100px 2px 1px rgba(255, 255, 255, 0.7),
    700px 300px 2px 1px rgba(255, 255, 255, 0.5),
    900px 500px 2px 1px rgba(255, 255, 255, 0.9),
    200px 600px 2px 1px rgba(255, 255, 255, 0.6),
    400px 800px 2px 1px rgba(255, 255, 255, 0.7),
    600px 200px 2px 1px rgba(255, 255, 255, 0.5),
    800px 700px 2px 1px rgba(255, 255, 255, 0.8),
    1000px 400px 2px 1px rgba(255, 255, 255, 0.6);

  animation: twinkle 5s infinite alternate;
}

@keyframes twinkle {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}

/* Logo */
.logo {
  position: relative;
  z-index: 1;
  font-family: 'Press Start 2P', monospace;
  font-size: clamp(1.5rem, 5vw, 3rem);
  color: #e0e0e0;
  text-align: center;
  margin: 0;
  line-height: 1.4;
  animation: glow 3s ease-in-out infinite alternate;
}

@keyframes glow {
  from {
    text-shadow:
      0 0 10px rgba(224, 224, 224, 0.8),
      0 0 20px rgba(224, 224, 224, 0.6),
      0 0 30px rgba(224, 224, 224, 0.4);
  }
  to {
    text-shadow:
      0 0 20px rgba(224, 224, 224, 1),
      0 0 30px rgba(224, 224, 224, 0.8),
      0 0 40px rgba(224, 224, 224, 0.6);
  }
}

/* Tagline */
.tagline {
  position: relative;
  z-index: 1;
  font-size: clamp(0.75rem, 2vw, 1rem);
  color: #a0a0a0;
  text-align: center;
  max-width: 600px;
  line-height: 1.8;
  margin: 0;
}

/* Action buttons container */
.actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 300px;
}

/* Play button (for authenticated state, added in Task 3.4) */
.playButton {
  display: inline-block;
  font-family: 'Press Start 2P', monospace;
  font-size: 1.25rem;
  color: #4ade80;
  border: 3px solid #4ade80;
  background-color: transparent;
  padding: 16px 32px;
  text-decoration: none;
  text-align: center;
  transition: all 0.2s ease;
  min-height: 44px;
}

.playButton:hover {
  background-color: rgba(74, 222, 128, 0.1);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 #4ade80;
}

.playButton:active {
  transform: translate(0, 0);
  box-shadow: 2px 2px 0 #4ade80;
}

/* Responsive adjustments */
@media (min-width: 768px) {
  .container {
    gap: 3rem;
    padding: 3rem 2rem;
  }

  .actions {
    max-width: 400px;
  }

  .tagline {
    font-size: 1rem;
  }
}

@media (max-width: 360px) {
  .logo {
    font-size: 1.25rem;
  }

  .tagline {
    font-size: 0.7rem;
  }
}
```

### 3. Verify visual rendering

After saving, dev server should hot-reload. Navigate to `/`:

**Expected visual result**:
- Dark background with twinkling stars
- "NOOKSTEAD" logo with glow animation
- Tagline below logo
- Two login buttons (Google and Discord) with pixel art styling
- No horizontal scrolling on mobile (test at 360px viewport)

**REFACTOR**:
- Verify responsive font sizing with `clamp()` works at different viewports
- Ensure animations are smooth (glow on logo, twinkle on stars)
- Check accessibility: star background has `aria-hidden="true"`
- Confirm layout is centered and visually balanced

### 4. Test responsive design

Open browser DevTools, enable responsive mode:

**360px (mobile)**:
- No horizontal scrolling
- Logo scales down appropriately
- Buttons stack vertically

**768px (tablet)**:
- Larger fonts via media queries
- More spacing (gap increases)

**1440px (desktop)**:
- Maximum font sizes applied
- Content remains centered

### 5. Verify build succeeds

```bash
npx nx build game
```

Should complete with zero errors.

## Implementation Details

### Server Component

This component is an **async server component** (no `'use client'` directive). In Task 3.4, we'll add `await auth()` to check session state server-side.

For now, it only renders the unauthenticated view (login buttons).

### Animated Star Background

The `.stars` div uses `box-shadow` to create multiple small white dots at specific positions. The `twinkle` animation fades opacity in and out for a twinkling effect.

**Why box-shadow**: A CSS-only solution that doesn't require images or SVG. Each shadow creates one star.

### Logo Glow Animation

The `glow` keyframe animates `text-shadow` to create a pulsing effect. The logo appears to glow brighter and dimmer over 3 seconds.

### Responsive Typography

`clamp(min, preferred, max)` creates fluid font sizing that scales with viewport width:
- Logo: `clamp(1.5rem, 5vw, 3rem)` - Between 24px and 48px
- Tagline: `clamp(0.75rem, 2vw, 1rem)` - Between 12px and 16px

### Play Button Styles

The `.playButton` class is defined but not used yet. Task 3.4 will conditionally render it for authenticated users.

**Color**: Green (`#4ade80`) to indicate "go" / "start game"

### Accessibility

- Star background: `aria-hidden="true"` (decorative only)
- Semantic HTML: `<h1>` for logo, `<p>` for tagline
- Touch targets: Login buttons have 44px minimum height (from LoginButton component)

## Acceptance Criteria

- [ ] Landing page renders with pixel art logo and glow animation
- [ ] Tagline appears below logo
- [ ] Animated star background is visible
- [ ] Google and Discord login buttons render correctly
- [ ] Responsive design works at 360px, 768px, 1440px viewports
- [ ] No horizontal scrolling at 360px width
- [ ] `clamp()` font sizing scales appropriately
- [ ] Logo glow animation runs smoothly
- [ ] Star twinkle animation runs smoothly
- [ ] `npx nx build game` succeeds

## Verification Steps

1. Start dev server: `npx nx dev game`
2. Navigate to `/`
3. Verify logo, tagline, stars, and buttons render
4. Open DevTools → Responsive mode
   - Test at 360px width - no horizontal scroll
   - Test at 768px width - fonts scale up
   - Test at 1440px width - max sizes applied
5. Verify animations:
   - Logo glow pulses smoothly
   - Stars twinkle (subtle opacity change)
6. Hover over login buttons - verify pixel art hover effects work
7. Run build: `npx nx build game` - should succeed

## Rollback Procedure

If landing page causes issues:

```bash
git checkout apps/game/src/app/page.tsx apps/game/src/app/page.module.css
npx nx dev game
```

## Notes

- This task only implements the **unauthenticated view** (login buttons visible)
- Task 3.4 will add conditional rendering: if user is authenticated, hide login buttons and show "Play" button
- The page component is async because Task 3.4 will call `await auth()` server-side
- All styles are scoped via CSS Modules (no global style conflicts)
- Star positions are hard-coded; in future iterations, could be randomized with JavaScript
- Press Start 2P font is loaded globally (Task 2.2), so logo and tagline render in pixel font
