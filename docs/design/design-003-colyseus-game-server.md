# Colyseus Game Server Design Document

## Overview

This document defines the technical design for adding a Colyseus multiplayer game server to the Nookstead Nx monorepo. The server provides authoritative real-time state synchronization over WebSocket, authenticates players by decoding NextAuth encrypted JWT tokens using the shared AUTH_SECRET, and integrates with the existing PostgreSQL database via the `@nookstead/db` Colyseus adapter. A new shared types package (`packages/shared`) provides compile-time type safety between the client and server. The Phaser game client gains a connection service to establish authenticated WebSocket connections.

## Design Summary (Meta)

```yaml
design_type: "new_feature"
risk_level: "medium"
complexity_level: "high"
complexity_rationale: >
  (1) ACs require scaffolding three new Nx projects (apps/server, packages/shared, client service),
  a Colyseus room with auth/join/leave/message lifecycle hooks, @colyseus/schema state with
  decorator-based types, JWE token decryption via jose+HKDF, esbuild build configuration with
  ESM output and external native modules, and cross-origin WebSocket connection from the browser.
  These span build configuration, runtime server framework, authentication cryptography, schema
  serialization, database integration, and client-side SDK wiring -- 6+ distinct technical domains.
  (2) Constraints include: Colyseus @type() decorators require experimentalDecorators and
  useDefineForClassFields:false in tsconfig (conflicting with ES2022 defaults), ESM output must
  interop with packages/db ("type":"module"), native WebSocket modules (bufferutil, utf-8-validate)
  must be externalized from the esbuild bundle, and the auth bridge depends on undocumented
  NextAuth v5 HKDF key derivation internals.
main_constraints:
  - "ESM-first output required for @nookstead/db compatibility"
  - "Colyseus @colyseus/schema requires experimentalDecorators + useDefineForClassFields:false"
  - "Auth bridge coupled to NextAuth v5 JWE internal format (HKDF salt)"
  - "esbuild must externalize native WebSocket modules (bufferutil, utf-8-validate)"
  - "Explicit project.json required (no Nx inference plugin for generic Node.js apps)"
biggest_risks:
  - "NextAuth v5 JWE format change breaks auth bridge decryption"
  - "Colyseus decorator tsconfig requirements may conflict with shared tsconfig.base.json strict settings"
  - "esbuild bundling Colyseus + ws + native deps may produce runtime import errors"
unknowns:
  - "Whether Colyseus 0.17.x defineServer API is fully stable or still evolving"
  - "Whether @colyseus/schema decorator metadata is preserved through esbuild bundling"
  - "Exact CORS behavior for WebSocket upgrade requests through @colyseus/ws-transport"
```

## Background and Context

### Prerequisite ADRs

- **ADR-002: Player Authentication with NextAuth.js v5** -- Establishes JWT sessions with Google/Discord OAuth. Defines the auth infrastructure that the Colyseus server must integrate with.
- **ADR-003: Authentication Bridge between NextAuth and Colyseus** -- Selects shared AUTH_SECRET approach. Defines JWE token decryption via jose + HKDF key derivation. Specifies cookie extraction on client side.
- **ADR-004: Build and Serve Tooling for Colyseus Game Server** -- Selects @nx/esbuild:esbuild for build and @nx/js:node for serve. Defines ESM output, external modules, and explicit project.json requirement.

### Agreement Checklist

#### Scope

- [x] Create `apps/server/` -- Colyseus game server application (main.ts, config, rooms, auth)
- [x] Create `packages/shared/` -- Shared types, message types, and game constants
- [x] Create `apps/game/src/services/colyseus.ts` -- Client connection service
- [x] Create `apps/server/project.json` -- Explicit Nx targets (build, serve)
- [x] Integrate `@nookstead/db/adapters/colyseus` for database access
- [x] Implement auth bridge (JWE token decryption) per ADR-003
- [x] Configure esbuild build per ADR-004
- [x] CORS configuration for development and production
- [x] Environment variable management with validation

#### Non-Scope (Explicitly not changing)

- [x] Landing page UI (`apps/game/src/app/page.tsx`)
- [x] Authentication components (LoginButton, AuthProvider)
- [x] NextAuth configuration (`apps/game/src/auth.ts`) -- no modifications
- [x] Database schema (`packages/db/src/schema/`) -- no modifications
- [x] Game map generation, terrain, and Phaser scenes (except adding connection service import)
- [x] NPC agent system, game clock, chat rooms, farming/inventory logic
- [x] Redis cache layer, production deployment, Docker configuration
- [x] E2E test modifications (`apps/game-e2e/`)

#### Constraints

- [x] Parallel operation: Yes (server on port 2567, Next.js on port 3000, simultaneous during dev)
- [x] Backward compatibility: Required (all existing CI targets must continue passing)
- [x] Performance measurement: Required (10 ticks/sec server rate, <150ms state sync latency)

### Problem to Solve

The Nookstead project has a game client (Next.js + Phaser.js) with social authentication and a PostgreSQL database, but no game server. Without an authoritative server:

1. No multiplayer interactions are possible -- players cannot see or interact with each other
2. No shared world state exists -- the game world is purely local to each browser tab
3. No authoritative game logic can run -- all computations are client-side and therefore untrusted
4. NPC agents (the project's core differentiator) cannot be implemented -- they require server-side LLM orchestration

The Colyseus game server is the foundational infrastructure for all multiplayer and AI agent features.

### Current Challenges

1. **No server application**: The `apps/` directory contains only the `game` and `game-e2e` projects. There is no Node.js server app.
2. **No shared types**: Client and server have no mechanism for sharing type definitions, message contracts, or game constants.
3. **No WebSocket infrastructure**: The client has no Colyseus SDK, no connection service, and no mechanism to communicate with a game server.
4. **Cross-origin complexity**: The Next.js dev server (port 3000) and Colyseus server (port 2567) require CORS configuration for WebSocket connections.

### Requirements

#### Functional Requirements

- Colyseus server starts on configurable port (default 2567) with Express + ws-transport
- Authentication bridge decodes NextAuth JWE tokens using shared AUTH_SECRET via jose
- GameRoom manages player state (join/leave/position) with @colyseus/schema
- Server runs at 10 ticks/sec simulation interval
- Client connection service extracts session token and connects to Colyseus
- Shared types package provides type safety between client and server
- Database integration via existing `@nookstead/db/adapters/colyseus`
- Graceful shutdown closes database connections and disposes rooms

#### Non-Functional Requirements

- **Performance**: 10 ticks/sec server update rate; <150ms state sync latency on local network
- **Scalability**: Support 10 concurrent players in a single GameRoom (M0.2 target)
- **Reliability**: Server restarts cleanly after crash; database connections are released on shutdown
- **Maintainability**: Shared types eliminate duplication; standard Nx project structure; ESLint/Prettier compliance
- **Security**: All WebSocket connections authenticated via onAuth(); AUTH_SECRET never logged; client messages validated

## Acceptance Criteria (AC) - EARS Format

### Server Startup and Configuration

- [ ] **When** a developer runs `pnpm nx serve server`, the system shall start the Colyseus server on the configured port (default 2567) and log a listening confirmation message
- [ ] **When** a developer runs `pnpm nx build server`, the system shall produce a runnable ESM JavaScript bundle in `dist/apps/server` with exit code 0
- [ ] **If** `AUTH_SECRET` environment variable is missing, **then** the system shall throw a descriptive error and refuse to start
- [ ] **If** `DATABASE_URL` environment variable is missing, **then** the system shall throw a descriptive error and refuse to start

### Authentication Bridge

- [ ] **When** a client connects with a valid NextAuth session token, the system shall decode the JWE token via jose + HKDF and permit the connection with the extracted userId
- [ ] **If** a client connects with an invalid or expired token, **then** the system shall reject the connection with an authentication error
- [ ] **If** a client connects without a token, **then** the system shall reject the connection
- [ ] **While** a player is connected, the room shall have access to `{ userId, email }` from the decoded token

### GameRoom State Management

- [ ] **When** an authenticated player joins the GameRoom, the system shall add a Player entry to the state map keyed by sessionId with userId, x, y, and name fields
- [ ] **When** a player leaves the GameRoom, the system shall remove their Player entry from the state map
- [ ] The GameRoom shall run a simulation interval at 10 ticks/sec (100ms)
- [ ] **When** two players are connected to the same GameRoom, both shall see each other's Player entries in the synchronized state

### Client Connection

- [ ] **When** the Phaser game scene initializes, the connection service shall extract the NextAuth session token from cookies and connect to the Colyseus server
- [ ] **If** the connection fails, **then** the connection service shall provide an error callback for the caller to handle
- [ ] The connection service shall expose methods to join/leave rooms and access the synchronized state

### Shared Types Package

- [ ] **When** a developer imports a type from `@nookstead/shared` in either `apps/game` or `apps/server`, TypeScript compilation shall succeed with full type information
- [ ] The shared package shall export room state types, message types, and game constants

### Database Integration

- [ ] **When** the server starts, the system shall initialize a database connection via `getGameDb()` from `@nookstead/db/adapters/colyseus`
- [ ] **When** the server receives SIGTERM or SIGINT, the system shall call `closeGameDb()` before exiting

### CORS

- [ ] **When** the game client on `localhost:3000` initiates a WebSocket connection to the server on `localhost:2567`, the CORS configuration shall permit the cross-origin request

## Existing Codebase Analysis

### Implementation Path Mapping

| Type | Path | Description |
|------|------|-------------|
| Existing | `packages/db/src/adapters/colyseus.ts` | Colyseus DB adapter with `getGameDb()`/`closeGameDb()`, 20-connection pool |
| Existing | `packages/db/src/core/client.ts` | Drizzle client factory, `DrizzleClient` type |
| Existing | `packages/db/src/schema/users.ts` | Users table (id, email, name, image) |
| Existing | `packages/db/src/schema/accounts.ts` | Accounts table (provider, providerAccountId) |
| Existing | `packages/db/package.json` | ESM package with exports map (`.`, `./adapters/colyseus`, `./schema`) |
| Existing | `apps/game/src/auth.ts` | NextAuth config with signIn/jwt/session callbacks |
| Existing | `apps/game/src/game/scenes/Game.ts` | Main Phaser game scene (integration point for connection service) |
| Existing | `apps/game/src/game/constants.ts` | Game constants (tile size, map dimensions) |
| Existing | `tsconfig.base.json` | ES2022 target, strict mode, bundler module resolution |
| Existing | `nx.json` | Nx plugins, target defaults, named inputs |
| Existing | `eslint.config.mjs` | Root ESLint flat config with module boundary enforcement |
| Existing | `.prettierrc` | Single quotes |
| New | `apps/server/src/main.ts` | Server entry point (Express + Colyseus setup) |
| New | `apps/server/src/config.ts` | Environment variable validation and configuration |
| New | `apps/server/src/rooms/GameRoom.ts` | Main game room with lifecycle hooks |
| New | `apps/server/src/rooms/GameRoomState.ts` | @colyseus/schema state definitions |
| New | `apps/server/src/auth/verifyToken.ts` | JWE token decryption using jose + HKDF |
| New | `apps/server/project.json` | Nx targets: build (@nx/esbuild), serve (@nx/js:node) |
| New | `apps/server/tsconfig.json` | Extends base, adds experimentalDecorators |
| New | `apps/server/tsconfig.app.json` | App-specific TypeScript config |
| New | `apps/server/package.json` | Dependencies, workspace references |
| New | `apps/server/eslint.config.mjs` | ESLint flat config |
| New | `apps/server/jest.config.ts` | Jest configuration |
| New | `apps/server/.env.example` | Environment variable documentation |
| New | `packages/shared/src/index.ts` | Shared package barrel export |
| New | `packages/shared/src/types/room.ts` | Room state type interfaces |
| New | `packages/shared/src/types/messages.ts` | Client-server message protocol types |
| New | `packages/shared/src/constants.ts` | Game constants (tick rate, ports) |
| New | `packages/shared/package.json` | ESM package configuration |
| New | `packages/shared/tsconfig.json` | TypeScript configuration |
| New | `apps/game/src/services/colyseus.ts` | Colyseus.js client wrapper |

### Code Inspection Evidence

| File Inspected | Key Finding | Design Impact |
|---------------|-------------|---------------|
| `packages/db/src/adapters/colyseus.ts` | Singleton pattern with `getGameDb()`/`closeGameDb()`, 20-connection pool, accepts optional URL and pool options | Server calls `getGameDb()` on startup, `closeGameDb()` on shutdown; no need to configure pool (defaults are appropriate) |
| `packages/db/src/core/client.ts` | `DrizzleClient` type is inferred from `createDrizzleClient` return; `closeDrizzleClient` accesses `$client.end()` | Room instances can accept `DrizzleClient` as dependency for DB operations |
| `packages/db/package.json` | ESM (`"type": "module"`), exports map with `./adapters/colyseus` subpath | Server must use ESM imports; esbuild output format must be ESM |
| `apps/game/src/auth.ts` | JWT callback sets `token.userId` from DB query; session callback copies to `session.user.id` | Token payload after decryption contains `userId` field -- this is what `onAuth()` extracts |
| `apps/game/src/game/scenes/Game.ts` | Scene uses `EventBus.emit('current-scene-ready', this)` pattern | Connection service can listen for scene-ready events or be called from scene `create()` |
| `apps/game/src/game/constants.ts` | Game constants defined per-file (TILE_SIZE, MAP dimensions) | Some constants (tick rate, server port) belong in shared package; map constants stay in game |
| `tsconfig.base.json` | `"strict": true`, `"target": "es2022"`, `"module": "esnext"`, `"moduleResolution": "bundler"` | Server tsconfig extends base but must add `"experimentalDecorators": true` and `"useDefineForClassFields": false` for @colyseus/schema |
| `eslint.config.mjs` | Flat config with `@nx/enforce-module-boundaries` rule | New server and shared packages must be referenced as proper Nx project dependencies |
| `.prettierrc` | `{ "singleQuote": true }` | All new code uses single quotes, 2-space indent (from .editorconfig) |
| `nx.json` | `@nx/jest/plugin` infers `test` target from `jest.config.*` | Server gets inferred test target by adding `jest.config.ts` |
| `nx.json` | `@nx/eslint/plugin` infers `lint` target | Server gets inferred lint target by adding `eslint.config.mjs` |
| `nx.json` | `@nx/js/typescript` infers `typecheck` target | Server gets inferred typecheck target from tsconfig files |
| `package.json` (root) | `@nx/esbuild` not installed; `@nx/js` is at 22.5.0 | Must install `@nx/esbuild@22.5.0` as devDependency |
| `apps/game/package.json` | Uses `"@nookstead/db": "workspace:*"` for workspace dependency | Same pattern for `@nookstead/shared` references in game and server |

### Similar Functionality Search

- **WebSocket server**: No existing WebSocket server or Colyseus code in the codebase. This is the first server application.
- **Shared types package**: No `packages/shared` exists. The only shared package is `packages/db`.
- **Client connection service**: No `apps/game/src/services/` directory exists. No Colyseus client SDK code.
- **Token decryption**: No jose/jwtDecrypt usage in the codebase. NextAuth handles JWE internally.
- **Express server**: No Express server code exists anywhere in the monorepo.

Decision: **New implementation** -- no existing functionality to reuse or refactor.

## Applicable Standards

### Classification Table

| Standard | Type | Source | Impact on Design |
|----------|------|--------|-----------------|
| Prettier: single quotes, 2-space indent | Explicit | `.prettierrc`, `.editorconfig` | All new code must use single quotes and 2-space indent |
| ESLint: flat config with @nx/eslint-plugin | Explicit | `eslint.config.mjs` | New packages need their own `eslint.config.mjs` extending root |
| TypeScript: strict mode, ES2022, bundler resolution | Explicit | `tsconfig.base.json` | All tsconfigs extend `tsconfig.base.json`; server adds decorator overrides |
| ESM modules (`"type": "module"`) | Explicit | `packages/db/package.json` | Server and shared packages use ESM; esbuild format: ESM |
| Nx module boundary enforcement | Explicit | `eslint.config.mjs` (enforce-module-boundaries) | All cross-package imports must be via declared workspace dependencies |
| Jest for unit testing | Explicit | `nx.json` (@nx/jest/plugin) | Server adds `jest.config.ts` for inferred test target |
| Singleton adapter pattern | Implicit | `packages/db/src/adapters/colyseus.ts`, `next.ts` | DB access via `getGameDb()` singleton, not direct client creation |
| Schema barrel exports | Implicit | `packages/db/src/schema/index.ts` | All public types exported through barrel index files |
| Package exports map pattern | Implicit | `packages/db/package.json` | New packages use `types`/`import`/`default` export conditions |
| Workspace dependency format | Implicit | `apps/game/package.json` | Use `"workspace:*"` for inter-package references |
| Auth callback centralization | Implicit | `apps/game/src/auth.ts` | Auth-related code lives in dedicated auth modules, not scattered |

## Design

### Change Impact Map

```yaml
Change Target: Colyseus game server, shared types, client connection service
Direct Impact:
  - apps/server/ (entirely new application)
  - packages/shared/ (entirely new package)
  - apps/game/src/services/colyseus.ts (new file)
  - apps/game/package.json (add @nookstead/shared, @colyseus/sdk dependencies)
  - package.json (root -- add @nx/esbuild, colyseus, @colyseus/ws-transport, @colyseus/schema, @colyseus/sdk, jose, express devDeps)
  - pnpm-workspace.yaml (no change needed -- already includes apps/* and packages/*)
  - .env.example (add COLYSEUS_PORT)
Indirect Impact:
  - nx.json (no change needed -- existing plugins auto-discover new projects)
  - CI pipeline (.github/workflows/ci.yml -- run-many picks up new projects automatically)
No Ripple Effect:
  - Landing page UI (apps/game/src/app/page.tsx)
  - Auth components (LoginButton, AuthProvider)
  - NextAuth configuration (apps/game/src/auth.ts)
  - Database schema (packages/db/src/schema/)
  - Database services (packages/db/src/services/)
  - Database adapters (packages/db/src/adapters/)
  - Game map generation (apps/game/src/game/mapgen/)
  - Phaser scenes (apps/game/src/game/scenes/) -- except adding connection service import later
  - E2E tests (apps/game-e2e/)
```

### Architecture Overview

```mermaid
graph TB
    subgraph "Browser (Client)"
        PHASER[Phaser.js Game Scene]
        CSVC[services/colyseus.ts<br/>Connection Service]
        COOKIE[Cookie: authjs.session-token]
    end

    subgraph "Next.js App (apps/game, port 3000)"
        NEXTAUTH[auth.ts - NextAuth Config]
        PAGES[App Router Pages]
    end

    subgraph "Colyseus Server (apps/server, port 2567)"
        MAIN[main.ts<br/>Express + Colyseus]
        CONFIG[config.ts<br/>Env Validation]
        VERIFY[auth/verifyToken.ts<br/>jose + HKDF Decrypt]
        ROOM[rooms/GameRoom.ts<br/>onAuth, onJoin, onLeave]
        STATE[rooms/GameRoomState.ts<br/>@colyseus/schema]
    end

    subgraph "Shared Package (packages/shared)"
        TYPES[types/room.ts<br/>Player state interfaces]
        MSGS[types/messages.ts<br/>Message protocol]
        CONSTS[constants.ts<br/>Tick rate, ports]
    end

    subgraph "Database Package (packages/db)"
        ADAPTER[adapters/colyseus.ts<br/>getGameDb / closeGameDb]
        SCHEMA[schema/ users + accounts]
    end

    subgraph "PostgreSQL"
        DB[(Database)]
    end

    PHASER --> CSVC
    CSVC -->|Extract token| COOKIE
    CSVC -->|WebSocket + token| MAIN
    MAIN --> ROOM
    ROOM -->|onAuth| VERIFY
    VERIFY -->|Decrypt JWE| CONFIG
    ROOM --> STATE
    ROOM --> ADAPTER
    ADAPTER --> DB
    STATE -.->|implements| TYPES
    CSVC -.->|imports| TYPES
    CSVC -.->|imports| MSGS
    MAIN -.->|imports| CONSTS
    NEXTAUTH -->|Sets cookie| COOKIE
```

### Data Flow

```mermaid
sequenceDiagram
    participant B as Browser (Phaser)
    participant CS as Connection Service
    participant WS as Colyseus Server (port 2567)
    participant AUTH as verifyToken.ts
    participant GR as GameRoom
    participant DB as PostgreSQL

    Note over B,DB: Player Connection Flow
    B->>CS: initConnection()
    CS->>CS: Extract authjs.session-token from cookies
    CS->>WS: WebSocket connect + joinOrCreate("game_room", { token })

    WS->>GR: static onAuth(token, options, context)
    GR->>AUTH: verifyNextAuthToken(token)
    AUTH->>AUTH: HKDF derive key from AUTH_SECRET
    AUTH->>AUTH: jwtDecrypt(token, derivedKey)

    alt Invalid/Expired Token
        AUTH-->>GR: throw Error
        GR-->>WS: reject connection
        WS-->>CS: Error: authentication failed
        CS-->>B: onError callback
    else Valid Token
        AUTH-->>GR: { userId, email }
        GR-->>WS: allow connection
    end

    WS->>GR: onJoin(client, options, auth)
    GR->>GR: Create Player in state (sessionId, userId, x, y, name)
    GR-->>B: State sync (initial snapshot)

    Note over B,DB: Ongoing State Sync (10 ticks/sec)
    loop Every 100ms
        GR->>GR: Simulation tick
        GR-->>B: Delta state patch
    end

    Note over B,DB: Player Disconnect
    B->>WS: WebSocket close
    WS->>GR: onLeave(client, consented)
    GR->>GR: Remove Player from state
    GR-->>B: State sync (player removed)

    Note over B,DB: Server Shutdown
    WS->>GR: onDispose()
    WS->>DB: closeGameDb()
    WS->>WS: Process exit
```

### Integration Points List

| Integration Point | Location | Old Implementation | New Implementation | Switching Method |
|-------------------|----------|-------------------|-------------------|------------------|
| Server entry | `apps/server/src/main.ts` | None (new app) | Express + Colyseus `defineServer` | New file |
| Auth bridge | `apps/server/src/auth/verifyToken.ts` | None | jose `jwtDecrypt` + HKDF | New file, per ADR-003 |
| DB connection | `apps/server/src/main.ts` | None | `getGameDb()` from `@nookstead/db/adapters/colyseus` | Import existing adapter |
| Client connection | `apps/game/src/services/colyseus.ts` | None | `@colyseus/sdk` Client + joinOrCreate | New file |
| Token extraction | `apps/game/src/services/colyseus.ts` | None | Cookie parsing for `authjs.session-token` | New file, per ADR-003 |
| Shared types | `packages/shared/src/` | None | Type interfaces + constants | New package |
| Build config | `apps/server/project.json` | None | @nx/esbuild:esbuild + @nx/js:node | New file, per ADR-004 |

### Integration Point Map

```yaml
Integration Point 1:
  Existing Component: packages/db/src/adapters/colyseus.ts (getGameDb/closeGameDb)
  Integration Method: Import and call on server startup/shutdown
  Impact Level: Low (Read-Only -- existing adapter used as designed)
  Required Test Coverage: Verify server starts with DB connection; verify graceful shutdown releases connections

Integration Point 2:
  Existing Component: apps/game/src/auth.ts (NextAuth JWT callback sets userId)
  Integration Method: No code change -- auth bridge reads the same token format
  Impact Level: Low (Read-Only -- relies on token payload format)
  Required Test Coverage: Verify onAuth decodes token with userId field

Integration Point 3:
  Existing Component: apps/game/src/game/scenes/Game.ts (Phaser scene lifecycle)
  Integration Method: Future import of connection service from scene (not in initial scope)
  Impact Level: Low (Read-Only -- connection service is a standalone module)
  Required Test Coverage: Verify connection service works independently

Integration Point 4:
  Existing Component: apps/game/package.json (game app dependencies)
  Integration Method: Add @nookstead/shared and @colyseus/sdk dependencies
  Impact Level: Medium (Dependency addition)
  Required Test Coverage: Verify game build succeeds after dependency addition

Integration Point 5:
  Existing Component: package.json (root workspace)
  Integration Method: Add Colyseus, esbuild, jose, express devDependencies
  Impact Level: Medium (Workspace dependency change)
  Required Test Coverage: Verify pnpm install succeeds; verify all existing targets still pass
```

### Main Components

#### Component 1: Server Application (`apps/server/`)

- **Responsibility**: Host Colyseus game server with Express HTTP, WebSocket transport, room definitions, and database integration
- **Interface**: Listens on configurable port (default 2567); exposes GameRoom for WebSocket connections; optional `/health` HTTP endpoint
- **Dependencies**: `colyseus`, `@colyseus/ws-transport`, `@colyseus/schema`, `express`, `jose`, `@panva/hkdf`, `@nookstead/db`, `@nookstead/shared`

#### Component 2: Shared Types Package (`packages/shared/`)

- **Responsibility**: Provide compile-time type safety between client and server for room state, messages, and constants
- **Interface**: Exports TypeScript interfaces and type-safe constants; consumed by both `apps/game` and `apps/server`
- **Dependencies**: None (pure TypeScript types and constants)

#### Component 3: Client Connection Service (`apps/game/src/services/colyseus.ts`)

- **Responsibility**: Manage Colyseus WebSocket connection lifecycle from the browser: token extraction, connection establishment, room join/leave, state observation
- **Interface**: `ColyseusService` class or functions: `connect()`, `joinRoom()`, `leaveRoom()`, `getRoom()`, `onStateChange()`, `disconnect()`
- **Dependencies**: `@colyseus/sdk`, `@nookstead/shared` (for types and constants)

#### Component 4: Auth Verification Module (`apps/server/src/auth/verifyToken.ts`)

- **Responsibility**: Decode NextAuth encrypted JWE tokens using jose + HKDF to extract user identity
- **Interface**: `verifyNextAuthToken(token: string, secret: string): Promise<TokenPayload>`
- **Dependencies**: `jose`, `@panva/hkdf`

### Contract Definitions

```typescript
// packages/shared/src/types/room.ts

/** Player state as synchronized by Colyseus schema (plain interface for type checking) */
export interface PlayerState {
  x: number;
  y: number;
  name: string;
  userId: string;
  connected: boolean;
}

/** GameRoom state shape */
export interface GameRoomState {
  players: Map<string, PlayerState>;
}

/** Auth data returned by onAuth and available in onJoin */
export interface AuthData {
  userId: string;
  email: string;
}
```

```typescript
// packages/shared/src/types/messages.ts

/** Client-to-server message types */
export const ClientMessage = {
  MOVE: 'move',
  CHAT: 'chat',
} as const;

export type ClientMessageType = typeof ClientMessage[keyof typeof ClientMessage];

/** Server-to-client message types */
export const ServerMessage = {
  ERROR: 'error',
  NOTIFICATION: 'notification',
} as const;

export type ServerMessageType = typeof ServerMessage[keyof typeof ServerMessage];

/** Move message payload */
export interface MovePayload {
  x: number;
  y: number;
}
```

```typescript
// packages/shared/src/constants.ts

export const COLYSEUS_PORT = 2567;
export const TICK_RATE = 10; // ticks per second
export const TICK_INTERVAL_MS = 1000 / TICK_RATE; // 100ms
export const PATCH_RATE_MS = 50; // state patch frequency (20 fps)
export const ROOM_NAME = 'game_room';
export const MAX_PLAYERS_PER_ROOM = 50;
```

```typescript
// apps/server/src/auth/verifyToken.ts

export interface TokenPayload {
  userId: string;
  email: string;
  sub: string;
  name?: string;
  picture?: string;
  iat: number;
  exp: number;
  jti: string;
}

export async function verifyNextAuthToken(
  token: string,
  secret: string
): Promise<TokenPayload>;
```

### Data Contract

#### verifyNextAuthToken

```yaml
Input:
  Type: (token: string, secret: string)
  Preconditions:
    - token is a non-empty JWE string (from NextAuth session cookie)
    - secret is the AUTH_SECRET environment variable value
  Validation: jose jwtDecrypt validates token format, encryption, and expiry

Output:
  Type: Promise<TokenPayload>
  Guarantees:
    - Returned payload contains userId (string, UUID from DB)
    - Returned payload contains email (string)
    - Token is not expired (checked by jose with 15s clock tolerance)
  On Error: Throws JWTClaimValidationFailed, JWEDecryptionFailed, or generic Error

Invariants:
  - AUTH_SECRET must match the value used by NextAuth to encrypt the token
  - HKDF salt must be the cookie name (e.g. 'authjs.session-token')
  - HKDF info must be 'Auth.js Generated Encryption Key (<cookie-name>)'
  - HKDF key length must be 64 bytes (for A256CBC-HS512)
```

#### GameRoom.onAuth

```yaml
Input:
  Type: (token: string, options: Record<string, unknown>, context: object)
  Preconditions:
    - Client passes token in joinOrCreate options
  Validation: Delegates to verifyNextAuthToken

Output:
  Type: Promise<AuthData> (returned to Colyseus framework)
  Guarantees:
    - If returned, connection is permitted
    - AuthData available as third argument to onJoin
  On Error: Throws -> Colyseus rejects connection

Invariants:
  - Every connected client has passed authentication
  - onJoin is never called without successful onAuth
```

#### GameRoom.onJoin

```yaml
Input:
  Type: (client: Client, options: Record<string, unknown>, auth: AuthData)
  Preconditions:
    - Client has passed onAuth successfully
    - auth contains { userId, email }
  Validation: None (auth already validated)

Output:
  Type: void
  Guarantees:
    - Player added to state.players map keyed by client.sessionId
    - State change broadcast to all connected clients
  On Error: Logs error; does not crash room

Invariants:
  - state.players.size equals number of connected clients
  - Each player entry has valid userId from auth
```

### Data Representation Decisions

| Data Structure | Decision | Rationale |
|---|---|---|
| `PlayerState` (shared interface) | **New** plain TypeScript interface | No existing player state types; must be importable by both client and server without Colyseus schema dependency |
| `Player` (Colyseus schema class) | **New** `@colyseus/schema` decorated class | Server-only; implements the same shape as `PlayerState` but with Colyseus serialization decorators; cannot be shared as-is because client should not depend on `@colyseus/schema` |
| `GameRoomState` (Colyseus schema class) | **New** `@colyseus/schema` decorated class | Server-only; contains `MapSchema<Player>`; synchronized automatically by Colyseus |
| `AuthData` | **New** plain interface | No existing auth data type for Colyseus context; lightweight interface for onAuth return |
| `TokenPayload` | **New** interface | No existing token payload type; maps to NextAuth JWT claims structure |
| `MovePayload` / Message types | **New** interfaces and const objects | No existing message protocol; defines the client-server communication contract |
| Game constants (TICK_RATE, etc.) | **New** in shared, **separate from** existing `apps/game/src/game/constants.ts` | Existing constants are rendering-specific (TILE_SIZE, MAP_WIDTH); server constants are networking-specific; different domains, different lifecycles |

### State Transitions and Invariants

```yaml
State Definition:
  - Room States: [waiting, active, disposing]
  - Player Connection States: [connecting, authenticated, joined, leaving, disconnected]

State Transitions:
  Room:
    waiting → active: First player joins
    active → active: Players join/leave (at least 1 connected)
    active → disposing: Last player leaves or server shuts down
    disposing → (destroyed): Cleanup complete

  Player:
    connecting → authenticated: onAuth succeeds
    connecting → disconnected: onAuth fails (rejected)
    authenticated → joined: onJoin executes, player added to state
    joined → leaving: Client disconnects or onLeave triggered
    leaving → disconnected: Player removed from state

System Invariants:
  - All entries in state.players correspond to authenticated, connected clients
  - state.players.size == number of active client connections in the room
  - Every player in state has a valid userId from the database
  - Room simulation interval is active while room has 1+ players
  - AUTH_SECRET is never included in state, logs, or error messages
```

### Integration Boundary Contracts

```yaml
Boundary 1: Client Connection Service -> Colyseus Server
  Input: WebSocket connection with { token } in joinOrCreate options
  Output: Room instance with synchronized state (async via WebSocket)
  On Error: Connection rejected (auth failure) or network error; client receives error event

Boundary 2: GameRoom.onAuth -> verifyNextAuthToken
  Input: token string and AUTH_SECRET from environment
  Output: Promise<TokenPayload> with userId and email
  On Error: jose throws JWEDecryptionFailed/JWTClaimValidationFailed; room rejects connection

Boundary 3: Server main.ts -> @nookstead/db (Colyseus adapter)
  Input: Call getGameDb() with DATABASE_URL from environment
  Output: DrizzleClient singleton (sync return after first call)
  On Error: Throws if DATABASE_URL missing; postgres connection error on first query

Boundary 4: apps/server -> packages/shared (type imports)
  Input: TypeScript import of interfaces and constants
  Output: Compile-time types, runtime constants
  On Error: Build failure if package not found or types mismatch

Boundary 5: apps/game -> packages/shared (type imports)
  Input: TypeScript import of interfaces and constants
  Output: Compile-time types, runtime constants
  On Error: Build failure if package not found or types mismatch
```

### Field Propagation Map

```yaml
fields:
  - name: "token (session token)"
    origin: "NextAuth session cookie (authjs.session-token)"
    transformations:
      - layer: "Connection Service (browser)"
        type: "string (from document.cookie)"
        validation: "presence check (null if no cookie)"
      - layer: "Colyseus joinOrCreate options"
        type: "{ token: string }"
        transformation: "passed as join option"
      - layer: "GameRoom.onAuth"
        type: "string (first argument)"
        transformation: "forwarded to verifyNextAuthToken"
      - layer: "verifyNextAuthToken"
        type: "JWE payload -> TokenPayload"
        transformation: "HKDF key derivation, jwtDecrypt, payload extraction"
    destination: "AuthData { userId, email } available in onJoin"
    loss_risk: "none"

  - name: "userId"
    origin: "NextAuth JWT payload (set by jwt callback from DB query)"
    transformations:
      - layer: "verifyNextAuthToken"
        type: "TokenPayload.userId (string, UUID)"
        transformation: "extracted from decrypted JWE payload"
      - layer: "GameRoom.onAuth"
        type: "AuthData.userId"
        transformation: "returned as part of auth result"
      - layer: "GameRoom.onJoin"
        type: "auth.userId (third argument)"
        transformation: "copied to Player state"
      - layer: "GameRoomState"
        type: "Player.userId (@colyseus/schema string)"
        transformation: "stored in state, synchronized to clients"
    destination: "Client-side state (room.state.players.get(sessionId).userId)"
    loss_risk: "low"
    loss_risk_reason: "If JWT callback DB query previously failed, token may not contain userId; onAuth would throw"

  - name: "player position (x, y)"
    origin: "Client move message"
    transformations:
      - layer: "Client Connection Service"
        type: "MovePayload { x: number, y: number }"
        validation: "type check before send"
      - layer: "GameRoom.onMessage(ClientMessage.MOVE)"
        type: "MovePayload"
        validation: "bounds check, type guard"
        transformation: "applied to Player state"
      - layer: "GameRoomState"
        type: "Player.x, Player.y (@colyseus/schema number)"
        transformation: "state mutation triggers delta sync"
    destination: "All connected clients via Colyseus delta patch"
    loss_risk: "none"
```

### Interface Change Impact Analysis

| Existing Operation | New Operation | Conversion Required | Adapter Required | Compatibility Method |
|-------------------|---------------|-------------------|------------------|---------------------|
| (none -- no server) | `defineServer()` with rooms and express | N/A (new) | Not Required | - |
| (none) | `GameRoom.onAuth()` | N/A (new) | Not Required | - |
| (none) | `GameRoom.onJoin()` | N/A (new) | Not Required | - |
| (none) | `GameRoom.onLeave()` | N/A (new) | Not Required | - |
| `getGameDb()` (existing) | `getGameDb()` (called from server) | None | Not Required | Direct import from existing adapter |
| `closeGameDb()` (existing) | `closeGameDb()` (called on shutdown) | None | Not Required | Direct import from existing adapter |
| (none -- no client service) | `ColyseusService.connect()` | N/A (new) | Not Required | - |
| `apps/game/package.json` (no colyseus deps) | Add @nookstead/shared + @colyseus/sdk | Dependency addition | Not Required | Add to dependencies |

### Error Handling

| Error Scenario | Handling Strategy | User Impact |
|---|---|---|
| AUTH_SECRET not set | Server throws on startup with descriptive message | Server does not start; developer sees clear error |
| DATABASE_URL not set | Server throws on startup with descriptive message | Server does not start; developer sees clear error |
| JWE decryption failure (invalid token) | `verifyNextAuthToken` throws; `onAuth` rejects connection | Client receives connection error; must re-authenticate |
| JWE token expired | jose throws `JWTExpired`; `onAuth` rejects | Client receives connection error; session refresh needed |
| No token provided in join options | `onAuth` throws immediately | Client receives connection error |
| Database connection failure | `getGameDb()` throws; logged as error | Server starts but DB operations fail; games cannot persist state |
| Room message with invalid payload | `onMessage` handler validates; logs warning, ignores message | No effect on game state; malformed input discarded |
| WebSocket connection drops | Colyseus triggers `onLeave`; player removed from state | Other players see the player disappear |
| Server process crash | Process exits; no data loss (state is transient) | All connected players disconnected; restart required |
| CORS origin mismatch | Browser rejects WebSocket upgrade | Client cannot connect; developer must configure CORS_ORIGIN |

### Logging and Monitoring

- **Server startup**: Log port, CORS origins, configured tick rate (info level)
- **Player connection**: Log sessionId and userId on successful auth (info level)
- **Player join/leave**: Log sessionId, userId, room ID (info level)
- **Auth failure**: Log error type (warn level) -- never log the token or AUTH_SECRET
- **Message validation failure**: Log message type and client sessionId (warn level)
- **Database errors**: Log error message with context (error level)
- **Shutdown**: Log shutdown initiation and completion (info level)

## Implementation Samples

### Server Entry Point: `apps/server/src/main.ts`

```typescript
import { defineServer, defineRoom } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { getGameDb, closeGameDb } from '@nookstead/db/adapters/colyseus';
import { GameRoom } from './rooms/GameRoom';
import { loadConfig } from './config';
import { ROOM_NAME } from '@nookstead/shared';

const config = loadConfig();

// Initialize database connection
getGameDb();
console.log('[server] Database connection initialized');

const server = defineServer({
  transport: new WebSocketTransport({
    pingInterval: 10000,
  }),

  rooms: {
    [ROOM_NAME]: defineRoom(GameRoom),
  },

  express: (app) => {
    // CORS middleware for HTTP routes
    app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', config.corsOrigin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        uptime: process.uptime(),
      });
    });
  },
});

// Graceful shutdown
const shutdown = async () => {
  console.log('[server] Shutting down gracefully...');
  await closeGameDb();
  console.log('[server] Database connections closed');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(config.port).then(() => {
  console.log(`[server] Colyseus server listening on port ${config.port}`);
});
```

### Environment Configuration: `apps/server/src/config.ts`

```typescript
export interface ServerConfig {
  port: number;
  authSecret: string;
  databaseUrl: string;
  corsOrigin: string;
}

export function loadConfig(): ServerConfig {
  const authSecret = process.env['AUTH_SECRET'];
  if (!authSecret) {
    throw new Error(
      'AUTH_SECRET environment variable is required. ' +
      'Set it to the same value used by NextAuth.'
    );
  }

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required.'
    );
  }

  const port = parseInt(process.env['COLYSEUS_PORT'] ?? '2567', 10);
  const corsOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';

  return { port, authSecret, databaseUrl, corsOrigin };
}
```

### Auth Verification: `apps/server/src/auth/verifyToken.ts`

```typescript
import { jwtDecrypt } from 'jose';
import { hkdf } from '@panva/hkdf';

export interface TokenPayload {
  userId: string;
  email: string;
  sub: string;
  name?: string;
  picture?: string;
  iat: number;
  exp: number;
  jti: string;
}

// Cookie name used by Auth.js for session tokens
const DEV_COOKIE_NAME = 'authjs.session-token';
const PROD_COOKIE_NAME = '__Secure-authjs.session-token';

async function deriveEncryptionKey(
  secret: string,
  cookieName: string
): Promise<Uint8Array> {
  // Must match Auth.js v5 getDerivedEncryptionKey exactly:
  // salt = cookie name, info = 'Auth.js Generated Encryption Key (<cookie-name>)'
  // key length = 64 bytes for A256CBC-HS512
  return new Uint8Array(
    await hkdf(
      'sha256',
      secret,
      cookieName,
      `Auth.js Generated Encryption Key (${cookieName})`,
      64
    )
  );
}

export async function verifyNextAuthToken(
  token: string,
  secret: string,
  isProduction = process.env['NODE_ENV'] === 'production'
): Promise<TokenPayload> {
  // Try the appropriate cookie name based on environment
  const cookieName = isProduction ? PROD_COOKIE_NAME : DEV_COOKIE_NAME;
  const encryptionSecret = await deriveEncryptionKey(secret, cookieName);

  const { payload } = await jwtDecrypt(token, encryptionSecret, {
    clockTolerance: 15,
  });

  if (!payload.userId || typeof payload.userId !== 'string') {
    throw new Error('Token payload missing userId');
  }

  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('Token payload missing email');
  }

  return payload as unknown as TokenPayload;
}
```

### Game Room State: `apps/server/src/rooms/GameRoomState.ts`

```typescript
import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') userId: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('string') name: string = '';
  @type('boolean') connected: boolean = true;
}

export class GameRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
```

### Game Room: `apps/server/src/rooms/GameRoom.ts`

```typescript
import { Room, Client } from 'colyseus';
import { GameRoomState, Player } from './GameRoomState';
import { verifyNextAuthToken, type TokenPayload } from '../auth/verifyToken';
import { loadConfig } from '../config';
import {
  TICK_INTERVAL_MS,
  PATCH_RATE_MS,
  ClientMessage,
  type MovePayload,
  type AuthData,
} from '@nookstead/shared';

export class GameRoom extends Room<GameRoomState> {
  /**
   * Static onAuth is called before room instance methods.
   * Validates the NextAuth JWE token and returns auth data.
   */
  static async onAuth(
    token: string,
    _options: Record<string, unknown>,
    _context: { token: string; headers: Record<string, string>; ip: string }
  ): Promise<AuthData> {
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const config = loadConfig();
    const payload: TokenPayload = await verifyNextAuthToken(
      token,
      config.authSecret
    );

    return {
      userId: payload.userId,
      email: payload.email,
    };
  }

  onCreate(): void {
    this.setState(new GameRoomState());
    this.setPatchRate(PATCH_RATE_MS);

    // Set up simulation interval at configured tick rate
    this.setSimulationInterval((deltaTime) => {
      this.update(deltaTime);
    }, TICK_INTERVAL_MS);

    // Register message handlers
    this.onMessage(ClientMessage.MOVE, (client, payload: MovePayload) => {
      this.handleMove(client, payload);
    });

    console.log(`[GameRoom] Room ${this.roomId} created`);
  }

  onJoin(
    client: Client,
    _options: Record<string, unknown>,
    auth: AuthData
  ): void {
    const player = new Player();
    player.userId = auth.userId;
    player.name = auth.email.split('@')[0]; // Default name from email
    player.x = 0;
    player.y = 0;
    player.connected = true;

    this.state.players.set(client.sessionId, player);

    console.log(
      `[GameRoom] Player joined: sessionId=${client.sessionId}, userId=${auth.userId}`
    );
  }

  onLeave(client: Client, consented: boolean): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      console.log(
        `[GameRoom] Player left: sessionId=${client.sessionId}, userId=${player.userId}, consented=${consented}`
      );
      this.state.players.delete(client.sessionId);
    }
  }

  onDispose(): void {
    console.log(`[GameRoom] Room ${this.roomId} disposing`);
  }

  private update(_deltaTime: number): void {
    // Simulation tick -- game logic goes here in future phases
  }

  private handleMove(client: Client, payload: MovePayload): void {
    if (
      typeof payload?.x !== 'number' ||
      typeof payload?.y !== 'number'
    ) {
      console.warn(
        `[GameRoom] Invalid move payload from ${client.sessionId}`
      );
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.x = payload.x;
      player.y = payload.y;
    }
  }
}
```

### Client Connection Service: `apps/game/src/services/colyseus.ts`

```typescript
import { Client, Room } from '@colyseus/sdk';
import { COLYSEUS_PORT, ROOM_NAME } from '@nookstead/shared';
import type { GameRoomState } from '@nookstead/shared';

const COLYSEUS_URL =
  process.env['NEXT_PUBLIC_COLYSEUS_URL'] ??
  `ws://localhost:${COLYSEUS_PORT}`;

let client: Client | null = null;
let room: Room<GameRoomState> | null = null;

/**
 * Extract the NextAuth session token from cookies.
 * Handles both development (authjs.session-token) and
 * production (__Secure-authjs.session-token) cookie names.
 */
function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  const tokenCookie = cookies.find(
    (c) =>
      c.trim().startsWith('authjs.session-token=') ||
      c.trim().startsWith('__Secure-authjs.session-token=')
  );

  if (!tokenCookie) return null;

  return tokenCookie.split('=').slice(1).join('=');
}

/**
 * Get or create the Colyseus client singleton.
 */
export function getClient(): Client {
  if (!client) {
    client = new Client(COLYSEUS_URL);
  }
  return client;
}

/**
 * Join the game room with the current session token.
 * Returns the Room instance for state observation.
 */
export async function joinGameRoom(): Promise<Room<GameRoomState>> {
  const token = getSessionToken();
  if (!token) {
    throw new Error('No session token found. Please log in first.');
  }

  const colyseusClient = getClient();
  room = await colyseusClient.joinOrCreate<GameRoomState>(ROOM_NAME, {
    token,
  });

  return room;
}

/**
 * Leave the current room and clean up.
 */
export async function leaveGameRoom(consented = true): Promise<void> {
  if (room) {
    await room.leave(consented);
    room = null;
  }
}

/**
 * Get the current room instance (null if not connected).
 */
export function getRoom(): Room<GameRoomState> | null {
  return room;
}

/**
 * Disconnect from the Colyseus server entirely.
 */
export function disconnect(): void {
  if (room) {
    room.leave(true);
    room = null;
  }
  client = null;
}
```

### Nx Build Configuration: `apps/server/project.json`

```json
{
  "name": "server",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/server/src",
  "projectType": "application",
  "tags": ["scope:server", "type:app"],
  "targets": {
    "build": {
      "executor": "@nx/esbuild:esbuild",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/apps/server",
        "main": "apps/server/src/main.ts",
        "tsConfig": "apps/server/tsconfig.app.json",
        "platform": "node",
        "format": ["esm"],
        "bundle": true,
        "thirdParty": true,
        "external": [
          "bufferutil",
          "utf-8-validate"
        ],
        "esbuildOptions": {
          "outExtension": {
            ".js": ".mjs"
          },
          "banner": {
            "js": "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
          }
        }
      },
      "configurations": {
        "production": {
          "esbuildOptions": {
            "minify": true,
            "outExtension": {
              ".js": ".mjs"
            },
            "banner": {
              "js": "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
            }
          }
        }
      }
    },
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "buildTarget": "server:build",
        "watch": true
      },
      "configurations": {
        "production": {
          "buildTarget": "server:build:production"
        }
      }
    }
  }
}
```

### TypeScript Configuration: `apps/server/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "types": ["jest", "node"],
    "outDir": "dist",
    "rootDir": "src",
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "dist",
    "node_modules",
    "jest.config.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "eslint.config.mjs"
  ],
  "references": [
    { "path": "../../packages/db" },
    { "path": "../../packages/shared" }
  ]
}
```

### TypeScript App Configuration: `apps/server/tsconfig.app.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "jest.config.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts"
  ]
}
```

### Server Package Configuration: `apps/server/package.json`

```json
{
  "name": "@nookstead/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@nookstead/db": "workspace:*",
    "@nookstead/shared": "workspace:*"
  },
  "nx": {
    "name": "server",
    "tags": ["scope:server", "type:app"]
  }
}
```

### Shared Package Configuration: `packages/shared/package.json`

```json
{
  "name": "@nookstead/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "nx": {
    "name": "shared",
    "tags": ["scope:shared", "type:lib"]
  }
}
```

### Shared Package Barrel Export: `packages/shared/src/index.ts`

```typescript
export * from './types/room';
export * from './types/messages';
export * from './constants';
```

### Server ESLint Configuration: `apps/server/eslint.config.mjs`

```javascript
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/typescript'],
  {
    ignores: ['dist/**/*'],
  },
];
```

### Server Jest Configuration: `apps/server/jest.config.ts`

```typescript
export default {
  displayName: 'server',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/server',
};
```

### Server Environment Example: `apps/server/.env.example`

```
# Authentication (must match NextAuth AUTH_SECRET)
AUTH_SECRET=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nookstead

# Server
COLYSEUS_PORT=2567
CORS_ORIGIN=http://localhost:3000
```

### Root `.env.example` Update

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nookstead

# NextAuth.js
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=

# Colyseus Server
COLYSEUS_PORT=2567
CORS_ORIGIN=http://localhost:3000

# Colyseus Client (Next.js build-time inlined)
NEXT_PUBLIC_COLYSEUS_URL=ws://localhost:2567
```

## Implementation Plan

### Implementation Approach

**Selected Approach**: Vertical Slice (Feature-driven) with bottom-up dependency ordering

**Selection Reason**: The server infrastructure is a single cohesive feature that cuts across all layers (shared types -> build config -> server app -> auth bridge -> room logic -> client service). Each layer depends on the one below it, making a bottom-up vertical slice the natural approach. The feature is not usable until all layers are connected (a player must be able to connect from the browser to a running Colyseus server with authentication). Horizontal slicing would delay the first end-to-end integration and make it harder to detect issues at boundaries.

### Technical Dependencies and Implementation Order

#### Required Implementation Order

1. **Shared types package (`packages/shared/`)**
   - Technical Reason: Both server and client depend on shared types and constants; must exist first for type safety
   - Dependent Elements: Server rooms, client connection service
   - Verification: L3 (TypeScript compilation succeeds)

2. **Server scaffold and build configuration (`apps/server/`)**
   - Technical Reason: Room logic, auth module, and main.ts all live in the server app; project.json must be configured for esbuild before anything runs
   - Prerequisites: `packages/shared` exists; `@nx/esbuild` installed
   - Dependent Elements: All server source files
   - Verification: L3 (`pnpm nx build server` succeeds)

3. **Auth verification module (`apps/server/src/auth/`)**
   - Technical Reason: GameRoom.onAuth depends on verifyNextAuthToken; must be implemented and unit-tested before room logic
   - Prerequisites: Server scaffold exists; jose and @panva/hkdf installed
   - Dependent Elements: GameRoom
   - Verification: L2 (unit tests pass for valid/invalid/expired tokens)

4. **GameRoom and state schema (`apps/server/src/rooms/`)**
   - Technical Reason: Core server functionality; depends on auth module and shared types
   - Prerequisites: Auth module, shared types
   - Dependent Elements: Server main.ts room registration
   - Verification: L2 (unit tests for join/leave/message handling)

5. **Server main.ts with DB integration**
   - Technical Reason: Wires everything together; depends on rooms, config, DB adapter
   - Prerequisites: Rooms, config, @nookstead/db adapter (already exists)
   - Verification: L1 (`pnpm nx serve server` starts and listens)

6. **Client connection service (`apps/game/src/services/colyseus.ts`)**
   - Technical Reason: Last piece -- connects the browser to the running server
   - Prerequisites: Server running; @colyseus/sdk installed in game app
   - Verification: L1 (manual E2E: connect from browser, see player in state)

### Integration Points

**Integration Point 1: Shared types -> Server + Client**
- Components: `packages/shared` -> `apps/server`, `apps/game`
- Verification: `pnpm nx typecheck server` and `pnpm nx typecheck game` succeed

**Integration Point 2: Auth module -> GameRoom**
- Components: `auth/verifyToken.ts` -> `rooms/GameRoom.ts`
- Verification: Unit test: mock token decryption, verify onAuth returns AuthData

**Integration Point 3: Server -> Database**
- Components: `main.ts` -> `@nookstead/db/adapters/colyseus`
- Verification: Server starts with valid DATABASE_URL; `getGameDb()` returns client

**Integration Point 4: Client -> Server (E2E)**
- Components: `services/colyseus.ts` -> Colyseus server on port 2567
- Verification: Browser connects with valid session token; player appears in room state

**Integration Point 5: Build pipeline**
- Components: `project.json` -> esbuild -> dist/apps/server
- Verification: `pnpm nx build server` produces runnable bundle; `pnpm nx run-many -t lint test build typecheck` passes

### Migration Strategy

This is a purely additive change. No existing code is modified or migrated. The new server app, shared package, and client service are all new files. Existing CI targets continue to work because:

- Nx plugins auto-discover new projects from config files
- `run-many -t lint test build typecheck` picks up new projects automatically
- No existing test, build, or lint targets are affected

## Test Strategy

### Basic Test Design Policy

Test cases are derived directly from acceptance criteria. The primary testing surfaces are:
1. `verifyNextAuthToken` -- pure function, easily unit-tested with mock tokens
2. `GameRoom` lifecycle hooks -- testable with Colyseus test utilities
3. `loadConfig` -- pure function, testable with environment variable mocking

### Unit Tests

**Target**: `apps/server/src/auth/verifyToken.ts`

| AC | Test Case | Assertion |
|---|---|---|
| Valid token decode | Call with properly encrypted JWE containing userId and email | Returns TokenPayload with correct userId and email |
| Missing userId | Call with JWE that has no userId claim | Throws "Token payload missing userId" |
| Missing email | Call with JWE that has no email claim | Throws "Token payload missing email" |
| Expired token | Call with JWE past expiry time | Throws JWTExpired error from jose |
| Invalid token format | Call with random string | Throws JWEDecryptionFailed |
| Wrong secret | Call with valid JWE but wrong AUTH_SECRET | Throws JWEDecryptionFailed |

**Target**: `apps/server/src/config.ts`

| AC | Test Case | Assertion |
|---|---|---|
| Missing AUTH_SECRET | Call loadConfig without AUTH_SECRET env | Throws descriptive error |
| Missing DATABASE_URL | Call loadConfig without DATABASE_URL env | Throws descriptive error |
| Default port | Call loadConfig without COLYSEUS_PORT | Returns port 2567 |
| Custom port | Call loadConfig with COLYSEUS_PORT=3000 | Returns port 3000 |
| Default CORS origin | Call loadConfig without CORS_ORIGIN | Returns `http://localhost:3000` |

**Target**: `apps/server/src/rooms/GameRoom.ts`

| AC | Test Case | Assertion |
|---|---|---|
| Player join | Call onJoin with mock client and auth data | Player added to state.players with correct userId, x=0, y=0 |
| Player leave | Call onLeave with connected player | Player removed from state.players |
| Move message (valid) | Send MOVE message with { x: 10, y: 20 } | Player position updated to (10, 20) |
| Move message (invalid) | Send MOVE message with { x: "abc" } | Warning logged; state unchanged |
| Auth rejection (no token) | Call onAuth with empty string | Throws "No authentication token provided" |

### Integration Tests

**Target**: Server startup and DB integration

| AC | Test Case | Assertion |
|---|---|---|
| Server starts | Start server with valid env vars | Server logs listening on configured port |
| DB initialization | Start server with valid DATABASE_URL | getGameDb() returns non-null client |
| Graceful shutdown | Send SIGTERM to running server | closeGameDb() is called; process exits 0 |

### E2E Tests

E2E verification of the full connection flow (browser -> WebSocket -> Colyseus -> auth -> room) is outside the scope of automated tests for this phase. Manual E2E verification steps:

1. Start server: `pnpm nx serve server`
2. Start client: `pnpm nx dev game`
3. Log in via Google/Discord OAuth
4. Navigate to `/game`
5. Open browser console; call `joinGameRoom()` from connection service
6. Verify WebSocket connection established (no error)
7. Open a second browser tab, repeat login and join
8. Verify both tabs show 2 players in room state

### Performance Tests

Not required for initial implementation. Performance targets (10 ticks/sec, <150ms latency) are verified through:
- Server-side timing logs in simulation interval
- Manual latency measurement with two browser clients on localhost

## Security Considerations

1. **Authentication enforcement**: Every WebSocket connection must pass through `onAuth()`. Colyseus guarantees `onJoin()` is never called without successful `onAuth()`. No unauthenticated connections are possible.

2. **AUTH_SECRET protection**: The secret is loaded from environment variables and never logged, serialized, or included in error messages. The `loadConfig()` function validates presence but does not expose the value.

3. **Token validation**: jose's `jwtDecrypt` validates token encryption, structure, and expiry. The 15-second clock tolerance accounts for minor time drift.

4. **Input validation**: All client messages are validated in `onMessage` handlers before modifying state. Invalid payloads are logged and discarded.

5. **CORS configuration**: WebSocket connections are restricted to configured origins. Development defaults to `localhost:3000`; production uses `CORS_ORIGIN` environment variable.

6. **No sensitive data in state**: The room state contains userId (UUID) and display name but no email, tokens, or other PII. Only the server-side auth data retains the email.

7. **Database connection security**: Uses the existing `@nookstead/db` adapter which connects via `DATABASE_URL` with connection pooling. No raw SQL; all queries through Drizzle ORM's parameterized interface.

## Future Extensibility

1. **NPC agent rooms**: The room-based architecture allows adding `NPCAgentRoom` or incorporating AI agent logic into GameRoom via additional message handlers and server-side services, without changing the connection or auth infrastructure.

2. **Game clock**: The `setSimulationInterval` provides the foundation for adding a game clock (1 game hour = 1 real minute) in the tick callback.

3. **Chat system**: Additional room types (e.g., `ChatRoom`) can be registered alongside `GameRoom` in `defineServer`.

4. **Redis state persistence**: Colyseus supports Redis presence for room data persistence and horizontal scaling. The `defineServer` configuration can be extended with `presence` option.

5. **Reconnection**: Colyseus provides `allowReconnection(client, seconds)` in `onLeave`/`onDrop` for handling transient disconnections. Can be added without architectural changes.

6. **Additional state fields**: The Player schema can be extended with inventory, health, equipment, and other game state fields as gameplay features are implemented.

7. **Multiple room types**: The shared types package (`packages/shared`) is designed to accommodate types for multiple room types as they are added.

## Alternative Solutions

### Alternative 1: Socket.IO Instead of Colyseus

- **Overview**: Use Socket.IO for WebSocket communication with custom state management and serialization.
- **Advantages**: More widely known; simpler API for basic pub/sub; no schema class requirements.
- **Disadvantages**: No built-in state synchronization or delta compression; no room-based matchmaking; requires building all game server features (state sync, serialization, room management) from scratch; significantly more development effort.
- **Reason for Rejection**: Colyseus provides authoritative state sync, delta compression, and room management out of the box -- features that would take weeks to build with raw Socket.IO. The decorator-based schema is a minor trade-off for substantial infrastructure savings.

### Alternative 2: Separate Auth Microservice

- **Overview**: Build a dedicated authentication microservice that issues short-lived game tokens, rather than decoding NextAuth tokens directly.
- **Advantages**: Clean separation of concerns; Colyseus does not depend on NextAuth internals; easier to swap auth providers.
- **Disadvantages**: Additional HTTP roundtrip before each WebSocket connection; second secret to manage; extra service to maintain and deploy.
- **Reason for Rejection**: Per ADR-003, the shared AUTH_SECRET approach is simpler and has zero additional infrastructure. The coupling risk is acceptable because both services are in the same monorepo.

### Alternative 3: Monolithic Next.js WebSocket Integration

- **Overview**: Run the Colyseus server inside the Next.js process using a custom server adapter.
- **Advantages**: Single process; no CORS issues; shared memory space.
- **Disadvantages**: Next.js is not designed for long-running WebSocket connections; the game server's 10 tick/sec simulation would compete with SSR/API route handling; scaling game server independently is impossible; debugging is harder with interleaved concerns.
- **Reason for Rejection**: Separation of concerns is critical. The game server needs its own process with dedicated CPU for simulation ticks. The CORS overhead is minimal compared to the architectural clarity of separate processes.

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| NextAuth v5 JWE format changes in beta updates | High | Medium | Pin `next-auth@5.0.0-beta.30`; integration test for token decryption; ADR-003 documents kill criteria with fallback to Game-Token API |
| Colyseus @colyseus/schema decorators not preserved through esbuild | High | Low | Test early with minimal schema class; esbuild preserves decorators by default (no transform); add integration test |
| esbuild bundling fails with native modules | Medium | Low | `external` config for `bufferutil`, `utf-8-validate`; `platform: "node"` auto-externalizes Node builtins |
| `experimentalDecorators` + `useDefineForClassFields:false` conflicts with tsconfig.base.json | Medium | Medium | Server tsconfig.json overrides these specific settings; does not affect other projects |
| CORS misconfiguration blocks WebSocket upgrade | Medium | Medium | Test WebSocket connection early in development; document correct `CORS_ORIGIN` setup |
| `@nx/js:node` watch mode instability (known Nx issue #32385) | Low | Medium | Documented in ADR-004; fallback to manual restart; monitor Nx releases for fix |
| Database pool exhaustion with many rooms | Low | Low | Default pool size is 20 (from Colyseus adapter); M0.2 target is 10 players; monitor pool usage |
| jose or @panva/hkdf breaking changes | Medium | Low | Pin dependency versions; unit tests cover decryption; jose is mature (v5+) |

## References

- [Colyseus Server Documentation](https://docs.colyseus.io/server) -- defineServer API, room lifecycle, transport configuration
- [Colyseus Room Authentication](https://docs.colyseus.io/auth/room) -- static onAuth method, token validation patterns
- [Colyseus Schema Definition](https://docs.colyseus.io/state/schema) -- @type decorator, MapSchema, Player schema patterns
- [Colyseus WebSocket Transport](https://docs.colyseus.io/server/transport/ws) -- @colyseus/ws-transport configuration
- [Colyseus Client SDK](https://docs.colyseus.io/sdk) -- @colyseus/sdk Client class, joinOrCreate API
- [Colyseus Fixed Tick Rate Tutorial](https://docs.colyseus.io/learn/tutorial/phaser/fixed-tickrate) -- setSimulationInterval, input queue pattern
- [@colyseus/schema npm](https://www.npmjs.com/package/@colyseus/schema) -- Schema serialization package
- [Nx esbuild Plugin](https://nx.dev/docs/technologies/build-tools/esbuild/introduction) -- @nx/esbuild executor configuration
- [Nx @nx/js:node Executor](https://nx.dev/docs/technologies/typescript/executors) -- Node.js serve executor with watch mode
- [Nx esbuild Executors Reference](https://nx.dev/docs/technologies/build-tools/esbuild/executors) -- esbuild options, external, format, platform
- [jose Library](https://github.com/panva/jose) -- JWE/JWS implementation for Node.js
- [NextAuth JWT Decryption (GitHub Issue #5904)](https://github.com/nextauthjs/next-auth/issues/5904) -- Community patterns for external JWE decryption
- [Decoding Auth.js JWTs in External Services (Medium)](https://medium.com/@noahyoungs/decoding-auth-js-jwts-in-python-reverse-engineering-02deea5ce393) -- HKDF key derivation details
- [ADR-002: Player Authentication with NextAuth.js v5](../adr/adr-002-nextauth-authentication.md)
- [ADR-003: Authentication Bridge between NextAuth and Colyseus](../adr/adr-003-colyseus-auth-bridge.md)
- [ADR-004: Build and Serve Tooling for Colyseus Game Server](../adr/adr-004-colyseus-build-tooling.md)
- [PRD-002: Colyseus Game Server](../prd/prd-002-colyseus-game-server.md)

## Update History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-15 | 1.0 | Initial version | AI |
