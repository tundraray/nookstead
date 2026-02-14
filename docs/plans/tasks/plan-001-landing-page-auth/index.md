# Task Index: Landing Page and Authentication Implementation

**Plan**: plan-001-landing-page-auth.md
**Created**: 2026-02-14
**Total Tasks**: 15 tasks + 4 phase completion tasks
**Estimated Total Duration**: 2 days

## Task Status Legend

- **Pending**: Not started
- **In Progress**: Currently being worked on
- **Completed**: Finished and verified
- **Blocked**: Cannot proceed due to dependency

## Phase 1: Authentication Foundation

**Purpose**: Install and configure NextAuth.js v5 with OAuth providers

| Task | File | Description | Status | Duration |
|------|------|-------------|--------|----------|
| [Task 1.1](task-01.md) | `task-01.md` | Install next-auth package | Pending | 5 min |
| [Task 1.2](task-02.md) | `task-02.md` | Create auth.ts configuration | Pending | 15 min |
| [Task 1.3](task-03.md) | `task-03.md` | Create API route handler and .env.example | Pending | 10 min |
| [Phase 1 Completion](phase1-completion.md) | `phase1-completion.md` | Verify auth foundation | Pending | 10 min |

**Total Phase 1 Duration**: ~40 minutes

**Deliverables**:
- `apps/game/package.json` (next-auth dependency)
- `apps/game/src/auth.ts`
- `apps/game/src/app/api/auth/[...nextauth]/route.ts`
- `.env.example`

---

## Phase 2: Landing Page UI

**Purpose**: Build pixel art themed landing page with animations

| Task | File | Description | Status | Duration |
|------|------|-------------|--------|----------|
| [Task 2.1](task-04.md) | `task-04.md` | Replace global.css with dark theme | Pending | 10 min |
| [Task 2.2](task-05.md) | `task-05.md` | Add Press Start 2P font + metadata | Pending | 10 min |
| [Task 2.3](task-06.md) | `task-06.md` | Create LoginButton component | Pending | 20 min |
| [Task 2.4](task-07.md) | `task-07.md` | Create landing page with pixel art design | Pending | 25 min |
| [Phase 2 Completion](phase2-completion.md) | `phase2-completion.md` | Verify landing page UI | Pending | 10 min |

**Total Phase 2 Duration**: ~75 minutes

**Deliverables**:
- `apps/game/src/app/global.css` (replaced)
- `apps/game/src/app/layout.tsx` (font + metadata)
- `apps/game/src/components/auth/LoginButton.tsx`
- `apps/game/src/components/auth/LoginButton.module.css`
- `apps/game/src/app/page.tsx` (unauthenticated view)
- `apps/game/src/app/page.module.css` (replaced)

---

## Phase 3: Auth Integration

**Purpose**: Wire authentication into application with route protection

| Task | File | Description | Status | Duration |
|------|------|-------------|--------|----------|
| [Task 3.1](task-08.md) | `task-08.md` | Create AuthProvider component | Pending | 10 min |
| [Task 3.2](task-09.md) | `task-09.md` | Wrap layout.tsx with AuthProvider | Pending | 10 min |
| [Task 3.3](task-10.md) | `task-10.md` | Create proxy.ts for route protection | Pending | 15 min |
| [Task 3.4](task-11.md) | `task-11.md` | Add authenticated state to landing page | Pending | 15 min |
| [Phase 3 Completion](phase3-completion.md) | `phase3-completion.md` | Verify auth integration | Pending | 15 min |

**Total Phase 3 Duration**: ~65 minutes

**Deliverables**:
- `apps/game/src/components/auth/AuthProvider.tsx`
- `apps/game/src/app/layout.tsx` (final version with AuthProvider)
- `apps/game/src/proxy.ts`
- `apps/game/src/app/page.tsx` (final version with auth state)

---

## Phase 4: Quality Assurance

**Purpose**: Verify all acceptance criteria and quality standards

| Task | File | Description | Status | Duration |
|------|------|-------------|--------|----------|
| [Task 4.1](task-12.md) | `task-12.md` | Update tests for async landing page | Pending | 20 min |
| [Task 4.2](task-13.md) | `task-13.md` | Run lint, typecheck, and build | Pending | 10 min |
| [Task 4.3](task-14.md) | `task-14.md` | Verify responsive design | Pending | 15 min |
| [Task 4.4](task-15.md) | `task-15.md` | Manual OAuth flow testing | Pending | 30 min |
| [Phase 4 Completion](phase4-completion.md) | `phase4-completion.md` | Final verification | Pending | 10 min |

**Total Phase 4 Duration**: ~85 minutes

**Deliverables**:
- `apps/game/specs/index.spec.tsx` (updated)
- All quality checks passing
- Verified responsive design
- Complete OAuth flows tested

---

## Task Dependencies

### Critical Path (Sequential)

```
Task 1.1 → Task 1.2 → Task 1.3 → [Phase 1 Complete]
                                        ↓
Task 2.1 → Task 2.2 → Task 2.3 → Task 2.4 → [Phase 2 Complete]
                                        ↓
Task 3.1 → Task 3.2 → Task 3.3 → Task 3.4 → [Phase 3 Complete]
                                        ↓
Task 4.1 → Task 4.2 → Task 4.3 → Task 4.4 → [Phase 4 Complete]
```

### Parallel Opportunities

- **Task 2.1** (global.css) can start independently of Phase 1
- **Task 2.3** (LoginButton) only needs Task 1.1 (package install)

However, given the small scope, sequential execution is recommended for simplicity.

---

## File Impact Summary

### New Files (8)
1. `apps/game/src/auth.ts` - NextAuth configuration
2. `apps/game/src/app/api/auth/[...nextauth]/route.ts` - API handler
3. `.env.example` - Environment variable documentation
4. `apps/game/src/components/auth/LoginButton.tsx` - Login button component
5. `apps/game/src/components/auth/LoginButton.module.css` - Button styles
6. `apps/game/src/components/auth/AuthProvider.tsx` - SessionProvider wrapper
7. `apps/game/src/proxy.ts` - Route protection
8. `.env.local` - OAuth credentials (manual setup, not committed)

### Modified Files (4)
1. `apps/game/package.json` - Add next-auth dependency
2. `apps/game/src/app/global.css` - Dark theme reset
3. `apps/game/src/app/layout.tsx` - Font, metadata, AuthProvider
4. `apps/game/src/app/page.tsx` - Landing page with auth state

### Replaced Files (2)
1. `apps/game/src/app/page.module.css` - Pixel art landing page styles
2. `apps/game/specs/index.spec.tsx` - Updated test

---

## Completion Tracking

### Phase Completion

- [ ] Phase 1: Authentication Foundation
- [ ] Phase 2: Landing Page UI
- [ ] Phase 3: Auth Integration
- [ ] Phase 4: Quality Assurance

### Acceptance Criteria

- [ ] AC-1: Pixel art landing page renders correctly
- [ ] AC-2: Social authentication (Google + Discord) works
- [ ] AC-3: Route protection redirects unauthenticated users
- [ ] AC-4: OAuth configuration complete
- [ ] AC-5: Session management works (persistence, JWT)
- [ ] AC-6: Responsive design at 360px, 768px, 1440px
- [ ] AC-7: Authenticated UI state (Play button, welcome message)
- [ ] AC-NFR-1: Code quality (lint, typecheck, tests, build)

### Quality Gates

- [ ] `npx nx lint game` - passes
- [ ] `npx nx typecheck game` - passes
- [ ] `npx nx test game` - passes
- [ ] `npx nx build game` - passes
- [ ] Google OAuth flow tested
- [ ] Discord OAuth flow tested

---

## Notes

- All tasks follow TDD (Red → Green → Refactor) where applicable
- Each task includes detailed acceptance criteria and verification steps
- Phase completion tasks include E2E integration verification
- OAuth credentials required only for Task 4.4 (manual testing)
- Estimated total duration: ~4.5 hours (within 2-day estimate)

---

## Quick Navigation

**Phase 1 Tasks**: [1.1](task-01.md) | [1.2](task-02.md) | [1.3](task-03.md) | [Completion](phase1-completion.md)

**Phase 2 Tasks**: [2.1](task-04.md) | [2.2](task-05.md) | [2.3](task-06.md) | [2.4](task-07.md) | [Completion](phase2-completion.md)

**Phase 3 Tasks**: [3.1](task-08.md) | [3.2](task-09.md) | [3.3](task-10.md) | [3.4](task-11.md) | [Completion](phase3-completion.md)

**Phase 4 Tasks**: [4.1](task-12.md) | [4.2](task-13.md) | [4.3](task-14.md) | [4.4](task-15.md) | [Completion](phase4-completion.md)

**Related Documents**: [Work Plan](../../plan-001-landing-page-auth.md) | [Design Doc](../../../design/design-001-landing-page-auth.md) | [ADR-002](../../../adr/adr-002-nextauth-authentication.md) | [PRD](../../../prd/prd-001-landing-page-auth.md)
