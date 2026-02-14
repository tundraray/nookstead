# Task 1.2: Create auth.ts Configuration

**Phase**: Phase 1 - Authentication Foundation
**Estimated Duration**: 15 minutes
**Dependencies**: Task 1.1 (next-auth must be installed)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Create the centralized NextAuth.js v5 configuration file that defines OAuth providers (Google, Discord), session strategy (JWT with 30-day expiration), and route protection logic. This file exports the core auth primitives used throughout the app.

## Target Files

### New Files
- `apps/game/src/auth.ts` - NextAuth configuration

## Implementation Steps

### TDD Cycle

**RED (Write failing test)**:
Since this is a configuration file, we'll verify it structurally by attempting to import it.

**GREEN (Minimal implementation)**:

### 1. Create auth.ts

Create `apps/game/src/auth.ts` with the following content:

```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },
  pages: {
    signIn: '/', // Custom sign-in page (our landing page)
  },
  callbacks: {
    authorized: async ({ auth }) => {
      // This callback is defined for documentation but may not work with Next.js 16 proxy.ts
      // Actual route protection is handled in proxy.ts via manual session cookie check
      return !!auth;
    },
  },
});
```

### 2. Verify file structure

Check that the file exports the required primitives:
- `handlers` - Object with `GET` and `POST` methods for API routes
- `auth` - Function to retrieve current session (server-side)
- `signIn` - Function to initiate OAuth flow
- `signOut` - Function to clear session

### 3. Verify TypeScript compilation

From workspace root:

```bash
npx nx typecheck game
```

Should pass with no errors. If there are import errors, verify that `next-auth` is correctly installed (Task 1.1).

**REFACTOR**:
- Ensure provider configuration follows NextAuth v5 conventions
- Verify environment variable names match ADR-002 specification
- Add comments explaining the `authorized` callback caveat

## Implementation Details

### Session Strategy

**JWT vs Database**:
- Using `strategy: 'jwt'` (stateless sessions stored in encrypted cookies)
- No database required for session storage
- 30-day maxAge balances security and user convenience
- See ADR-002 for rationale

### Providers Configuration

**Google**:
- Uses `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` environment variables
- Will require Google Cloud Console OAuth 2.0 credentials (configured manually, not in code)

**Discord**:
- Uses `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` environment variables
- Will require Discord Developer Portal application credentials (configured manually, not in code)

### Custom Sign-In Page

Setting `pages.signIn: '/'` tells NextAuth to redirect to the landing page instead of its default sign-in UI. Our landing page will render the login buttons.

### Route Protection Caveat

The `authorized` callback is included for documentation, but NextAuth v5's middleware export is incompatible with Next.js 16's `proxy.ts` convention. Task 3.3 will implement route protection via manual session cookie checking.

## Acceptance Criteria

- [ ] `apps/game/src/auth.ts` exists and exports `handlers`, `auth`, `signIn`, `signOut`
- [ ] Google and Discord providers are configured
- [ ] Session strategy is JWT with 30-day maxAge
- [ ] Custom signIn page set to `/`
- [ ] `npx nx typecheck game` passes with zero errors
- [ ] File uses `@/*` path alias conventions (verify imports resolve)

## Verification Steps

1. Run `npx nx typecheck game` - should pass
2. Attempt to import in a test file (or wait for Task 1.3 to consume it):
   ```typescript
   import { auth, signIn, signOut, handlers } from '@/auth';
   ```
3. Verify no TypeScript errors on the import

## Rollback Procedure

If this file causes issues:

```bash
rm apps/game/src/auth.ts
npx nx typecheck game
```

Verify typecheck passes after removal.

## Notes

- OAuth credentials are NOT required for this task; environment variables can be undefined during development
- The file will be consumed by:
  - Task 1.3 (route handler imports `handlers`)
  - Task 2.3 (LoginButton imports `signIn`)
  - Task 3.3 (proxy.ts references session cookie naming convention)
  - Task 3.4 (landing page imports `auth`)
- No manual testing possible until Task 1.3 creates the API route handler
