# Task 4.1: Update Existing Test for Async Landing Page

**Phase**: Phase 4 - Quality Assurance
**Estimated Duration**: 20 minutes
**Dependencies**: Task 3.4 (landing page must have auth integration)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Update the existing test file (`specs/index.spec.tsx`) to handle the new async server component landing page with authentication. The test must mock `next-auth` and the `@/auth` module to simulate both authenticated and unauthenticated states.

## Target Files

### Modified
- `apps/game/specs/index.spec.tsx` - Update test for new landing page

## Implementation Steps

### TDD Cycle

**RED (Verify current test fails)**:

Run the existing test:

```bash
npx nx test game
```

**Expected**: Test should fail because:
- The `Page` component is now async (uses `await auth()`)
- Test doesn't mock `@/auth` module
- Test may expect different content (old Nx boilerplate vs new pixel art landing page)

**GREEN (Update test to handle async component and auth mocking)**:

### 1. Read current test file

First, check what the current test looks like:

```bash
cat apps/game/specs/index.spec.tsx
```

### 2. Replace test file with updated version

Replace `apps/game/specs/index.spec.tsx` with:

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import Page from '../src/app/page';

// Mock next-auth/react (for LoginButton component)
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock @/auth module
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('Landing Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login buttons when unauthenticated', async () => {
    // Mock auth() to return null (no session)
    const { auth } = require('@/auth');
    auth.mockResolvedValue(null);

    // Page is an async component, so we need to await it
    const PageComponent = await Page();
    render(PageComponent);

    // Check for logo
    expect(screen.getByText('NOOKSTEAD')).toBeInTheDocument();

    // Check for tagline
    expect(screen.getByText(/A 2D pixel art MMO life sim with AI-powered NPCs/i)).toBeInTheDocument();

    // Check for login buttons
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Discord')).toBeInTheDocument();

    // Play button should NOT be present
    expect(screen.queryByText('Play')).not.toBeInTheDocument();
  });

  it('renders Play button when authenticated', async () => {
    // Mock auth() to return a session
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: {
        name: 'Test User',
        email: 'test@example.com',
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    });

    // Page is an async component, so we need to await it
    const PageComponent = await Page();
    render(PageComponent);

    // Check for logo
    expect(screen.getByText('NOOKSTEAD')).toBeInTheDocument();

    // Check for welcome message with user name
    expect(screen.getByText(/Welcome back, Test User!/i)).toBeInTheDocument();

    // Check for Play button
    expect(screen.getByText('Play')).toBeInTheDocument();

    // Login buttons should NOT be present
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign in with Discord')).not.toBeInTheDocument();
  });

  it('falls back to "Player" if user name is not available', async () => {
    // Mock auth() to return a session without a name
    const { auth } = require('@/auth');
    auth.mockResolvedValue({
      user: {
        email: 'test@example.com',
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const PageComponent = await Page();
    render(PageComponent);

    // Check for welcome message with fallback name
    expect(screen.getByText(/Welcome back, Player!/i)).toBeInTheDocument();
  });
});
```

### 3. Run the updated tests

```bash
npx nx test game
```

**Expected result**: All tests pass.

**REFACTOR**:
- Verify mocks are correctly set up
- Ensure test descriptions are clear
- Confirm test coverage includes both authenticated and unauthenticated states

### 4. Check test coverage

```bash
npx nx test game --coverage
```

Review coverage report to ensure the landing page component is well-covered.

## Implementation Details

### Mocking next-auth/react

```typescript
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

This mocks:
- `signIn` function used by LoginButton component
- `SessionProvider` as a passthrough component (just renders children)

### Mocking @/auth

```typescript
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));
```

This mocks the `auth()` function that the landing page calls server-side to check session state.

We use `auth.mockResolvedValue()` to control what session data is returned:
- `null` - No session (unauthenticated)
- `{ user: { name, email }, expires }` - Active session (authenticated)

### Testing Async Server Components

```typescript
const PageComponent = await Page();
render(PageComponent);
```

Since `Page` is now an async server component, we must `await` it before rendering. This is a Jest/React Testing Library pattern for testing async components.

### Mocking Next.js Link

```typescript
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});
```

The Play button uses `<Link>` from Next.js. In tests, we mock it as a simple `<a>` tag.

### Test Cases

1. **Unauthenticated state**: Verifies login buttons are shown, Play button is hidden
2. **Authenticated state**: Verifies Play button and welcome message are shown, login buttons are hidden
3. **Name fallback**: Verifies "Player" is used if `session.user.name` is unavailable

### Why Three Test Cases

These cover all code paths:
- Unauthenticated (`session` is `null`)
- Authenticated with name (`session.user.name` exists)
- Authenticated without name (`session.user.name` is undefined)

## Acceptance Criteria

- [ ] Test file mocks `next-auth/react`, `@/auth`, and `next/link`
- [ ] Test handles async server component (awaits `Page()` before rendering)
- [ ] Test case for unauthenticated state (login buttons visible)
- [ ] Test case for authenticated state (Play button visible, welcome message with name)
- [ ] Test case for name fallback (welcome message with "Player")
- [ ] `npx nx test game` passes with zero failures
- [ ] Test coverage for landing page component is adequate (check coverage report)

## Verification Steps

1. Run tests: `npx nx test game`
2. Verify all tests pass (3 test cases in the describe block)
3. Run with coverage: `npx nx test game --coverage`
4. Review coverage report - `page.tsx` should have high coverage
5. Check console output for any warnings or errors

## Rollback Procedure

If test update causes issues:

```bash
git checkout apps/game/specs/index.spec.tsx
npx nx test game
```

Verify original test runs, then re-attempt the task.

## Notes

- This test uses Jest mocking; if your project uses a different test framework, adapt accordingly
- The test doesn't interact with actual OAuth flows (those are tested manually in Task 4.4)
- Testing async server components requires awaiting the component before rendering
- Coverage should include both branches of the conditional rendering (authenticated / unauthenticated)
- Future enhancement: Add tests for LoginButton component itself
- The test verifies UI rendering based on session state, not the auth flow itself
