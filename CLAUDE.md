# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nookstead is a 2D pixel art MMO / life sim / farming RPG with generative AI agents. Players build homesteads outside a living town populated by LLM-powered NPCs with memory, reflection, and autonomous planning. The full game design document is in `nookstead-gdd.md`.

**Target tech stack:** Next.js (web client/UI), Phaser.js 3 (2D game engine), Colyseus (multiplayer game server), Anthropic Claude API (NPC AI agents), PostgreSQL + Redis (persistence/cache).

## Nx Monorepo

**Nx version:** 22.5.0. Config in `nx.json`. Uses pnpm workspaces (`pnpm-workspace.yaml`).

### Projects

- `@nookstead/game` (`apps/game`) — Next.js 16 app (main game client). Uses App Router (`src/app/`).
- `@nookstead/game-e2e` (`apps/game-e2e`) — Playwright E2E tests. Has implicit dependency on `@nookstead/game`.

The project is in early scaffolding stage (initial Nx + Next.js setup). Colyseus server and Phaser integration have not been added yet.

### Nx Plugins (all infer targets automatically — no `project.json` files)

| Plugin | Inferred targets |
|---|---|
| `@nx/next/plugin` | `dev`, `build`, `start`, `serve-static`, `build-deps`, `watch-deps` |
| `@nx/jest/plugin` | `test` |
| `@nx/eslint/plugin` | `lint` |
| `@nx/playwright/plugin` | `e2e`, `e2e-ci`, `e2e-ci--*` |
| `@nx/js/typescript` | `typecheck` |

Targets are **inferred** from config files (e.g., `next.config.js` → Next.js targets, `jest.config.cts` → test target, `playwright.config.ts` → e2e targets). There are no `project.json` files; all target configuration comes from plugins in `nx.json`.

### Target Defaults

- `test` depends on `^build` (builds dependencies first).

### Named Inputs

- `default` — all files in project root + `sharedGlobals`
- `production` — `default` minus test files, eslint configs, jest configs
- `sharedGlobals` — `.github/workflows/ci.yml`

### Default Generator Settings

New `@nx/next` applications use `css` for styles and `eslint` for linting.

### Nx Cloud

Connected to Nx Cloud (ID: `698f7db0be3518f0d42a6547`). Default comparison base: `main`.

### Installed Nx Plugins

`@nx/devkit`, `@nx/eslint`, `@nx/eslint-plugin`, `@nx/jest`, `@nx/js`, `@nx/next`, `@nx/playwright`, `@nx/workspace`

## Commands

All commands use `pnpm nx` from the workspace root. Projects can be referenced by name (`game`) or package name (`@nookstead/game`).

```bash
# Development
pnpm nx dev game              # Start Next.js dev server (port 3000)
pnpm nx build game            # Production build
pnpm nx start game            # Start production server (requires build first)

# Testing
pnpm nx test game             # Run Jest unit tests
pnpm nx test game --testFile=specs/index.spec.tsx  # Run a single test file
pnpm nx e2e game-e2e          # Run Playwright E2E tests (auto-starts dev server)

# Code quality
pnpm nx lint game             # ESLint
pnpm nx typecheck game        # TypeScript type checking

# Run multiple targets across all projects
pnpm nx run-many -t lint test build typecheck e2e

# Run a specific target only on affected projects (compared to base branch)
pnpm nx affected -t test
pnpm nx affected -t lint

# Explore
pnpm nx graph                 # Open project/task graph in browser
pnpm nx show project game     # Show all available targets for a project
pnpm nx show project game --json  # Same but as JSON (useful for scripting)
pnpm nx list                  # List installed plugins
pnpm nx list @nx/next         # Show generators/executors for a plugin

# Generate new projects
pnpm nx g @nx/next:app demo           # New Next.js app
pnpm nx g @nx/react:lib mylib         # New React library
pnpm nx g @nx/node:app server         # New Node.js app (for Colyseus server)
pnpm nx g @nx/js:lib shared           # New JS/TS library (for shared types)

# Cache
pnpm nx reset                 # Clear local Nx cache
```

## Workflow Conventions

- **Pull Requests**: Always create as draft (`gh pr create --draft`)
- **Commits**: Only commit when explicitly asked by the user
- **Screenshots**: Save to `.screenshots/` directory (gitignored), never to project root

## Code Style

- **Prettier**: single quotes, 2-space indent (see `.prettierrc` and `.editorconfig`)
- **ESLint**: flat config (`eslint.config.mjs`) extending `@nx/eslint-plugin` with module boundary enforcement
- **TypeScript**: strict mode enabled, target ES2022, bundler module resolution
- **Path alias**: `@/*` maps to `apps/game/src/*` within the game app

## Architecture Notes (from GDD)

The planned architecture has three layers:

1. **Client (Next.js + Phaser)** — Next.js serves as the web shell; Phaser.js 3 renders the game canvas. Tile maps are created in Tiled editor, exported as JSON, loaded by Phaser.
2. **Game Server (Node.js + Colyseus)** — Authoritative server managing world state, player/NPC positions, game clock (1 game hour = 1 real minute). Target: 10 ticks/sec.
3. **AI Service (separate microservice)** — Handles all LLM calls for NPC dialogue, daily planning, reflection, and reactions. Communicates with game server via internal REST/gRPC API. Uses Claude Haiku for routine tasks, Sonnet for dialogues/reflections.

**NPC Agent structure:** Each NPC has a seed persona (JSON), memory stream (chronological events with importance scores), reflections (daily high-level insights), and an hourly plan generated each game morning. Memory retrieval uses recency + importance + semantic similarity.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes to `main` and all PRs:
`pnpm nx affected -t lint test build typecheck`

Default base branch in Nx config is `main`.
