# ADR-004: Build and Serve Tooling for Colyseus Game Server

## Status

Proposed

## Context

Nookstead requires an authoritative game server built on Colyseus for real-time multiplayer gameplay. The project is an Nx 22.5.0 monorepo with pnpm workspaces, where the existing Next.js game client (`apps/game`) uses inferred targets from Nx plugins with no `project.json` files. The new Colyseus server application needs a build and serve toolchain that integrates with the monorepo while handling Node.js-specific requirements.

Key requirements:

1. **Fast development iteration** -- the server needs watch mode with auto-restart for rapid development of game logic (targeting 10 ticks/sec authoritative server)
2. **ESM compatibility** -- the shared `packages/db` package uses `"type": "module"` (ESM); the build output must handle ESM imports correctly
3. **Production bundling** -- the server must produce an optimized, deployable bundle for production environments
4. **Nx monorepo integration** -- the toolchain must work with Nx's task orchestration, caching, and dependency graph
5. **Native module handling** -- Colyseus depends on `ws` (WebSocket library) which has optional native dependencies (`bufferutil`, `utf-8-validate`) that cannot be bundled

### Alternatives Considered

#### 1. @nx/esbuild (build) + @nx/js:node (serve)

- **Overview**: Use `@nx/esbuild:esbuild` executor to bundle TypeScript into a single JavaScript output, and `@nx/js:node` executor to run the bundle with watch mode and auto-restart.
- Benefits:
  - esbuild is ~45x faster than tsc for cold builds, written in Go for maximum performance
  - `@nx/esbuild:esbuild` has first-class support for `platform: "node"`, ESM output format, and `external` package configuration
  - `@nx/js:node` provides watch mode with configurable debounce (default 500ms), Node.js inspector integration, and automatic rebuild-on-change
  - Full Nx integration: task caching, dependency graph awareness, `runBuildTargetDependencies` for building `packages/db` before serve
  - esbuild can bundle workspace libraries while externalizing native/optional dependencies
  - Single-file output simplifies deployment (no `node_modules` resolution at runtime)
- Drawbacks:
  - Requires explicit `project.json` configuration (no Nx inference plugin for generic Node.js apps)
  - Native modules like `bufferutil` and `utf-8-validate` must be manually listed in `external` configuration
  - esbuild has not reached a stable 1.0 release (though it is widely adopted in production tools including Vite, Snowpack, and tsup)
  - esbuild does not perform type checking -- a separate `typecheck` target is needed (already inferred by `@nx/js/typescript` plugin)

#### 2. tsc + nodemon

- **Overview**: Use the TypeScript compiler (`tsc`) for compilation and `nodemon` for file watching and auto-restart during development.
- Benefits:
  - Simple and well-understood toolchain with extensive documentation
  - tsc provides type checking during compilation
  - nodemon is battle-tested for Node.js development server restarts
  - No additional Nx plugins required
- Drawbacks:
  - No Nx integration for task orchestration, caching, or dependency tracking
  - Slow incremental builds -- tsc is ~45x slower than esbuild for cold builds
  - Manual configuration for watch mode, output paths, and source maps
  - No bundling -- produces many individual `.js` files requiring `node_modules` at runtime
  - Must manually handle `packages/db` build ordering
  - Two separate tools to configure and maintain (tsc config + nodemon config)

#### 3. SWC via @nx/js:swc

- **Overview**: Use SWC (Speedy Web Compiler, written in Rust) through the `@nx/js:swc` executor for TypeScript transpilation.
- Benefits:
  - ~20x faster than tsc for compilation
  - Good Nx integration via `@nx/js` plugin
  - Written in Rust for native performance
  - Supports TypeScript decorators (relevant if Colyseus uses decorator patterns)
- Drawbacks:
  - SWC is a transpiler, not a bundler -- produces individual files, not a single bundle
  - Less mature for Node.js server applications compared to esbuild
  - No built-in bundling means `node_modules` must be present at runtime
  - Historical issues with decorator support and edge cases in complex TypeScript
  - Would need a separate bundling step for production deployment
  - `@nx/js:swc` executor has fewer configuration options for Node.js platform targeting than `@nx/esbuild`

#### 4. tsx / ts-node (direct TypeScript execution)

- **Overview**: Execute TypeScript files directly at runtime without a separate compilation step, using `tsx` (esbuild-based) or `ts-node` (tsc-based).
- Benefits:
  - Zero build step -- immediate execution from source
  - Simplest possible development setup
  - `tsx` uses esbuild internally for fast transpilation
- Drawbacks:
  - Not production-ready -- runtime transpilation adds startup latency and memory overhead
  - `ts-node` is poorly maintained (no minor/major releases in over two years)
  - `ts-node` ESM support relies on Node.js experimental loaders API
  - No bundling -- cannot produce optimized production artifacts
  - No Nx task integration or caching
  - Runtime compilation overhead accumulates with codebase growth
  - Not suitable for a game server where startup time and runtime performance matter

### Comparison

| Criterion | @nx/esbuild + @nx/js:node | tsc + nodemon | SWC (@nx/js:swc) | tsx / ts-node |
|---|---|---|---|---|
| Build speed (vs tsc) | ~45x faster | 1x (baseline) | ~20x faster | N/A (runtime) |
| Nx integration | Full (caching, deps, graph) | None | Partial | None |
| Watch + auto-restart | Built-in (@nx/js:node) | nodemon (separate) | Manual setup | tsx --watch |
| Production bundling | Single-file bundle | Individual .js files | Individual .js files | No bundle |
| ESM output support | Native (`format: ["esm"]`) | `"module": "esnext"` in tsconfig | Supported | Automatic |
| Native module handling | `external` option | N/A (no bundling) | N/A (no bundling) | N/A |
| Type checking | Separate target (inferred) | Included in tsc | Separate target | ts-node only |
| Debugging support | Inspector integration | Manual --inspect | Manual | Manual |
| Setup complexity | Medium (project.json) | Low (2 configs) | Medium | Very low |
| Production readiness | High | Medium | Medium | Low |
| Maintenance status | Active (esbuild + Nx) | Active (tsc) / Active (nodemon) | Active | ts-node: stale, tsx: active |

## Decision

We will use **@nx/esbuild:esbuild** for building and **@nx/js:node** for serving the Colyseus game server application.

### Decision Details

| Item | Content |
|---|---|
| **Decision** | Use @nx/esbuild:esbuild as the build executor and @nx/js:node as the serve executor for the Colyseus game server |
| **Why now** | The Colyseus game server is the next major addition to the monorepo; build tooling must be decided before scaffolding the application |
| **Why this** | esbuild provides the fastest build times (~45x over tsc), full Nx integration for task orchestration and caching, native ESM output support (critical for `packages/db` compatibility), and single-file production bundling. The @nx/js:node executor adds watch mode with auto-restart and Node.js inspector integration for development. No other option offers this combination of speed, integration depth, and production readiness. |
| **Known unknowns** | (1) Colyseus may introduce new native dependencies in future versions that need `external` configuration. (2) The `@nx/js:node` executor has had reported issues with watch mode in certain Nx versions (e.g., issue #32385). (3) esbuild's lack of a stable 1.0 release means breaking changes are possible, though rare in practice. |
| **Kill criteria** | If esbuild cannot correctly bundle Colyseus server code (e.g., due to unsupported syntax transformations, native module incompatibilities, or critical watch mode failures), fall back to tsc + nodemon with manual Nx target configuration. |

### Architecture Decisions

- **Build executor**: `@nx/esbuild:esbuild` with `platform: "node"`, `format: ["esm"]`, and `bundle: true`
- **Serve executor**: `@nx/js:node` with `buildTarget` pointing to the esbuild build target, `watch: true` for development
- **External packages**: Mark `bufferutil`, `utf-8-validate`, and other native/optional WebSocket dependencies as `external` in the esbuild configuration to prevent bundling failures
- **Output format**: ESM (`format: ["esm"]`) to align with `packages/db` which uses `"type": "module"`
- **Explicit target configuration**: The Colyseus server will use a `project.json` file with explicit executor configuration, since there is no Nx inference plugin for generic Node.js applications (unlike `@nx/next/plugin` for the game client)
- **Type checking**: Rely on the existing `@nx/js/typescript` plugin for inferred `typecheck` target -- esbuild intentionally skips type checking for speed
- **Linting and testing**: Rely on existing `@nx/eslint/plugin` (inferred `lint` target) and `@nx/jest/plugin` (inferred `test` target) -- no additional configuration needed for these

## Consequences

### Positive

1. **Fast development feedback loop** -- esbuild's sub-second builds combined with @nx/js:node's watch mode and 500ms debounce provide near-instant restart on code changes
2. **Nx-native workflow** -- build, serve, lint, test, and typecheck all orchestrated through `pnpm nx`, with task caching and dependency graph awareness
3. **ESM-first output** -- ESM format aligns with `packages/db` (`"type": "module"`) and modern Node.js conventions, avoiding CJS/ESM interop issues
4. **Single-file production bundle** -- esbuild produces a self-contained bundle for deployment, eliminating runtime `node_modules` resolution
5. **Consistent monorepo patterns** -- follows Nx conventions established by the game client, with executor-based targets and shared configuration
6. **Inspector integration** -- @nx/js:node provides built-in Node.js inspector support for debugging game server logic

### Negative

1. **Explicit project.json required** -- unlike the game client which uses inferred targets, the server needs a `project.json` file with executor definitions, creating a slight inconsistency in the monorepo
2. **No type checking during build** -- esbuild strips types without checking them; type errors are only caught by the separate `typecheck` target or CI pipeline
3. **Manual external list maintenance** -- native and optional dependencies must be explicitly listed in the `external` configuration; new Colyseus dependencies may need manual addition
4. **esbuild pre-1.0 stability** -- while widely adopted, esbuild has not released a stable 1.0 version; breaking changes in esbuild internals could require configuration updates
5. **Watch mode edge cases** -- the @nx/js:node executor has had reported issues with watch mode behavior in certain Nx versions, requiring version-specific workarounds

### Migration Path

If esbuild becomes untenable:

1. **tsc + nodemon** is the simplest fallback. Replace the `@nx/esbuild:esbuild` build target with a tsc-based build, and replace `@nx/js:node` serve target with a custom nodemon-based executor or script.
2. **SWC** could serve as an intermediate option if bundling is not required (e.g., deploying with `node_modules`). Replace the build executor with `@nx/js:swc`.
3. The `project.json` target structure (build, serve, lint, test, typecheck) remains the same regardless of which build tool is used -- only the executor and its options change.

## Implementation Guidance

- Use `platform: "node"` in esbuild configuration to ensure Node.js built-in modules (`fs`, `path`, `net`, etc.) are automatically treated as external
- Use `format: ["esm"]` to produce ESM output compatible with the ESM-based `packages/db` dependency
- Configure `external` to include native WebSocket dependencies (`bufferutil`, `utf-8-validate`) and any other packages with native bindings
- Use `@nx/js:node` executor's `runBuildTargetDependencies` option to ensure `packages/db` is built before the server starts
- Keep type checking separate via the inferred `typecheck` target from `@nx/js/typescript` plugin -- do not add type checking to the esbuild build step
- Use the `@nx/js:node` executor's `inspect` option for debugging during development rather than adding manual `--inspect` flags
- Configure the server's `tsconfig.app.json` to extend the workspace `tsconfig.base.json` for consistent compiler options across the monorepo

## Related Information

- [ADR-002: Player Authentication with NextAuth.js v5](adr-002-nextauth-authentication.md) -- establishes the monorepo pattern with Nx plugins and inferred targets
- Nookstead GDD (Section 5 - Multiplayer Infrastructure) -- defines the Colyseus game server architecture and 10 ticks/sec target

## References

- [Nx esbuild Plugin Overview](https://nx.dev/nx-api/esbuild) - Official Nx esbuild plugin documentation
- [Nx esbuild Executors](https://nx.dev/docs/technologies/build-tools/esbuild/executors) - esbuild executor configuration options including external, thirdParty, and format
- [Nx @nx/js:node Executor](https://nx.dev/docs/technologies/typescript/executors) - Node.js executor for running esbuild output with watch mode
- [Nx Bundling Node Projects Guide](https://nx.dev/docs/technologies/node/guides/bundling-node-projects) - Guide for configuring esbuild external packages in Nx
- [esbuild Getting Started](https://esbuild.github.io/getting-started/) - Official esbuild documentation
- [Colyseus Official Documentation](https://docs.colyseus.io/) - Colyseus server framework documentation
- [Colyseus WebSocket Transport](https://docs.colyseus.io/server/transport/ws) - Default WebSocket transport using ws library
- [ESBuild vs SWC Comparison (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/esbuild-vs-swc/) - Performance benchmarks and feature comparison
- [ESBuild vs SWC vs TSC: Which Compiler to Use in 2026 (Medium)](https://medium.com/@mernstackdevbykevin/esbuild-swc-and-tsc-which-compiler-should-you-use-in-2026-a2df3c783ad2) - Current compiler landscape analysis
- [tsx FAQ - Production Usage](https://tsx.is/faq) - tsx limitations for production environments
- [Running TypeScript in Node.js (LogRocket)](https://blog.logrocket.com/running-typescript-node-js-tsx-vs-ts-node-vs-native/) - Comparison of tsx, ts-node, and native TypeScript execution
- [Nx @nx/js:node Watch Mode Issue #32385](https://github.com/nrwl/nx/issues/32385) - Known watch mode issue in @nx/js:node executor
- [Colyseus Webpack Bundling Discussion](https://discuss.colyseus.io/topic/424/fixing-warnings-when-bundling-colyseus-server-with-webpack) - Community guidance on bundling Colyseus with build tools

## Date

2026-02-15
