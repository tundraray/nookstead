# ADR-0016: NPC A* Pathfinding Navigation System

## Status

Accepted

## Context

NPC bot companions on player homesteads currently use straight-line movement with per-tick walkability checks (ADR-0013, Decision 5). When a bot picks a random walkable tile as its wander target, it moves toward it in a direct line and falls back to picking a new target if it hits an obstacle. This approach was chosen explicitly as an MVP trade-off, with the expectation that A* pathfinding would replace it.

The straight-line approach has the following problems:

1. **Obstacle trapping**: Bots frequently pick targets behind walls or around corners that are unreachable via straight line, triggering the stuck-detection timeout (5 seconds of no progress) before they recover.
2. **Unnatural movement**: Bots oscillate between "walk into wall" and "pick new random target" rather than navigating around obstacles, which looks broken to players.
3. **Wasted ticks**: Each failed movement attempt consumes ticks before stuck detection fires, during which the bot visibly jitters against the obstacle.

The NPC Service architecture document (`docs/documentation/design/systems/npc-service.md`) planned an A* pathfinding module at `npc-service/movement/Pathfinder.ts` from the outset. This ADR formalizes the decision to implement it using the `pathfinding` npm library.

### Technical Constraints

- **Tick budget**: 100ms per tick (`PATCH_RATE_MS`). Path computation must be negligible within this budget.
- **Grid size**: 64x64 tiles (4,096 nodes). Small enough that A* is trivially fast.
- **Bot count**: 1-5 bots per homestead (`MAX_BOTS_PER_HOMESTEAD=5`). Low concurrency.
- **Walkability grid**: Already computed as `boolean[][]` (row-major `[y][x]`) by `recomputeWalkability()` in `packages/map-lib/src/core/walkability.ts`, with object collision zones applied by `applyObjectCollisionZones()`.
- **Movement**: 4-directional only (up/down/left/right) to match pixel art aesthetic.
- **Server-only**: Pathfinding runs on the Colyseus game server (`apps/server`), not the client.

---

## Decision

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Use the `pathfinding` npm package (PathFinding.js by qiao) for A* grid-based pathfinding, wrapped in a new `movement/` module within `npc-service/` |
| **Why now** | Bots visibly get stuck on obstacles with the current straight-line approach, degrading the player experience on homesteads with placed objects |
| **Why this** | The `pathfinding` library provides a battle-tested A* implementation purpose-built for 2D grids, avoiding the cost and risk of a custom implementation. It supports orthogonal-only movement and is zero-dependency (~3KB gzipped) |
| **Known unknowns** | Whether the library's `Grid.clone()` performance is acceptable for frequent re-pathfinding when walkability changes (issue qiao/PathFinding.js#33 documents this); mitigated by dirty-flag invalidation rather than per-tick cloning |
| **Kill criteria** | If pathfinding computation exceeds 5ms per tick with 5 concurrent bots, or if the library becomes unmaintained and a critical bug is discovered |

---

## Rationale

### Options Considered

#### Option A: Custom A* Implementation

- **Description**: Implement A* from scratch in TypeScript within `npc-service/movement/Pathfinder.ts`. Use the existing `boolean[][]` walkability grid directly as the node graph, with Manhattan distance heuristic and 4-directional neighbors.
- **Pros**:
  - Zero external dependencies
  - Full control over data structures (can use typed arrays for performance)
  - Can be tailored exactly to our grid format (`boolean[][]` row-major)
  - No `Grid.clone()` overhead -- work directly on our own structures
- **Cons**:
  - Development time: 2-3 days for implementation + testing + edge cases
  - Bug surface: A* has subtle correctness issues (tie-breaking, grid boundary handling, open/closed set management)
  - Maintenance burden: we own all bugs and optimizations
  - No path smoothing or alternative algorithms included
- **Effort**: 3 days

#### Option B (Selected): Use `pathfinding` npm Package

- **Description**: Install `pathfinding` (PathFinding.js by qiao) as a dependency of `apps/server`. Create a thin adapter layer (`Pathfinder.ts`) that converts our `boolean[][]` grid to the library's `PF.Grid` format and exposes a `findPath(from, to): Point[]` interface.
- **Pros**:
  - Proven implementation used in thousands of 2D games, ~22K weekly downloads for `@types/pathfinding`
  - Supports `DiagonalMovement.Never` (exact match for our 4-directional requirement)
  - Includes multiple algorithms (A*, Best-First, Bi-directional A*) -- can swap without code changes
  - Path smoothing available via `PF.Util.smoothenPath()` if needed later
  - Comprehensive test suite in the library itself
  - Zero dependencies, ~3KB gzipped
  - Interactive visual debugger at `qiao.github.io/PathFinding.js/visual/` aids development
- **Cons**:
  - External dependency (though zero-dep and stable -- last breaking change was v0.4.x)
  - `Grid.clone()` required for each `findPath` call (library mutates the grid internally); mitigated by keeping a reference grid and cloning per-call
  - No TypeScript source (uses `@types/pathfinding` for type definitions)
  - Grid format conversion needed: our `boolean[][]` to `PF.Grid`
- **Effort**: 1 day

#### Option C: EasyStar.js

- **Description**: Use `easystarjs` npm package, another popular grid-based pathfinding library with an async/callback API designed for game engines.
- **Pros**:
  - Async API with `calculatePath()` callback -- doesn't block the event loop
  - Built-in cost-based pathfinding (weighted tiles)
  - Simple API
- **Cons**:
  - Async/callback API adds complexity -- our tick loop is synchronous, so we would need to pre-compute paths or manage callback timing
  - Less control over when computation happens relative to tick budget
  - Smaller community than PathFinding.js
  - No built-in path smoothing
  - Does not support multiple algorithm backends
- **Effort**: 1.5 days

### Comparison

| Evaluation Axis | Option A: Custom A* | Option B: pathfinding (Selected) | Option C: EasyStar.js |
|-----------------|---------------------|----------------------------------|----------------------|
| Implementation effort | 3 days | 1 day | 1.5 days |
| Correctness risk | Medium (subtle bugs) | Low (battle-tested) | Low (battle-tested) |
| Maintenance burden | High (we own it all) | Low (library maintained) | Low (library maintained) |
| Performance on 64x64 | Excellent (custom) | Excellent (< 1ms) | Good (async overhead) |
| API fit (sync tick loop) | Excellent | Excellent | Poor (async/callback) |
| 4-dir movement support | Manual | `DiagonalMovement.Never` | `setAcceptableTiles()` |
| Bundle size | 0 (built-in) | ~3KB gzipped | ~5KB gzipped |
| Algorithm flexibility | Single (A*) | Multiple (A*, BFS, etc.) | Single (A*) |
| TypeScript types | Native | `@types/pathfinding` | `@types/easystarjs` |

### Selection Rationale

Option B is selected for three reasons:

1. **Effort**: 1 day vs. 3 days eliminates the primary cost with no meaningful trade-off -- the library does exactly what we need.
2. **API fit**: The synchronous `finder.findPath()` call integrates cleanly into our synchronous tick loop, unlike EasyStar's async model.
3. **Correctness**: A* on grids has well-documented edge cases. Using a library with an existing test suite and thousands of production users eliminates our bug surface for this component entirely.

The `Grid.clone()` concern is mitigated by our architecture: we clone the grid only when a path is requested, and with 5 bots on a 64x64 grid computing paths at most once per wander interval (every 3 seconds), cloning overhead is negligible.

---

## Consequences

### Positive Consequences

- Bots navigate around obstacles (walls, placed objects, water tiles) instead of walking into them and getting stuck
- Movement looks natural and intentional -- bots follow coherent tile-by-tile paths
- Aligns with the planned `npc-service/movement/` module structure from `npc-service.md`
- Foundation for future schedule-based NPC navigation (walk to bakery, walk to cafe) when town NPCs are added
- Stuck-detection timeout fires less frequently (only for genuinely unreachable targets, not obstacle collisions)

### Negative Consequences

- New npm dependency (`pathfinding`) added to `apps/server` -- increases install footprint by ~3KB
- Grid conversion overhead: must build a `PF.Grid` from `boolean[][]` on map load, and clone it per `findPath` call
- BotManager refactoring: `tickWalking()` changes from "move toward single target" to "follow waypoint queue" -- existing tests will need updates

### Neutral Consequences

- `hasLineOfSight()` (Bresenham's line) in BotManager is removed -- A* replaces line-of-sight for target validation
- `ServerBot` interface gains `waypoints: Point[]`, `currentWaypointIndex`, `routeComputedAt`, and `failedWanderAttempts` fields
- The `pathfinding` library's `Grid` is an internal detail of the `Pathfinder` class -- no other module needs to know about it

---

## Architecture

### Module Structure

```
apps/server/src/npc-service/
  movement/                      # NEW module
    Pathfinder.ts                # Wraps pathfinding library, manages grid
    NPCMovementEngine.ts         # Executes waypoint-queue movement per tick
    CollisionAvoidance.ts        # DEFERRED (future: NPC-NPC collision)
  lifecycle/
    BotManager.ts                # REFACTORED: delegates to NPCMovementEngine
  types/
    bot-types.ts                 # EXTENDED: waypoints field on ServerBot
```

### Data Flow

```mermaid
graph LR
    A[ChunkRoom.onJoin] -->|walkable grid| B[Pathfinder.init]
    B -->|PF.Grid cached| C[Pathfinder]
    D[BotManager.startWander] -->|from, to tiles| C
    C -->|Point array| D
    D -->|waypoints| E[NPCMovementEngine.tick]
    E -->|BotUpdate| F[ChunkRoom schema sync]
    G[Grid change event] -->|dirty tiles| C
    C -->|invalidate cached routes| D
```

### Key Design Decisions within This ADR

**1. Grid Representation Adapter**

The `Pathfinder` class owns the conversion from our `boolean[][]` to `PF.Grid`:

```typescript
// Conceptual interface -- implementation details in Design Doc
class Pathfinder {
  constructor(walkable: boolean[][]);
  findPath(startX: number, startY: number, endX: number, endY: number): Point[];
  updateGrid(walkable: boolean[][]): void;
  setWalkableAt(x: number, y: number, walkable: boolean): void;
}
```

**2. Movement Model: Waypoint Queue**

BotManager transitions from "move toward single pixel target" to "follow ordered queue of tile positions". Each tick, `NPCMovementEngine` advances the bot toward the next waypoint in the queue. When the bot reaches a waypoint (within threshold), it dequeues and proceeds to the next.

**3. Route Caching and Invalidation**

- Computed paths are cached with a configurable TTL (default 30 seconds)
- When the walkability grid changes (player places/removes an object), affected tiles are marked dirty
- Bots with cached routes passing through dirty tiles have their routes invalidated and recomputed on the next tick
- Cache key: `${fromTileX},${fromTileY}->${toTileX},${toTileY}`

**4. Unreachable Target Handling**

When `findPath()` returns an empty array (no path exists), the bot picks a new random walkable target. After 3 consecutive unreachable targets, the bot transitions to IDLE and waits for the next wander interval. This replaces the current stuck-detection timeout for obstacle-related failures.

**5. 4-Directional Movement**

The `pathfinding` library is configured with `DiagonalMovement.Never`, producing paths that move only along cardinal directions. This matches the pixel art aesthetic and simplifies client-side animation (only 4 directional walk cycles needed).

---

## Implementation Guidance

- The `Pathfinder` class must be map-agnostic -- it works on any `boolean[][]` grid, whether homestead or town map
- Use dependency injection: `BotManager` receives a `Pathfinder` instance rather than constructing it internally
- The `pathfinding` library mutates its Grid on each `findPath` call -- always clone from the reference grid before calling
- Keep the `NPCMovementEngine` as a pure function of (bot state, waypoints, deltaMs) -> (new bot state) for testability
- Route cache invalidation should use a dirty-flag approach rather than recomputing all paths on every grid change
- NPC-NPC collision avoidance is explicitly deferred -- this ADR covers basic A* pathfinding only

---

## Related Information

- [ADR-0013: NPC Bot Entity Architecture](ADR-0013-npc-bot-entity-architecture.md) -- Decision 5 (wandering algorithm) is superseded by this ADR
- [NPC Service Architecture](../documentation/design/systems/npc-service.md) -- Defines the planned `movement/` module structure
- [Design-019: NPC Bot-Companion Implementation](../design/design-019-npc-bot-companion.md) -- Current bot implementation being refactored
- [PathFinding.js GitHub](https://github.com/qiao/PathFinding.js) -- Library repository
- [PathFinding.js npm](https://www.npmjs.com/package/pathfinding) -- Package registry page
- [PathFinding.js Visual Demo](https://qiao.github.io/PathFinding.js/visual/) -- Interactive algorithm visualization

## References

- [PathFinding.js by qiao (GitHub)](https://github.com/qiao/PathFinding.js) -- Comprehensive path-finding library for grid-based games; source of the `pathfinding` npm package
- [pathfinding npm package](https://www.npmjs.com/package/pathfinding) -- npm registry page with usage documentation and install instructions
- [PathFinding.js Documentation](https://pathfindingjs.readthedocs.io/en/latest/) -- Official documentation including API reference and getting started guide
- [PathFinding.js Visual Demo](https://qiao.github.io/PathFinding.js/visual/) -- Interactive browser-based demo for testing algorithms on custom grids
- [Grid.clone() Performance (Issue #33)](https://github.com/qiao/PathFinding.js/issues/33) -- Known performance discussion around grid cloning that informed our caching strategy
