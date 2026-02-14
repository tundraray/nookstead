# Task 3.2: Wrap Layout with AuthProvider

**Phase**: Phase 3 - Auth Integration
**Estimated Duration**: 10 minutes
**Dependencies**: Task 3.1 (AuthProvider must exist)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Add the `AuthProvider` wrapper to the root layout to provide session context to all client components throughout the application. This enables the `useSession()` hook in components like LoginButton.

## Target Files

### Modified
- `apps/game/src/app/layout.tsx` - Wrap children with AuthProvider

## Implementation Steps

### TDD Cycle

**RED (Verify session is not available)**:
1. In a client component (e.g., a test file), try using `useSession()` from `next-auth/react`
2. Should produce an error: "useSession must be wrapped in a <SessionProvider />"

**GREEN (Add AuthProvider to layout)**:

### 1. Update layout.tsx

Modify `apps/game/src/app/layout.tsx`:

**Add import**:

```typescript
import { AuthProvider } from '@/components/auth/AuthProvider';
```

**Wrap children in AuthProvider**:

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

**Complete example layout.tsx** (after this task):

```typescript
import './global.css';
import { Metadata } from 'next';
import { AuthProvider } from '@/components/auth/AuthProvider';

export const metadata: Metadata = {
  title: 'Nookstead',
  description: 'A 2D pixel art MMO life sim with AI-powered NPCs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

### 2. Verify dev server hot-reload

After saving, dev server should hot-reload with no errors.

**REFACTOR**:
- Verify import uses `@/components/auth/AuthProvider` path alias
- Ensure AuthProvider wraps `{children}` correctly
- Confirm no duplicate providers or nesting issues

### 3. Verify build succeeds

```bash
npx nx build game
```

Should complete with zero errors.

### 4. Test useSession availability (optional)

In a client component (e.g., LoginButton or create a test component):

```typescript
'use client';
import { useSession } from 'next-auth/react';

export function TestSessionComponent() {
  const { data: session, status } = useSession();
  console.log('Session:', session, 'Status:', status);
  return <div>Session status: {status}</div>;
}
```

Should not produce SessionProvider wrapper error anymore. The status will be "unauthenticated" if no session exists.

## Implementation Details

### Provider Placement

The AuthProvider must wrap `{children}` inside the `<body>` tag because:
- React Context providers must wrap the components that consume them
- All page content is rendered as children of the layout
- Placing it in `<body>` ensures all pages have access to session context

### Server vs Client Components

- `layout.tsx` remains a **server component**
- `AuthProvider` is a **client component** (`'use client'`)
- This pattern (server component importing and rendering a client component) is supported in Next.js App Router
- The client boundary starts at `AuthProvider` and extends to all its children

### What This Enables

After this task:
- Any client component can use `useSession()` hook
- LoginButton component (from Task 2.3) can access session state if needed
- Future client components can check authentication status
- Session data is automatically managed and refreshed

### What This Does NOT Affect

- Server components still use `await auth()` from `@/auth` (not `useSession()`)
- The landing page (Task 2.4) is a server component and will use `auth()` in Task 3.4
- proxy.ts route protection (Task 3.3) is separate from this provider

## Acceptance Criteria

- [ ] `apps/game/src/app/layout.tsx` imports `AuthProvider` from `@/components/auth/AuthProvider`
- [ ] `{children}` is wrapped in `<AuthProvider>{children}</AuthProvider>` inside `<body>`
- [ ] `npx nx build game` succeeds
- [ ] Dev server hot-reloads without errors
- [ ] `useSession()` hook is now available in all client components
- [ ] No SessionProvider wrapper errors in browser console

## Verification Steps

1. Start dev server: `npx nx dev game`
2. Navigate to `/`
3. Open browser DevTools → Console
4. Should see no SessionProvider errors
5. (Optional) Add a test component using `useSession()` to verify it works
6. Run build: `npx nx build game` - should succeed

## Rollback Procedure

If wrapping causes issues:

```bash
git checkout apps/game/src/app/layout.tsx
npx nx dev game
```

Verify landing page works, then re-attempt the task.

## Notes

- This task completes the client-side session management setup
- LoginButton (Task 2.3) already uses `signIn()` from `next-auth/react`, which will now work correctly
- Task 3.4 will add server-side session checking to the landing page using `await auth()`
- The AuthProvider does NOT make pages load slower (SessionProvider uses client-side hydration)
- Session state is managed in browser storage (cookies for JWT mode)
