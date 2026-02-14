# Task 3.4: Add Authenticated State to Landing Page

**Phase**: Phase 3 - Auth Integration
**Estimated Duration**: 15 minutes
**Dependencies**: Task 2.4 (landing page must exist), Task 3.2 (AuthProvider must be in layout)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Update the landing page to conditionally render based on authentication state. When unauthenticated, show login buttons (current state). When authenticated, show a welcome message and "Play" button linking to `/game`.

## Target Files

### Modified
- `apps/game/src/app/page.tsx` - Add session check and conditional rendering

## Implementation Steps

### TDD Cycle

**RED (Verify current behavior)**:
1. Start dev server: `npx nx dev game`
2. Navigate to `/` (unauthenticated)
3. Should see login buttons (current implementation)
4. If you have an active session, you'll still see login buttons (incorrect - this task fixes it)

**GREEN (Add conditional rendering)**:

### 1. Update page.tsx with session check

Replace `apps/game/src/app/page.tsx` with:

```typescript
import Link from 'next/link';
import { auth } from '@/auth';
import { LoginButton } from '@/components/auth/LoginButton';
import styles from './page.module.css';

export default async function Page() {
  // Server-side session check
  const session = await auth();

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

      {/* Conditional rendering based on authentication state */}
      {session ? (
        // Authenticated view
        <div className={styles.actions}>
          <p className={styles.welcome}>
            Welcome back, {session.user?.name || 'Player'}!
          </p>
          <Link href="/game" className={styles.playButton}>
            Play
          </Link>
        </div>
      ) : (
        // Unauthenticated view
        <div className={styles.actions}>
          <LoginButton provider="google" />
          <LoginButton provider="discord" />
        </div>
      )}
    </main>
  );
}
```

### 2. Add welcome message styles to page.module.css

The `playButton` styles already exist from Task 2.4. Add the welcome message styles:

Open `apps/game/src/app/page.module.css` and add:

```css
/* Welcome message (authenticated state) */
.welcome {
  position: relative;
  z-index: 1;
  font-size: clamp(0.875rem, 2vw, 1.125rem);
  color: #e0e0e0;
  text-align: center;
  margin: 0 0 1rem 0;
  line-height: 1.8;
}
```

The `.playButton` styles should already be present from Task 2.4. If not, verify they are included:

```css
/* Play button (for authenticated state) */
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
```

### 3. Verify conditional rendering

After saving, dev server should hot-reload.

**Test 1: Unauthenticated state**:
1. Open incognito window
2. Navigate to `http://localhost:3000/`
3. Should see login buttons (no "Play" button)

**Test 2: Authenticated state** (requires OAuth setup or manual session):
1. Log in via Google or Discord OAuth
2. After successful login, should redirect to `/game`
3. Navigate back to `/`
4. Should see welcome message "Welcome back, [Your Name]!" and green "Play" button
5. Should NOT see login buttons

**REFACTOR**:
- Verify session.user?.name fallback to "Player" works
- Ensure welcome message styling is consistent with theme
- Confirm Play button uses green color (`#4ade80`) as specified

### 4. Verify build succeeds

```bash
npx nx build game
```

Should complete with zero errors.

## Implementation Details

### Server-Side Session Check

```typescript
const session = await auth();
```

This calls the `auth()` function from `@/auth` (created in Task 1.2) server-side to check if the user has an active session.

**Why server-side**:
- Prevents flash of unauthenticated content
- Session state is determined before the page is sent to the client
- More secure than client-side session checking for initial page load

### Conditional Rendering

```typescript
{session ? (
  // Authenticated view
) : (
  // Unauthenticated view
)}
```

Standard React conditional rendering based on session state.

### Session User Data

NextAuth provides `session.user` object with:
- `name` - User's display name from OAuth provider
- `email` - User's email address
- `image` - User's profile picture URL (not used in this task)

We use optional chaining `session.user?.name` to safely access the name property.

### Fallback User Name

```typescript
{session.user?.name || 'Player'}
```

If the OAuth provider doesn't provide a name, use "Player" as fallback.

### Play Button Link

```typescript
<Link href="/game" className={styles.playButton}>
  Play
</Link>
```

Uses Next.js `Link` component for client-side navigation to `/game`. The green pixel art button style is defined in `page.module.css` from Task 2.4.

### Color Choice

Green (`#4ade80`) is used for the "Play" button to indicate "go" / "start game" action. This contrasts with the blue (Google) and purple (Discord) login buttons.

## Acceptance Criteria

- [ ] Landing page imports `auth` from `@/auth`
- [ ] Page component calls `await auth()` server-side
- [ ] Unauthenticated users see login buttons (Google + Discord)
- [ ] Authenticated users see welcome message with their name
- [ ] Authenticated users see green "Play" button linking to `/game`
- [ ] Authenticated users do NOT see login buttons
- [ ] Welcome message falls back to "Player" if name is unavailable
- [ ] `npx nx build game` succeeds
- [ ] No flash of unauthenticated content (session check is server-side)

## Verification Steps

1. Start dev server: `npx nx dev game`

2. **Test unauthenticated view**:
   - Open incognito window
   - Navigate to `/`
   - Verify login buttons are visible
   - Verify "Play" button is NOT visible

3. **Test authenticated view** (requires OAuth setup):
   - Log in via Google or Discord
   - After redirect to `/game`, navigate back to `/`
   - Verify welcome message shows your name
   - Verify green "Play" button is visible
   - Verify login buttons are NOT visible
   - Click "Play" button - should navigate to `/game`

4. Run build: `npx nx build game` - should succeed

## Rollback Procedure

If conditional rendering causes issues:

```bash
git checkout apps/game/src/app/page.tsx apps/game/src/app/page.module.css
npx nx dev game
```

Verify landing page works, then re-attempt the task.

## Notes

- This task completes the authentication integration on the landing page
- The page is an **async server component** (uses `await auth()`)
- Session state is determined server-side, preventing client-side flashing
- The welcome message personalizes the experience using the user's OAuth profile name
- The "Play" button provides a clear call-to-action for authenticated users
- Combined with proxy.ts (Task 3.3), this creates a complete auth flow: landing page → OAuth login → game page
- Future enhancement: Add a "Sign out" button for authenticated users
