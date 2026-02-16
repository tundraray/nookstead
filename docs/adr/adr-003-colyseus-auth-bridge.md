# ADR-003: Authentication Bridge between NextAuth and Colyseus

## Status

Proposed

## Context

Nookstead requires authenticated WebSocket connections between the Next.js game client and the Colyseus game server. Players authenticate via NextAuth.js v5 (ADR-002) with Google/Discord OAuth and JWT sessions. The Colyseus server needs to verify player identity during WebSocket connection to prevent unauthorized access to game rooms.

Key requirements:

1. **Single sign-on** -- players authenticate once via NextAuth; the same identity must be recognized by Colyseus
2. **No second auth system** -- avoid maintaining separate user credentials for the game server
3. **WebSocket auth** -- Colyseus `onAuth()` room hook must validate the player's identity before allowing room join
4. **userId availability** -- the Colyseus server needs the database `userId` (UUID) to associate game state with the authenticated player

### How NextAuth v5 JWT Works

NextAuth v5 encrypts session tokens using JWE (JSON Web Encryption) via the `jose` library:

- The session token is encrypted with a key derived from `AUTH_SECRET` using HKDF (RFC 5869)
- The encryption algorithm is `A256CBC-HS512` (requiring a 64-byte key)
- Stored in `authjs.session-token` cookie (or `__Secure-authjs.session-token` in production HTTPS)
- Internally uses `jose` library's `EncryptJWT` and `jwtDecrypt` functions
- The decrypted payload contains `{ email, name, picture, sub, userId, iat, exp, jti }`
- HKDF derivation parameters: `sha256` hash, secret = AUTH_SECRET, salt = cookie name (e.g. `authjs.session-token`), info = `Auth.js Generated Encryption Key (<cookie-name>)`, key length = 64 bytes

### Alternatives Considered

#### 1. Share AUTH_SECRET Directly (CHOSEN)

Decode NextAuth encrypted JWT cookies directly in the Colyseus server using the `jose` library.

- ✅ Single source of truth for authentication -- one secret, one token format
- ✅ No additional HTTP roundtrips -- client sends the existing session token directly
- ✅ No extra secrets to manage -- reuses AUTH_SECRET already in `.env`
- ✅ Real-time validity -- token expiry is checked at decode time
- ⚠️ Couples Colyseus to NextAuth's internal JWE format -- format changes in NextAuth v5 updates could break decoding
- ⚠️ Requires understanding NextAuth's encryption internals (HKDF key derivation from AUTH_SECRET with cookie-name-based salt)

#### 2. Game-Token API Route

Next.js API endpoint (`/api/auth/game-token`) validates NextAuth session, issues a simple JWT (via `jsonwebtoken`) with a separate `GAME_JWT_SECRET`.

- ✅ Clean separation of concerns -- Colyseus knows nothing about NextAuth internals
- ✅ Resilient to NextAuth format changes -- only the API route needs updating
- ❌ Extra HTTP roundtrip before every WebSocket connection
- ❌ Second secret to manage (`GAME_JWT_SECRET`)
- ❌ Token lifetime management complexity (short-lived game tokens vs long-lived NextAuth sessions)
- ❌ Additional API endpoint to maintain and secure

#### 3. @colyseus/auth Module

Use Colyseus's built-in authentication module with its own user registration/login system.

- ✅ Integrated with Colyseus ecosystem
- ❌ Introduces a second, parallel authentication system
- ❌ Requires duplicate user management (NextAuth users + Colyseus users)
- ❌ Players would need to authenticate twice (OAuth + Colyseus)
- ❌ Increased maintenance and complexity

### Comparison

| Criterion | Shared AUTH_SECRET | Game-Token API | @colyseus/auth |
|---|---|---|---|
| Secrets to manage | 1 (AUTH_SECRET) | 2 (AUTH_SECRET + GAME_JWT_SECRET) | 2+ (Colyseus auth config) |
| HTTP roundtrips | 0 | 1 per connection | 1+ per connection |
| Coupling to NextAuth | High (JWE format) | Low (session API only) | None |
| Implementation effort | Low | Medium | High |
| User management | Single (NextAuth + DB) | Single (NextAuth + DB) | Dual systems |
| Resilience to upgrades | Low (format-dependent) | High | N/A |

## Decision

We will use **Shared AUTH_SECRET** to decode NextAuth encrypted JWT cookies directly in the Colyseus server using the `jose` library.

### Decision Details

| Item | Content |
|---|---|
| **Decision** | Share AUTH_SECRET between NextAuth and Colyseus; decode JWE tokens in Colyseus `onAuth()` using jose |
| **Why now** | The Colyseus game server requires authentication before players can join game rooms |
| **Why this** | Simplest approach with zero additional infrastructure -- reuses the existing token and secret. The coupling risk is acceptable because both services are in the same monorepo and deployed together. |
| **Known unknowns** | (1) NextAuth v5 JWE format may change between beta releases. (2) Key derivation from AUTH_SECRET uses HKDF with cookie-name-based salt -- the exact parameters must match NextAuth's `getDerivedEncryptionKey` implementation. (3) Cross-origin WebSocket connections cannot send cookies automatically -- the client must extract and pass the token explicitly. |
| **Kill criteria** | If NextAuth v5 changes its JWE encryption format in a way that cannot be easily tracked, migrate to the Game-Token API Route approach (Option 2). |

### Implementation Guidelines

- Derive the encryption key from AUTH_SECRET using HKDF with the same parameters as Auth.js v5's `getDerivedEncryptionKey` function (cookie-name-based salt, 64-byte key for A256CBC-HS512)
- Use jose `jwtDecrypt` to decode the JWE token in Colyseus `onAuth()` lifecycle hook
- Client extracts the session token from the `authjs.session-token` cookie and passes it as a join option to Colyseus
- The client must also communicate which cookie name was used (dev vs production) so the server derives the correct key
- Validate token expiry and required claims (userId) before accepting connections
- Pin NextAuth version to prevent silent format changes

See Design Doc (design-003-colyseus-game-server.md) for complete implementation samples.

## Consequences

### Positive

1. **Zero additional infrastructure** -- no new API endpoints, no new secrets
2. **Immediate authentication** -- WebSocket connects with existing token, no pre-flight HTTP call
3. **Single user identity** -- same userId across HTTP and WebSocket contexts
4. **Monorepo advantage** -- both services share the same `.env` and deploy together, making format coupling manageable

### Negative

1. **Format coupling** -- if NextAuth v5 changes its JWE format (encryption algorithm, key derivation salt), Colyseus token verification breaks
2. **Internal dependency** -- relies on undocumented NextAuth internals (HKDF parameters in `getDerivedEncryptionKey`)
3. **Cookie extraction** -- client must manually parse cookies to get the session token for WebSocket
4. **No independent session management** -- cannot revoke Colyseus access without revoking the NextAuth session entirely

### Migration Path

If kill criteria are triggered:

1. Create `/api/auth/game-token` API route in the game app
2. Issue short-lived JWTs signed with a new `GAME_JWT_SECRET`
3. Update Colyseus `onAuth()` to verify the new token format
4. Update client to call the API route before connecting to Colyseus
5. The game-token approach can be implemented incrementally without breaking existing NextAuth auth

## Related Information

- [NextAuth.js v5 JWT Implementation](https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/jwt.ts) -- Source code for JWT encryption/decryption, including `getDerivedEncryptionKey`
- [jose Library Documentation](https://github.com/panva/jose) -- JWE/JWS implementation used by NextAuth
- [HKDF Key Derivation (RFC 5869)](https://datatracker.ietf.org/doc/html/rfc5869) -- Key derivation standard used internally
- [Colyseus Room Authentication](https://docs.colyseus.io/auth/room) -- `onAuth()` hook documentation
- [Fixing JWT Decryption with Auth.js v5 in External Services](https://medium.com/@g-mayer/fixing-jwt-decryption-issues-with-auth-js-v5-in-a-fastify-api-9b5ad4869be0) -- Practical guide for HKDF parameters
- ADR-002: Player Authentication with NextAuth.js v5 -- Prior auth decision
- PRD-002: Colyseus Game Server -- Feature requirements

## Date

2026-02-15
