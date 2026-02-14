# Task 3.1: Create AuthProvider Component

**Phase**: Phase 3 - Auth Integration
**Estimated Duration**: 10 minutes
**Dependencies**: Task 1.1 (next-auth must be installed)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Create a client component that wraps NextAuth's `SessionProvider` to enable session access throughout the application via React Context. This provider will be added to the root layout in Task 3.2.

## Target Files

### New Files
- `apps/game/src/components/auth/AuthProvider.tsx` - SessionProvider wrapper

## Implementation Steps

### TDD Cycle

**RED (Verify provider doesn't exist)**:
Attempt to import it - should fail:

```typescript
import { AuthProvider } from '@/components/auth/AuthProvider'; // Should error
```

**GREEN (Implement provider)**:

### 1. Create AuthProvider.tsx

Create `apps/game/src/components/auth/AuthProvider.tsx`:

```typescript
'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Why this wrapper**:
- `SessionProvider` must be used in a client component (`'use client'` directive)
- The root layout (`layout.tsx`) is a server component by default
- This wrapper allows us to use SessionProvider in the layout without converting the entire layout to a client component

### 2. Verify TypeScript compilation

```bash
npx nx typecheck game
```

Should pass with zero errors.

**REFACTOR**:
- Verify component follows naming conventions (named export `AuthProvider`)
- Ensure `'use client'` directive is at the top of the file
- Confirm TypeScript types are correct (`ReactNode` for children)

### 3. Test import (optional manual verification)

Temporarily import in another file to verify it resolves:

```typescript
import { AuthProvider } from '@/components/auth/AuthProvider';
```

Should not produce TypeScript errors.

## Implementation Details

### Client Component Directive

`'use client'` is required because:
- `SessionProvider` from `next-auth/react` only works in client components
- It uses React Context, which requires client-side rendering

### SessionProvider

`SessionProvider` is NextAuth's React Context provider that:
- Stores the current session state
- Makes `useSession()` hook available to all child components
- Handles automatic session refreshing
- Provides session data to client components

### Why Wrap Instead of Direct Use

We could use `SessionProvider` directly in `layout.tsx`, but creating a dedicated wrapper:
- Keeps naming consistent (`AuthProvider` is clearer than `SessionProvider` for this project)
- Provides a single place to configure SessionProvider options if needed in the future
- Follows the pattern of creating thin wrappers for third-party providers

### Children Pattern

```typescript
type AuthProviderProps = {
  children: ReactNode;
};
```

This is the standard React pattern for provider components that wrap other components.

## Acceptance Criteria

- [ ] `apps/game/src/components/auth/AuthProvider.tsx` exists
- [ ] Component exports named export `AuthProvider`
- [ ] Component is marked `'use client'`
- [ ] Component wraps children in `<SessionProvider>`
- [ ] `npx nx typecheck game` passes with zero errors
- [ ] Import resolves correctly with `@/components/auth/AuthProvider` path alias

## Verification Steps

1. Run `npx nx typecheck game` - should pass
2. Attempt to import `AuthProvider` in a test file:
   ```typescript
   import { AuthProvider } from '@/components/auth/AuthProvider';
   ```
3. Verify no TypeScript errors on the import
4. (Optional) Create a temporary test component that renders `<AuthProvider><div>Test</div></AuthProvider>` to verify it renders without errors

## Rollback Procedure

If AuthProvider causes issues:

```bash
rm apps/game/src/components/auth/AuthProvider.tsx
npx nx typecheck game
```

## Notes

- This component will be used in Task 3.2 to wrap the root layout
- Once added to layout, `useSession()` hook will be available in all client components
- SessionProvider automatically handles session refresh and state management
- No configuration options are needed for SessionProvider in this basic setup
- Future enhancements could add `basePath`, `refetchInterval`, or other SessionProvider options
- This provider does NOT affect server components (they use `await auth()` instead)
