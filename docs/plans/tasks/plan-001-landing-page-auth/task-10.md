# Task 3.3: Create proxy.ts for Route Protection

**Phase**: Phase 3 - Auth Integration
**Estimated Duration**: 15 minutes
**Dependencies**: Task 1.2 (auth.ts session cookie naming must be defined)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Create the Next.js 16 proxy file that intercepts requests to protected routes (e.g., `/game`) and redirects unauthenticated users to the landing page. This uses manual session cookie checking for Next.js 16 compatibility.

## Target Files

### New Files
- `apps/game/src/proxy.ts` - Route protection logic

## Implementation Steps

### TDD Cycle

**RED (Verify route is currently unprotected)**:
1. Start dev server: `npx nx dev game`
2. Open incognito/private browser window (no session cookie)
3. Navigate directly to `http://localhost:3000/game`
4. Should load the game page (currently unprotected)

**GREEN (Implement route protection)**:

### 1. Create proxy.ts

Create `apps/game/src/proxy.ts` in the app root (NOT in `app/` directory):

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /game routes
  if (pathname.startsWith('/game')) {
    // Check for NextAuth session cookie
    // Cookie name is 'authjs.session-token' in development (HTTP)
    // Cookie name is '__Secure-authjs.session-token' in production (HTTPS)
    const sessionCookie =
      request.cookies.get('authjs.session-token') ||
      request.cookies.get('__Secure-authjs.session-token');

    if (!sessionCookie) {
      // No session cookie found - redirect to landing page
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Allow request to proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt (public files)
     * - Static files (e.g., images, fonts)
     */
    '/((?!api/auth|_next|favicon.ico|robots.txt|.*\\..*$).*)',
  ],
};
```

### 2. Verify route protection works

After saving, restart dev server (proxy.ts changes require restart):

```bash
# Stop dev server (Ctrl+C)
npx nx dev game
```

**Test 1: Unauthenticated access to /game**:
1. Open incognito/private browser window
2. Navigate to `http://localhost:3000/game`
3. Should redirect to `http://localhost:3000/` (landing page)

**Test 2: Authenticated access to /game** (requires OAuth setup or manual cookie):
1. If you have OAuth credentials configured, log in via the landing page
2. After successful login, you should be redirected to `/game`
3. Game page should load normally

**Test 3: Unauthenticated access to landing page**:
1. Incognito window, navigate to `http://localhost:3000/`
2. Should load normally (landing page is not protected)

**REFACTOR**:
- Verify cookie names match NextAuth v5 conventions
- Ensure matcher excludes all necessary paths
- Confirm redirect logic is correct

### 3. Verify build succeeds

```bash
npx nx build game
```

Should complete with zero errors.

## Implementation Details

### Why proxy.ts Instead of middleware.ts

Next.js 16 renamed `middleware.ts` to `proxy.ts`. This is the App Router convention for intercepting requests.

**File location**: Must be in `apps/game/src/proxy.ts` (same level as `app/` directory).

### Session Cookie Checking

NextAuth v5 uses different cookie names depending on environment:
- **Development (HTTP)**: `authjs.session-token`
- **Production (HTTPS)**: `__Secure-authjs.session-token`

The `__Secure-` prefix is required by browsers for secure cookies on HTTPS.

We check for both to ensure the proxy works in all environments.

### Why Not Use NextAuth's authorized Callback

The Design Doc and ADR-002 note that NextAuth v5's `authorized` callback and middleware export are incompatible with Next.js 16's `proxy.ts` convention. Manual cookie checking is the recommended approach.

### Matcher Configuration

The `config.matcher` pattern excludes:
- `/api/auth/*` - NextAuth endpoints must not be intercepted
- `/_next/*` - Next.js internal files (chunks, static assets)
- `favicon.ico`, `robots.txt` - Public static files
- `.*\\..*$` - Any file with an extension (images, fonts, etc.)

This ensures the proxy only runs on page routes.

### Protected Routes

Currently only `/game` is protected. The `if (pathname.startsWith('/game'))` check can be expanded to protect other routes in the future.

**Example for multiple protected routes**:
```typescript
const protectedPaths = ['/game', '/profile', '/settings'];
if (protectedPaths.some(path => pathname.startsWith(path))) {
  // Check session...
}
```

### Redirect Logic

```typescript
const url = request.nextUrl.clone();
url.pathname = '/';
return NextResponse.redirect(url);
```

Clones the current URL and changes the pathname to `/` (landing page), then returns a redirect response.

## Acceptance Criteria

- [ ] `apps/game/src/proxy.ts` exists
- [ ] Proxy function checks for NextAuth session cookies (both development and production names)
- [ ] Unauthenticated requests to `/game` redirect to `/`
- [ ] Authenticated requests to `/game` pass through
- [ ] Landing page (`/`) is accessible without authentication
- [ ] API routes (`/api/auth/*`) are not intercepted
- [ ] `npx nx build game` succeeds
- [ ] Matcher excludes static files, Next.js internals, and auth endpoints

## Verification Steps

**Manual Testing** (requires dev server restart for proxy changes):

1. Stop and restart dev server: `npx nx dev game`

2. **Test unauthenticated /game access**:
   - Open incognito window
   - Navigate to `http://localhost:3000/game`
   - Should redirect to `http://localhost:3000/`

3. **Test landing page access**:
   - Incognito window
   - Navigate to `http://localhost:3000/`
   - Should load normally (not redirected)

4. **Test auth endpoints**:
   - Incognito window
   - Navigate to `http://localhost:3000/api/auth/providers`
   - Should return JSON (not redirected)

5. **Test authenticated access** (optional, requires OAuth setup):
   - Log in via landing page
   - After successful OAuth, should redirect to `/game`
   - Game page should load

6. Run build: `npx nx build game` - should succeed

## Rollback Procedure

If proxy causes issues:

```bash
rm apps/game/src/proxy.ts
npx nx dev game
```

Routes will be unprotected again.

## Notes

- This task implements the primary defense for route protection (ADR-002 specifies proxy.ts as the route protection mechanism)
- The `authorized` callback in auth.ts (Task 1.2) is documented but not functional; this proxy.ts is the working implementation
- Proxy runs on every request that matches the config pattern (lightweight overhead)
- Session cookie is encrypted and signed by NextAuth; we only check for presence, not decode it
- Future enhancement: Decode and validate the JWT token instead of just checking cookie presence
- Proxy changes require dev server restart (unlike other hot-reload changes)
