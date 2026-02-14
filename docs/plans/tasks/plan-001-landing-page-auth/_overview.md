# Overall Design Document: Landing Page and Authentication Implementation

Generation Date: 2026-02-14
Target Plan Document: plan-001-landing-page-auth.md
Plan Directory: docs/plans/tasks/plan-001-landing-page-auth/

## Project Overview

### Purpose and Goals

Establish the foundational authentication layer and branded entry point for Nookstead, enabling:
1. User authentication via social OAuth providers (Google, Discord)
2. Route protection for game access (authenticated users only)
3. Branded pixel art landing page replacing Nx boilerplate
4. Session management with 30-day persistence

### Background and Context

The current application has no authentication or branding. Before real user testing, we need:
- OAuth integration for user identity
- Route protection to gate `/game` access
- A pixel art themed entry point that communicates the game's aesthetic
- A foundation for future features requiring user identity (profiles, saves, etc.)

This implementation follows ADR-002 (NextAuth.js v5) and the vertical slice approach defined in Design Doc design-001.

## Task Division Design

### Division Policy

**Approach**: Hybrid vertical slice with foundation-first phasing

**Rationale**:
- Phase 1 (Auth Foundation) establishes the infrastructure required by all later tasks
- Phase 2 (Landing Page UI) builds the presentation layer independently
- Phase 3 (Auth Integration) vertically integrates foundation + presentation
- Phase 4 (Quality Assurance) verifies the complete feature

**Verifiability level distribution**:
- Phase 1: L3 (Build Success) - Infrastructure must compile before UI depends on it
- Phase 2: L1 (Functional Operation) - UI components are user-visible and testable immediately
- Phase 3: L1 (Functional Operation) - Full authentication flow is end-to-end verifiable
- Phase 4: L1 + L2 (Functional + Test) - All acceptance criteria satisfied

### Inter-task Relationship Map

```
Phase 1: Auth Foundation (L3 verification)
  Task 1.1: Install next-auth → Deliverable: package.json updated
    ↓
  Task 1.2: Create auth.ts → Deliverable: apps/game/src/auth.ts
    ↓
  Task 1.3: Create route handler + .env.example → Deliverable: apps/game/src/app/api/auth/[...nextauth]/route.ts, .env.example
    ↓ (provides auth infrastructure)

Phase 2: Landing Page UI (L1 verification)
  Task 2.1: Replace global.css → Deliverable: apps/game/src/app/global.css
    ↓
  Task 2.2: Add pixel font + update layout metadata → Deliverable: apps/game/src/app/layout.tsx (metadata only)
    ↓
  Task 2.3: Create LoginButton component → Deliverable: apps/game/src/components/auth/LoginButton.tsx, LoginButton.module.css
    ↓ (combines with 2.2)
  Task 2.4: Create landing page → Deliverable: apps/game/src/app/page.tsx, page.module.css
    ↓ (UI ready for integration)

Phase 3: Auth Integration (L1 verification, references Phase 1 + Phase 2 deliverables)
  Task 3.1: Create AuthProvider → Deliverable: apps/game/src/components/auth/AuthProvider.tsx
    ↓
  Task 3.2: Wrap layout.tsx with AuthProvider → Deliverable: apps/game/src/app/layout.tsx (final version)
    ↓
  Task 3.3: Create proxy.ts → Deliverable: apps/game/src/proxy.ts (references auth.ts from Task 1.2)
    ↓
  Task 3.4: Add authenticated state to landing page → Deliverable: apps/game/src/app/page.tsx (final version)
    ↓ (fully integrated feature)

Phase 4: Quality Assurance (L1 + L2 verification)
  Task 4.1: Update tests → Deliverable: apps/game/specs/index.spec.tsx
    ↓
  Task 4.2: Run lint + typecheck + build → Verification only
    ↓
  Task 4.3: Verify responsive design → Verification only
    ↓
  Task 4.4: Manual OAuth flow test → Verification only
```

### Interface Change Impact Analysis

| Existing Interface | New Interface | Conversion Required | Corresponding Task |
|-------------------|---------------|-------------------|-------------------|
| Page component (sync) | Page component (async server component) | Yes - test mocking | Task 4.1 |
| layout.tsx (no providers) | layout.tsx (with AuthProvider) | Yes - wrapping children | Task 3.2 |
| global.css (Nx defaults) | global.css (pixel art theme) | Yes - complete replacement | Task 2.1 |
| page.module.css (Nx boilerplate) | page.module.css (pixel art landing) | Yes - complete replacement | Task 2.4 |
| No auth | NextAuth session | Yes - new functionality | Tasks 1.2, 1.3, 3.1-3.4 |
| No route protection | proxy.ts session check | Yes - new functionality | Task 3.3 |

### Common Processing Points

**NextAuth session handling**:
- Task 1.2 defines the session configuration (JWT, 30-day maxAge)
- Task 3.1 provides SessionProvider for client-side session access
- Task 3.3 manually checks session cookie for route protection
- Task 3.4 server-side calls `auth()` for session state

**Styling system**:
- Task 2.1 establishes global dark theme and pixel rendering CSS
- Task 2.2 loads Press Start 2P font globally
- All subsequent components use CSS Modules for scoped styles (LoginButton, page)

**Path aliases**:
- All tasks use `@/*` alias for `apps/game/src/*` imports
- Verify TypeScript path mapping in tsconfig.json

## Implementation Considerations

### Principles to Maintain Throughout

1. **CSS Modules isolation**: Global styles (task 2.1) must not break existing game page styles
2. **Auth as optional during development**: Tasks 1-3 can be built without OAuth credentials; only Task 4.4 requires real credentials
3. **Next.js 16 conventions**: Use `proxy.ts` not `middleware.ts`; handle async Server Components properly
4. **TDD cycle**: Each task should follow Red-Green-Refactor where applicable (especially tasks adding new components)
5. **Pixel art aesthetic**: All UI components must use pixelated rendering, Press Start 2P font, and the dark theme palette

### Risks and Countermeasures

- **Risk**: NextAuth v5 peer dependency mismatch with Next.js 16
  **Countermeasure**: Use `--legacy-peer-deps` flag in Task 1.1; pin exact version `5.0.0-beta.30`

- **Risk**: Global CSS replacement breaks game page styling
  **Countermeasure**: Task 2.1 completion criteria includes manual verification of `/game` page; game uses CSS Modules exclusively

- **Risk**: `proxy.ts` session check incompatible with NextAuth v5 `authorized` callback
  **Countermeasure**: Task 3.3 manually checks session cookie instead of relying on NextAuth middleware export

- **Risk**: OAuth provider configuration delays (external services)
  **Countermeasure**: Tasks 1-3 structurally testable without credentials; Task 4.4 deferred to final phase

- **Risk**: Press Start 2P font fails to load from Google Fonts CDN
  **Countermeasure**: Task 2.2 includes fallback font stack (`monospace`); logo remains readable

### Impact Scope Management

**Allowed change scope**:
- `apps/game/src/` directory (all new auth files, components, proxy.ts)
- `apps/game/src/app/` (page.tsx, layout.tsx, global.css, page.module.css)
- `apps/game/package.json` (add next-auth dependency)
- `apps/game/specs/index.spec.tsx` (update test for new page component)
- `.env.example` (workspace root, documentation only)

**No-change areas**:
- `apps/game/src/app/game/` (game page and Phaser canvas - must not be affected by global CSS changes)
- `apps/game-e2e/` (E2E tests out of scope for this feature)
- Other Nx workspace projects
- Root `package.json` workspaces configuration
- `nx.json` or any Nx plugin configuration

**Verification boundary**:
- After Task 2.1 (global.css), manually verify `/game` page still renders correctly
- After Task 4.2 (build), verify no unintended TypeScript errors in game page files

## Phase Completion Integration Points

### Phase 1 Completion (Auth Foundation)
**E2E Verification**:
1. Run `npx nx build game` - must succeed with zero errors
2. Start dev server, navigate to `/api/auth/providers` - must return JSON listing `google` and `discord`
3. Verify `auth.ts` imports resolve with `@/*` path alias

**Deliverables**:
- `apps/game/package.json` (next-auth dependency)
- `apps/game/src/auth.ts`
- `apps/game/src/app/api/auth/[...nextauth]/route.ts`
- `.env.example`

### Phase 2 Completion (Landing Page UI)
**E2E Verification**:
1. Navigate to `/` - pixel art logo with glow animation renders
2. Tagline and login buttons visible
3. Animated background stars present
4. Navigate to `/game` - Phaser canvas still renders correctly (CSS isolation verified)
5. Browser DevTools responsive mode at 360px - no horizontal scrolling

**Deliverables**:
- `apps/game/src/app/global.css` (replaced)
- `apps/game/src/app/layout.tsx` (font + metadata only)
- `apps/game/src/components/auth/LoginButton.tsx`
- `apps/game/src/components/auth/LoginButton.module.css`
- `apps/game/src/app/page.tsx` (unauthenticated view only)
- `apps/game/src/app/page.module.css` (replaced)

### Phase 3 Completion (Auth Integration)
**E2E Verification**:
1. Incognito window, navigate to `/game` - redirect to `/`
2. Navigate to `/` - login buttons clickable (redirect to OAuth or error page)
3. (With valid session cookie) Navigate to `/` - "Play" button appears, login buttons hidden
4. (With valid session cookie) Navigate to `/game` - game page loads

**Deliverables**:
- `apps/game/src/components/auth/AuthProvider.tsx`
- `apps/game/src/app/layout.tsx` (final version with AuthProvider)
- `apps/game/src/proxy.ts`
- `apps/game/src/app/page.tsx` (final version with auth state)

### Phase 4 Completion (Quality Assurance)
**E2E Verification**:
1. All Nx targets pass: `npx nx run-many -t lint test build typecheck`
2. Responsive design verified at 360px, 768px, 1440px
3. Google OAuth flow completes (manual with real credentials)
4. Discord OAuth flow completes (manual with real credentials)
5. Session persists across page refresh

**Deliverables**:
- `apps/game/specs/index.spec.tsx` (updated for async server component)
- All acceptance criteria from Design Doc satisfied

## Task Execution Order

**Sequential execution recommended** (dependencies prevent parallelization in most cases):

1. Task 1.1 → Task 1.2 → Task 1.3 (Phase 1 sequential)
2. Task 2.1 → Task 2.2 → Task 2.3 (can start after 1.1) → Task 2.4 (Phase 2 mostly sequential)
3. Task 3.1 (after 1.1) → Task 3.2 → Task 3.3 (after 1.2) → Task 3.4 (after 2.4 and 3.2)
4. Task 4.1 → Task 4.2 → Task 4.3 → Task 4.4 (Phase 4 sequential)

**Potential parallelization**:
- Task 2.1 (global.css) can start independently of Phase 1
- Task 2.3 (LoginButton) can start after Task 1.1 (only needs next-auth installed)

However, given the small scope (11 tasks over 2 days), sequential execution is simpler and safer.

## Notes

- **OAuth credentials**: Not required until Task 4.4; use `AUTH_SECRET` only for dev server startup (generate with `openssl rand -base64 32`)
- **Beta dependency**: `next-auth@5.0.0-beta.30` is pinned; consult ADR-002 before upgrading
- **Next.js 16 proxy.ts**: Manual cookie check used for compatibility (not NextAuth middleware export)
- **Test updates**: Task 4.1 must handle async server component and mock NextAuth session
