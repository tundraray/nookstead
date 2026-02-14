# Phase 3 Completion: Auth Integration

**Phase**: Phase 3 - Auth Integration
**Estimated Duration**: 15 minutes
**Dependencies**: Tasks 3.1, 3.2, 3.3, 3.4
**Task Type**: Verification

## Overview

Verify that authentication is fully integrated into the application before proceeding to Phase 4 (Quality Assurance). This checkpoint ensures the auth layer works end-to-end with route protection, session management, and conditional UI rendering.

## Completion Checklist

### Task Completion Status

- [ ] Task 3.1: Create AuthProvider - COMPLETED
- [ ] Task 3.2: Wrap layout.tsx with AuthProvider - COMPLETED
- [ ] Task 3.3: Create proxy.ts - COMPLETED
- [ ] Task 3.4: Add authenticated state to landing page - COMPLETED

### Deliverables Verification

Verify the following files exist and contain expected content:

- [ ] `apps/game/src/components/auth/AuthProvider.tsx` - SessionProvider wrapper
- [ ] `apps/game/src/app/layout.tsx` - Wrapped with AuthProvider
- [ ] `apps/game/src/proxy.ts` - Route protection with session cookie check
- [ ] `apps/game/src/app/page.tsx` - Conditional rendering based on session state

## E2E Verification Procedures

Follow these procedures exactly as specified in the Work Plan:

### Integration Point 1: Auth Configuration to Route Handler

**Purpose**: Verify NextAuth API endpoints are working

Navigate to `http://localhost:3000/api/auth/providers`

**Expected result**: JSON response listing two providers:

```json
{
  "google": {
    "id": "google",
    "name": "Google",
    "type": "oidc"
  },
  "discord": {
    "id": "discord",
    "name": "Discord",
    "type": "oidc"
  }
}
```

**If this fails**: Check that Task 1.2 (auth.ts) and Task 1.3 (route handler) were completed correctly.

### Integration Point 2: Proxy to Auth Session

**Purpose**: Verify route protection redirects unauthenticated users

**Test 1: Unauthenticated access to /game**
1. Open an incognito/private browser window (no session cookie)
2. Navigate directly to `http://localhost:3000/game`
3. **Expected**: Immediate redirect to `http://localhost:3000/`

**Test 2: Authenticated access to /game** (requires OAuth setup)
1. Log in via landing page (see Integration Point 3)
2. After login, should redirect to `/game`
3. **Expected**: Game page loads normally

**If Test 1 fails** (no redirect): Check proxy.ts (Task 3.3) is correctly detecting session cookies.

**If Test 2 fails** (redirect even when authenticated): Verify session cookie is being set after OAuth flow.

### Integration Point 3: AuthProvider to Landing Page

**Purpose**: Verify OAuth login buttons trigger authentication flow

**Test 1: Click "Sign in with Google" button**
1. On landing page (`/`), click "Sign in with Google"
2. **Expected**: One of two outcomes:
   - If OAuth credentials are configured: Redirect to Google OAuth consent screen
   - If OAuth credentials NOT configured: Error page or redirect to NextAuth error page

**Test 2: Click "Sign in with Discord" button**
1. On landing page (`/`), click "Sign in with Discord"
2. **Expected**: One of two outcomes:
   - If OAuth credentials are configured: Redirect to Discord OAuth authorization screen
   - If OAuth credentials NOT configured: Error page or redirect to NextAuth error page

**Note**: It's OK if OAuth doesn't fully work yet (credentials not configured). The important verification is that clicking the buttons initiates the NextAuth flow (redirects away from landing page).

### Integration Point 4: Landing Page Session Check

**Purpose**: Verify authenticated users see "Play" button instead of login buttons

**Test: Authenticated landing page**
1. Complete OAuth login (requires real OAuth credentials in `.env.local`)
2. After successful login and redirect to `/game`, navigate back to `/`
3. **Expected**:
   - Welcome message appears: "Welcome back, [Your Name]!"
   - Green "Play" button is visible
   - Login buttons (Google, Discord) are NOT visible

**If this fails**: Check that Task 3.4 conditional rendering is correct and `await auth()` is being called.

### Integration Point 5: AuthProvider to Client Components

**Purpose**: Verify SessionProvider is available throughout the app

In browser console (while on landing page):

```javascript
// This is a manual check - SessionProvider should be in the React tree
// No specific test needed unless you add a component using useSession()
```

**Expected**: No errors about missing SessionProvider.

## Phase Completion Criteria

All of the following must be true:

- [ ] `AuthProvider` wraps all pages via `layout.tsx`
- [ ] `useSession()` is available in client components throughout the app
- [ ] Unauthenticated requests to `/game` redirect to `/` (proxy.ts working)
- [ ] Authenticated requests to `/game` pass through to the game page
- [ ] Landing page shows "Play" button when session is active
- [ ] Landing page shows login buttons when no session is active
- [ ] `/api/auth/*` routes are not intercepted by proxy
- [ ] OAuth button clicks initiate NextAuth flow (redirect away from page)
- [ ] `npx nx build game` succeeds

## Comprehensive Integration Test Flow

**Complete user journey** (requires OAuth credentials):

1. **Start unauthenticated**:
   - Open incognito window
   - Navigate to `/`
   - See logo, tagline, login buttons

2. **Attempt to access protected route**:
   - Navigate to `/game`
   - Redirect to `/`

3. **Initiate OAuth flow**:
   - Click "Sign in with Google" (or Discord)
   - Redirect to OAuth provider
   - Complete authentication

4. **Post-authentication**:
   - Redirect to `/game` (callbackUrl from LoginButton)
   - Game page loads

5. **Return to landing page**:
   - Navigate to `/`
   - See welcome message and "Play" button
   - Login buttons are hidden

6. **Session persistence**:
   - Refresh `/game`
   - Should remain on game page (not redirect)
   - Session persists across refreshes

## Next Steps

After verifying all criteria above:

1. Proceed to Phase 4: Quality Assurance (Tasks 4.1 - 4.4)
2. Phase 4 will update tests, run quality checks, and perform full manual OAuth testing
3. Note that Phase 4 Task 4.4 requires real OAuth credentials for complete end-to-end testing

## Rollback

If Phase 3 verification fails and cannot be resolved:

1. Review each task's rollback procedure (Tasks 3.1, 3.2, 3.3, 3.4)
2. Remove all Phase 3 deliverables
3. Re-execute Phase 3 tasks sequentially
4. Do NOT proceed to Phase 4 until all Phase 3 criteria are satisfied

## Notes

- Full OAuth testing requires real credentials in `.env.local` (Google Cloud Console + Discord Developer Portal)
- Structural verification (redirects, API endpoints) works without OAuth credentials
- If OAuth credentials are not configured, you can verify the flow initiates (redirect happens) even if it errors
- Session cookie naming: `authjs.session-token` (dev) or `__Secure-authjs.session-token` (prod)
- The `authorized` callback in auth.ts is not functional; proxy.ts is the working route protection mechanism
