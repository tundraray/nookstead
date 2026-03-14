# ADR-0017: Player Client-Side Pathfinding and Shared Pathfinder Package

## Status

Proposed

## Context

The player click-to-move system currently moves the player in a straight line toward the clicked tile (implemented in `WalkState.moveTowardTarget()`). When obstacles exist between the player and the target, the player walks into the wall and stops -- there is no path computation to navigate around obstacles. This is the same class of problem that NPC bots had before ADR-0016 introduced A* pathfinding for NPCs.

Additionally, the `Pathfinder` class (a thin wrapper around the `pathfinding` npm library) currently lives in `apps/server/src/npc-service/movement/Pathfinder.ts`. It is a generic, map-agnostic A* wrapper with no NPC-specific logic, yet it is embedded inside the server's NPC service. To reuse it on the client for player pathfinding, it must be extracted to a shared package.

### Technical Constraints

- **Client-predicted movement model**: The client computes per-frame `{dx, dy}` deltas locally and sends them to the server. The server validates and applies movement authoritatively. No path data is exchanged over the network.
- **Walkability grid available on client**: `mapData.walkable` (boolean[][]) is already sent to the client at map load and stored on the Player entity.
- **Grid size**: 64x64 tiles (4,096 nodes). A* on this grid completes in <1ms.
- **4-directional movement**: Matches pixel art aesthetic (DiagonalMovement.Never).
- **`pathfinding` npm library**: Already a dependency of `apps/server` (v0.4.18). Battle-tested, zero-dependency, synchronous API. Selected in ADR-0016.
- **Existing shared package pattern**: The monorepo has 6 shared packages under `packages/` using `workspace:*` dependencies, barrel exports, and `tsconfig.lib.json`.

### Two Decisions in Scope

This ADR covers two related decisions:

1. **Where to run player pathfinding** -- client-side vs. server-side vs. hybrid
2. **Where to locate the Pathfinder class** -- keep in server vs. extract to shared package

These decisions are coupled: if pathfinding runs client-side, the Pathfinder must be accessible from the client package.

---

## Decision

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Run player pathfinding client-side in the browser and extract the Pathfinder class to a new `@nookstead/pathfinding` shared package |
| **Why now** | Click-to-move is the primary player navigation method; walking into walls is a visible UX deficiency that undermines the feel of movement |
| **Why this** | Client-side computation eliminates network round-trip latency, preserves the existing `{dx, dy}` movement protocol unchanged, and the shared package follows established monorepo patterns while enabling code reuse |
| **Known unknowns** | Whether the `pathfinding` npm library's browser bundle size is acceptable for the game client (~3KB gzipped, likely negligible relative to Phaser.js); whether longer A* paths (200 waypoints) cause any perceptible per-frame overhead in waypoint following |
| **Kill criteria** | If client-side path computation causes frame drops (>2ms per path on 64x64 grid) on target hardware, or if server-side validation rejects too many client-predicted moves due to path divergence |

---

## Rationale

### Options Considered

#### Option A: Server-Side Pathfinding for Player

- **Description**: Player clicks a tile, client sends a `PATH_REQUEST` message to the server, server computes A* path and returns waypoints, client follows the waypoints.
- **Pros**:
  - Single source of truth for pathfinding (server already has Pathfinder)
  - Server can validate the entire path, not just per-frame deltas
  - No need to ship `pathfinding` library to the browser
- **Cons**:
  - Network round-trip latency (50-200ms) creates a perceptible delay between click and movement start
  - Requires new message types (`PATH_REQUEST`, `PATH_RESPONSE`) -- protocol change
  - Server must handle path requests from all connected players, adding load
  - Breaks the existing client-predicted movement model: player would need to wait for server response before moving
  - More complex error handling: what happens if path response arrives after player has already moved via keyboard?
- **Effort**: 3 days (new protocol, server handler, client waiting logic)

#### Option B (Selected): Client-Side Pathfinding with Shared Package

- **Description**: Extract `Pathfinder.ts` to `packages/pathfinding/`, add it as a dependency of both `apps/server` and `apps/game`. When the player clicks, compute the A* path in the browser using the locally-available walkability grid, then follow waypoints using the existing per-frame `{dx, dy}` movement protocol.
- **Pros**:
  - Zero latency: path appears immediately on click
  - No protocol changes: server continues to receive per-frame `{dx, dy}` deltas
  - No additional server load for player pathfinding
  - Code reuse: both server (NPC) and client (player) use the same Pathfinder
  - Follows established monorepo shared package patterns (`@nookstead/shared`, `@nookstead/map-lib`, etc.)
  - Pathfinder is already map-agnostic and has no server dependencies
- **Cons**:
  - `pathfinding` npm library added to client bundle (~3KB gzipped -- negligible vs Phaser.js ~1MB)
  - Walkability grid could theoretically diverge between client and server (mitigated: grid is sent at map load and updated via object placement events)
  - Client can compute paths to tiles the server might not allow (mitigated: server still validates per-frame movement, so the player cannot actually reach disallowed positions)
- **Effort**: 1.5 days

#### Option C: Client-Side Custom A* (No Shared Package)

- **Description**: Write a separate, lightweight A* implementation directly in `apps/game/src/game/systems/` without extracting the server's Pathfinder. Both client and server maintain independent pathfinding implementations.
- **Pros**:
  - No cross-package dependency needed
  - Can be optimized specifically for browser (e.g., using TypedArrays)
  - No shared package maintenance overhead
- **Cons**:
  - Code duplication: two separate A* implementations doing the same thing
  - Violates DRY principle and Rule of Three (this would be the 2nd implementation, with potential 3rd for town NPCs)
  - Double maintenance burden: bugs must be fixed in both places
  - Inconsistent pathfinding behavior between NPCs and player (different implementations could produce different paths)
  - Contradicts existing monorepo pattern of extracting shared logic to packages
- **Effort**: 2 days (implement + test a second A* system)

#### Option D: Hybrid -- Client Computes, Server Validates Full Path

- **Description**: Client computes A* path locally and sends the full path to the server. Server validates the path is legal (all waypoints walkable, connected), then the client follows it. Server rejects invalid paths.
- **Pros**:
  - Client gets immediate path feedback
  - Server can detect tampering or grid divergence
  - Path validation is cheaper than path computation
- **Cons**:
  - Requires new message type (`PATH_VALIDATE`) -- protocol change
  - Path validation adds per-click server load for every connected player
  - Overengineered for the threat model: the server already validates per-frame movement deltas, so even if the client follows a "wrong" path, the server prevents illegal positions
  - Additional complexity with no practical benefit over Option B
  - What happens if server rejects the path? Client is already moving. Requires rollback logic.
- **Effort**: 2.5 days

### Comparison

| Evaluation Axis | A: Server-Side | B: Client + Shared (Selected) | C: Client Custom | D: Hybrid |
|-----------------|---------------|------------------------------|-------------------|-----------|
| Click-to-move latency | 50-200ms (network) | 0ms (local) | 0ms (local) | 0ms (local) |
| Protocol changes | Yes (2 new msgs) | None | None | Yes (1 new msg) |
| Server load | +1 handler/player | None | None | +1 handler/player |
| Code duplication | None | None | Yes (2 A* impls) | None |
| Client bundle impact | None | +3KB gzipped | +custom impl | +3KB gzipped |
| Implementation effort | 3 days | 1.5 days | 2 days | 2.5 days |
| Consistency (NPC/player paths) | Same Pathfinder | Same Pathfinder | Different impls | Same Pathfinder |
| Cheat resistance | High | Adequate (per-frame validation) | Adequate | High |
| Monorepo pattern fit | N/A (no extraction) | Excellent | Poor (duplication) | Excellent |
| Existing protocol preservation | No | Yes | Yes | No |

### Selection Rationale

Option B is selected for four reasons:

1. **Zero latency**: In a life sim / farming RPG, click-to-move must feel instant. A 50-200ms delay (Option A) would feel sluggish. Client-side computation makes path display instantaneous.

2. **No protocol changes**: The server already validates per-frame `{dx, dy}` deltas. Adding path-level validation (Options A, D) is overengineered for a cooperative game where the threat model does not include adversarial clients. The existing validation is sufficient.

3. **Code reuse without duplication**: The Pathfinder class is already written, tested, and map-agnostic. Extracting it to a shared package follows the established monorepo pattern (6 existing shared packages) and avoids the DRY violation of Option C. Both server NPCs and the player client use identical pathfinding logic.

4. **Minimal effort**: 1.5 days is the lowest effort option. The Pathfinder has zero server-specific dependencies -- extraction is a file move plus package scaffolding.

---

## Consequences

### Positive Consequences

- Player navigates around obstacles (walls, placed objects, water) instead of walking into them
- Click-to-move feels responsive with zero-latency path computation
- Single Pathfinder implementation shared between server and client ensures consistent behavior
- New `@nookstead/pathfinding` package is reusable for any future pathfinding needs (town NPCs, enemies, etc.)
- No changes to the multiplayer movement protocol -- server-side movement validation is unaffected

### Negative Consequences

- `pathfinding` npm library added to client bundle (~3KB gzipped) -- negligible but non-zero
- Walkability grid is duplicated in memory (client has its own copy) -- already the case, no new duplication
- Client-computed paths are not server-validated at the path level (only per-frame delta validation) -- acceptable for a cooperative game

### Neutral Consequences

- `apps/server/src/npc-service/movement/Pathfinder.ts` is deleted; server imports from `@nookstead/pathfinding` instead
- `apps/server/src/npc-service/movement/index.ts` re-exports from the shared package for backward compatibility
- A new entry appears in `pnpm-workspace.yaml` packages (already covered by `packages/*` glob)
- `pathfinding` npm dependency moves from `apps/server/package.json` to `packages/pathfinding/package.json`

---

## Architecture

### Package Extraction

```
BEFORE:
  apps/server/
    npc-service/movement/
      Pathfinder.ts          <- server-only, but map-agnostic
      NPCMovementEngine.ts   <- NPC-specific
      index.ts               <- exports both

AFTER:
  packages/pathfinding/      <- NEW shared package
    src/
      Pathfinder.ts          <- moved here (identical code)
      index.ts               <- barrel export
    package.json             <- depends on `pathfinding` npm
    tsconfig.json
    tsconfig.lib.json

  apps/server/
    npc-service/movement/
      NPCMovementEngine.ts   <- unchanged
      index.ts               <- re-exports from @nookstead/pathfinding

  apps/game/
    game/systems/
      click-pathfinding.ts   <- NEW: uses @nookstead/pathfinding
```

### Data Flow

```mermaid
graph LR
    A[Player clicks tile] -->|pixel coords| B[click-pathfinding.ts]
    B -->|tile coords| C["@nookstead/pathfinding<br/>Pathfinder.findPath()"]
    C -->|Point[] waypoints| B
    B -->|waypoints| D[Player.setMoveTarget]
    D -->|per-frame dx,dy| E[WalkState.moveTowardTarget]
    E -->|dx,dy| F[Server via Colyseus]
    F -->|authoritative pos| G[Player.reconcile]
```

---

## Implementation Guidance

- The Pathfinder class must remain map-agnostic -- it operates on any `boolean[][]` grid with no game-specific logic
- The shared package should follow the established pattern: `workspace:*` dependency, barrel export via `src/index.ts`, `tsconfig.lib.json` for builds
- The `pathfinding` npm dependency and `@types/pathfinding` must move to `packages/pathfinding/package.json`, not remain in `apps/server`
- Server-side `npc-service/movement/index.ts` should re-export Pathfinder and Point from the shared package for backward compatibility with existing imports
- The client should accept a configurable max path length constant (separate from `BOT_MAX_PATH_LENGTH`) since player click range may differ from NPC wander radius
- Use dependency injection where possible: pass the Pathfinder instance or walkability grid rather than importing globals

---

## Related Information

- [ADR-0016: NPC A* Pathfinding](ADR-0016-npc-astar-pathfinding.md) -- Original decision to use the `pathfinding` npm library for NPC pathfinding. This ADR extends that decision to the player client.
- [ADR-0013: NPC Bot Entity Architecture](ADR-0013-npc-bot-entity-architecture.md) -- Defines the NPC movement model that the Pathfinder was originally built for.
- [Design-024: Player Click-to-Move A* Pathfinding](../design/design-024-player-click-pathfinding.md) -- Detailed implementation design for this ADR.

## References

- [PathFinding.js by qiao (GitHub)](https://github.com/qiao/PathFinding.js) -- The `pathfinding` npm package used by both server and client
- [pathfinding npm package](https://www.npmjs.com/package/pathfinding) -- Package registry page (~22K weekly downloads for `@types/pathfinding`)
- [Nx Monorepo Package Structure](https://nx.dev/concepts/more-concepts/applications-and-libraries) -- Nx documentation on shared library patterns used in this monorepo
