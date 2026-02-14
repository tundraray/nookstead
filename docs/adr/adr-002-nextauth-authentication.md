# ADR-002: Player Authentication with NextAuth.js v5 (Auth.js)

## Status

Proposed

## Context

Nookstead requires player authentication so users can log in before accessing the game at `/game`. The landing page (`/`) will present social login buttons. The project uses Next.js 16 App Router (`next@~16.0.1`), so the chosen solution must integrate with App Router conventions and support route protection.

Key requirements:

1. **Social OAuth login** -- Google and Discord providers (covers the gaming community well)
2. **No database dependency initially** -- JWT-based sessions to avoid requiring PostgreSQL before the Colyseus game server introduces it
3. **Route protection** -- Unauthenticated users visiting `/game` are redirected to `/`
4. **Minimal setup** -- Early-stage project; auth should not add significant complexity

### Important Context: Auth.js / Better Auth Merger

As of September 2024, Auth.js (formerly NextAuth.js) is now maintained by the Better Auth team. The Better Auth team recommends new projects start with Better Auth directly, though Auth.js/NextAuth.js continues to receive security patches and urgent fixes. This merger is relevant to the long-term maintenance outlook of the chosen solution.

### Alternatives Considered

#### 1. NextAuth.js v4 (next-auth@4.x)

- ❌ **Eliminated**: Peer dependency is `next@^12.2.5 || ^13 || ^14 || ^15` -- does not support Next.js 16
- ❌ Does not support App Router patterns natively
- ❌ Legacy API, no longer the recommended path

#### 2. NextAuth.js v5 / Auth.js (next-auth@5.0.0-beta.x)

- ✅ First-class Next.js App Router integration
- ✅ Built-in OAuth provider support (Google, Discord, and 80+ others)
- ✅ JWT session strategy without database adapter
- ✅ Centralized config in `auth.ts` with exported handlers
- ✅ Well-documented migration path and large community
- ⚠️ **Peer dependency issue with Next.js 16**: Current beta versions declare `next@^14.0 || ^15.0` in peerDependencies; Next.js 16 is not yet included (GitHub issue [#13302](https://github.com/nextauthjs/next-auth/issues/13302)). Installation requires `--legacy-peer-deps` or `--force`.
- ⚠️ Beta status -- API surface may change before stable release
- ⚠️ Now maintained by Better Auth team; future development focus may shift

#### 3. Better Auth

- ✅ **Natively supports Next.js 16** including `proxy.ts` (the Next.js 16 replacement for `middleware.ts`)
- ✅ Open-source, framework-agnostic with first-class Next.js integration
- ✅ Supports OAuth providers (Google, Discord, GitHub, and more)
- ✅ Active development with Y Combinator / Peak XV backing
- ✅ Recommended by the Auth.js team for new projects
- ⚠️ Requires a database for session storage (no stateless JWT-only mode without database)
- ❌ Newer library with smaller community and fewer tutorials
- ❌ Less battle-tested than NextAuth.js

#### 4. Firebase Auth

- ✅ Mature, well-documented service
- ❌ External dependency on Google Cloud
- ❌ Firebase SDK adds significant bundle overhead
- ❌ No Next.js middleware/proxy integration
- ❌ Vendor lock-in to Google ecosystem

#### 5. Clerk

- ✅ Excellent developer experience, pre-built UI components
- ✅ Generous free tier (10,000 MAU)
- ❌ Commercial SaaS -- vendor lock-in
- ❌ Cost scales with user base (problematic for an MMO at scale)
- ❌ User data stored externally (data ownership concern)

#### 6. Supabase Auth

- ✅ Open-source friendly, good PostgreSQL integration
- ❌ Requires a Supabase project and database -- unnecessary overhead for JWT-only auth
- ❌ Couples authentication to a specific database provider before the project needs one

#### 7. Custom OAuth Implementation

- ✅ Full control, no external dependencies
- ❌ High implementation effort (OAuth 2.0 flows, PKCE, token management)
- ❌ Security risk from hand-rolled crypto and session management
- ❌ Ongoing maintenance burden for security patches

### Comparison

| Criterion | NextAuth v5 | Better Auth | Clerk | Firebase | Custom |
|---|---|---|---|---|---|
| Next.js 16 support | ⚠️ --force | ✅ Native | ✅ | ❌ No middleware | ✅ |
| JWT without DB | ✅ | ⚠️ Needs DB | N/A (managed) | ✅ | ✅ |
| OAuth providers | ✅ 80+ | ✅ 20+ | ✅ Managed | ✅ Limited | Manual |
| Bundle impact | ~15KB | ~20KB | ~50KB+ | ~100KB+ | Minimal |
| Data ownership | ✅ Full | ✅ Full | ❌ External | ❌ External | ✅ Full |
| Community / docs | ✅ Large | ⚠️ Growing | ✅ Large | ✅ Large | N/A |
| Maintenance cost | Low | Low | $$$ at scale | Free tier | High |
| Setup complexity | Low | Low | Very low | Medium | Very high |

## Decision

We will use **NextAuth.js v5 (Auth.js)** (`next-auth@5.0.0-beta.x`) with a **JWT session strategy** and **Google + Discord OAuth providers**.

### Decision Details

| Item | Content |
|---|---|
| **Decision** | Use NextAuth.js v5 with JWT sessions for player authentication |
| **Why now** | Authentication is a prerequisite for the game client -- players must log in before accessing `/game` |
| **Why this** | NextAuth v5 is the only mature solution offering JWT-only sessions (no database required) with built-in OAuth and App Router support. Better Auth is the strongest alternative but requires a database, which we do not want to introduce until the Colyseus game server phase. |
| **Known unknowns** | (1) Peer dependency resolution with Next.js 16 may break in future npm versions. (2) NextAuth v5 stable release timeline is uncertain given the Better Auth merger. (3) Next.js 16 renamed `middleware.ts` to `proxy.ts` -- NextAuth v5 compatibility with this rename needs verification at implementation time. |
| **Kill criteria** | If NextAuth v5 drops Next.js 16 support or the peer dependency issue escalates to a runtime incompatibility (not just an install warning), migrate to Better Auth with a database adapter. |

### Architecture Decisions

- **JWT-only sessions** (no database adapter) -- simplest approach for early-stage development. A database adapter can be introduced later when PostgreSQL is set up for the Colyseus game server.
- **OAuth providers**: Google + Discord -- covers both general and gaming-community audiences.
- **Route protection via Next.js proxy/middleware** -- `/game` requires authentication; unauthenticated users redirect to `/`.
- **Auth config in `auth.ts`** -- centralized configuration exported for use in route handlers and proxy.
- **Install with `--legacy-peer-deps`** -- required workaround until NextAuth v5 updates its peer dependency range to include Next.js 16.

## Consequences

### Positive

1. **Minimal setup** -- `auth.ts` + route handler + proxy file is the entire auth surface
2. **No database dependency** -- JWT sessions avoid requiring PostgreSQL infrastructure in this phase
3. **Standard OAuth flow** -- well-maintained library handles token exchange, PKCE, and session management
4. **Easy to extend** -- adding providers (GitHub, Twitch, etc.) is a single-line config change
5. **Data ownership** -- all auth data stays in our infrastructure
6. **Migration path** -- when PostgreSQL is introduced for the game server, adding a database adapter to NextAuth is a documented, incremental change

### Negative

1. **Beta dependency** -- `next-auth@5.0.0-beta.x` may have breaking API changes before stable release
2. **Peer dependency workaround** -- requires `--legacy-peer-deps` flag; npm strict mode will reject install
3. **Maintenance uncertainty** -- Auth.js is now under Better Auth stewardship; long-term investment in the NextAuth v5 API surface is unclear
4. **JWT cookie size** -- JWT tokens in cookies are larger than session ID cookies (~1-2KB vs ~32 bytes), though this is negligible for most use cases
5. **No server-side session revocation** -- without a database, individual sessions cannot be invalidated (only the signing secret can be rotated, which invalidates all sessions)
6. **Next.js 16 proxy rename** -- `middleware.ts` is now `proxy.ts` in Next.js 16; NextAuth documentation may reference the old name, requiring manual adaptation

### Migration Path

If NextAuth v5 becomes untenable:

1. **Better Auth** is the natural successor (same team now maintains both). Migration guide exists at [better-auth.com/docs/guides/next-auth-migration-guide](https://www.better-auth.com/docs/guides/next-auth-migration-guide).
2. The JWT session strategy means no database migration is needed -- only the auth configuration layer changes.
3. OAuth provider credentials (Google, Discord client IDs/secrets) are reusable across any auth library.

## Implementation Guidance

- Use dependency injection for the auth configuration so providers and callbacks can be tested independently
- Keep auth configuration in a single `auth.ts` file at the app root, exporting `handlers`, `auth`, `signIn`, and `signOut`
- Protect routes declaratively via proxy/middleware rather than inline checks in page components
- Store OAuth client credentials in environment variables (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `AUTH_SECRET`)
- Use the `authorized` callback pattern for route protection logic rather than custom redirect code

## References

- [NextAuth.js v5 Documentation](https://authjs.dev/) - Official Auth.js documentation
- [NextAuth.js v5 Migration Guide](https://authjs.dev/getting-started/migrating-to-v5) - v4 to v5 migration details
- [GitHub Issue #13302: NextAuth + Next.js 16 peer dependency](https://github.com/nextauthjs/next-auth/issues/13302) - Tracks the peer dependency incompatibility
- [Auth.js Joins Better Auth Announcement](https://www.better-auth.com/blog/authjs-joins-better-auth) - September 2024 merger announcement
- [Better Auth Next.js Integration](https://www.better-auth.com/docs/integrations/next) - Alternative migration target documentation
- [Better Auth Migration Guide from Auth.js](https://www.better-auth.com/docs/guides/next-auth-migration-guide) - Migration path if kill criteria are triggered
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) - Middleware to proxy rename and other breaking changes
- [next-auth on npm](https://www.npmjs.com/package/next-auth) - Package versions and peer dependencies
- Nookstead GDD (Section 5 - Multiplayer Infrastructure, Authentication)

## Date

2026-02-14
