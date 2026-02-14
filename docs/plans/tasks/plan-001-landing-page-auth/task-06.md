# Task 2.3: Create LoginButton Component

**Phase**: Phase 2 - Landing Page UI
**Estimated Duration**: 20 minutes
**Dependencies**: Task 1.1 (next-auth must be installed for imports)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Create a reusable client component for OAuth login buttons that handles Google and Discord sign-in flows. The component includes loading states, accessibility features, and pixel art styling that matches the dark theme.

## Target Files

### New Files
- `apps/game/src/components/auth/LoginButton.tsx` - Login button component
- `apps/game/src/components/auth/LoginButton.module.css` - Component styles

## Implementation Steps

### TDD Cycle

**RED (Write failing test first)**:

Since this is a new component, we'll verify it structurally by importing it (full test suite update in Task 4.1).

**GREEN (Implement component)**:

### 1. Create directory structure

```bash
mkdir -p apps/game/src/components/auth
```

### 2. Create LoginButton.tsx

Create `apps/game/src/components/auth/LoginButton.tsx`:

```typescript
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import styles from './LoginButton.module.css';

type LoginButtonProps = {
  provider: 'google' | 'discord';
};

export function LoginButton({ provider }: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl: '/game' });
    } catch (error) {
      console.error(`Failed to sign in with ${provider}:`, error);
      setIsLoading(false);
    }
  };

  const providerNames = {
    google: 'Google',
    discord: 'Discord',
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`${styles.button} ${styles[provider]}`}
      aria-label={`Sign in with ${providerNames[provider]}`}
    >
      {isLoading ? 'Redirecting...' : `Sign in with ${providerNames[provider]}`}
    </button>
  );
}
```

### 3. Create LoginButton.module.css

Create `apps/game/src/components/auth/LoginButton.module.css`:

```css
/* LoginButton Component Styles */

.button {
  /* Typography */
  font-family: 'Press Start 2P', monospace;
  font-size: 0.875rem; /* 14px */
  line-height: 1.2;
  text-align: center;

  /* Layout */
  display: block;
  width: 100%;
  min-height: 44px; /* WCAG touch target minimum */
  padding: 12px 16px;

  /* Pixel art borders */
  border: 3px solid currentColor;
  background-color: transparent;
  color: #e0e0e0;

  /* Interaction */
  cursor: pointer;
  transition: all 0.2s ease;

  /* Remove default button styles */
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

.button:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 currentColor;
}

.button:active:not(:disabled) {
  transform: translate(0, 0);
  box-shadow: 2px 2px 0 currentColor;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Provider-specific colors */
.google {
  border-color: #4285f4;
  color: #4285f4;
}

.google:hover:not(:disabled) {
  background-color: rgba(66, 133, 244, 0.1);
  box-shadow: 4px 4px 0 #4285f4;
}

.discord {
  border-color: #5865f2;
  color: #5865f2;
}

.discord:hover:not(:disabled) {
  background-color: rgba(88, 101, 242, 0.1);
  box-shadow: 4px 4px 0 #5865f2;
}

/* Responsive font sizing */
@media (min-width: 768px) {
  .button {
    font-size: 1rem; /* 16px on larger screens */
  }
}
```

### 4. Verify component renders

To quickly verify the component without full integration:

Create a temporary test in the console or add to page.tsx temporarily:

```typescript
import { LoginButton } from '@/components/auth/LoginButton';

// In page.tsx temporarily:
<LoginButton provider="google" />
<LoginButton provider="discord" />
```

Navigate to `/` and verify:
- Buttons render with pixel art borders
- Hover effects work (translate + box shadow)
- Click shows "Redirecting..." text
- Provider colors are correct (Google blue, Discord purple)

**REFACTOR**:
- Verify accessibility: `aria-label` is descriptive
- Ensure loading state prevents double-clicks (`disabled` during redirect)
- Confirm pixel art aesthetic matches Design Doc

### 5. Verify build succeeds

```bash
npx nx typecheck game
npx nx build game
```

Both should succeed with zero errors.

## Implementation Details

### Client Component Directive

`'use client'` is required because:
- Uses React hooks (`useState`)
- Uses NextAuth's `signIn` from `next-auth/react` (client-side only)
- Handles user interactions (onClick)

### Loading State

```typescript
const [isLoading, setIsLoading] = useState(false);
```

Prevents double-clicks during OAuth redirect. Once `signIn()` is called, the user is redirected to the provider's OAuth page, so the component won't unmount. However, if the redirect fails, we reset loading state.

### Error Handling

```typescript
catch (error) {
  console.error(`Failed to sign in with ${provider}:`, error);
  setIsLoading(false);
}
```

Logs errors for debugging and resets button state. In production, you might show a toast notification instead.

### Callback URL

`callbackUrl: '/game'` tells NextAuth to redirect to `/game` after successful authentication. This is the desired behavior: user logs in and immediately goes to the game page.

### Accessibility

- `min-height: 44px` - WCAG 2.1 Level AA touch target minimum
- `aria-label` - Descriptive label for screen readers
- `:disabled` state - Prevents interaction during loading

### Pixel Art Aesthetics

- 3px solid borders with provider colors
- Hover effect: translate up-left + box shadow (classic pixel button effect)
- Active (pressed) effect: reduce shadow
- Transparent background with subtle color overlay on hover

### Provider Colors

- **Google**: `#4285f4` (Google Blue)
- **Discord**: `#5865f2` (Discord Blurple)

These are the official brand colors.

## Acceptance Criteria

- [ ] `LoginButton.tsx` exports `LoginButton` component
- [ ] Component accepts `provider` prop (`'google' | 'discord'`)
- [ ] Component is marked `'use client'`
- [ ] Clicking button calls `signIn(provider, { callbackUrl: '/game' })`
- [ ] Loading state shows "Redirecting..." text and disables button
- [ ] Button has 44px minimum height for touch targets
- [ ] Pixel art border styling with provider-specific colors
- [ ] Hover effect works (translate + box shadow)
- [ ] CSS Module scoped styles prevent global conflicts
- [ ] `npx nx typecheck game` and `npx nx build game` succeed

## Verification Steps

1. Import component in a test location (or wait for Task 2.4 to use it)
2. Render both `<LoginButton provider="google" />` and `<LoginButton provider="discord" />`
3. Verify visual appearance matches pixel art theme
4. Test hover effect (button moves up-left, shadow appears)
5. Click button - verify text changes to "Redirecting..."
6. Run typecheck and build - should pass

## Rollback Procedure

If component causes issues:

```bash
rm -rf apps/game/src/components/auth
npx nx build game
```

## Notes

- This component will be used in Task 2.4 (landing page)
- OAuth redirect won't work until Task 3.x (auth integration), but button can be rendered and styled
- The component is fully self-contained with CSS Modules for styling
- Error handling logs to console; consider adding user-facing error messages in future iterations
- Component is intentionally simple; no icons (keeping it text-only for MVP)
