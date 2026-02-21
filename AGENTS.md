# Repository Guidelines

## Project Structure & Module Organization
This repo is an Nx + pnpm workspace.

- `apps/game`: Next.js game client (`src/`, tests in `specs/`, static assets in `public/`)
- `apps/genmap`: Next.js map editor app (`src/`, tests in `specs/`)
- `apps/server`: Node/Colyseus backend (`src/main.ts`, domain modules under `src/*`)
- `apps/game-e2e`: Playwright end-to-end tests
- `packages/db`: Drizzle schema, migrations, and DB services (`src/migrations`, `src/schema`, `src/services`)
- `packages/shared`, `packages/map-lib`, `packages/map-renderer`: reusable workspace libraries

Treat `dist/`, `.next/`, and `out-tsc/` as build outputs, not source.

## Build, Test, and Development Commands
Use pnpm at workspace root.

- `pnpm install`: install dependencies
- `pnpm dev:web`: run `game` in dev mode
- `pnpm dev:server`: run backend server locally
- `pnpm dev:genmap`: run map editor locally
- `pnpm dev:all`: run game + server together
- `pnpm nx build <project>`: build a project (example: `pnpm nx build server`)
- `pnpm nx test <project>`: run unit tests (example: `pnpm nx test game`)
- `pnpm nx e2e game-e2e`: run Playwright tests
- `pnpm nx lint <project>`: lint a project
- `pnpm db:generate` / `pnpm db:migrate`: generate and apply DB migrations

## Coding Style & Naming Conventions
- TypeScript-first codebase; use ES modules where configured.
- Formatting: 2-space indentation, UTF-8, trailing whitespace trimmed (`.editorconfig`).
- Prettier: single quotes (`.prettierrc`).
- Follow ESLint + Nx module-boundary rules (`eslint.config.mjs`).
- Naming: keep files/folders descriptive and feature-oriented (examples: `src/systems`, `src/services`, `*.spec.ts`).

## Testing Guidelines
- Unit/integration: Jest (Nx-managed projects).
- E2E: Playwright in `apps/game-e2e/src`.
- Place tests near project conventions (`specs/` or `*.spec.ts(x)`).
- No global coverage threshold is enforced; add or update tests for every behavior change and bug fix.

## Commit & Pull Request Guidelines
- Use imperative, descriptive commit subjects (recent pattern: `Add ...`, `Fix ...`, `Update ...`).
- Keep commits scoped to one logical change.
- PRs should include:
  - concise summary of behavior changes
  - linked issue/task when available
  - test evidence (`pnpm nx test ...`, `pnpm nx e2e ...`) and screenshots for UI changes
  - migration/config notes for DB or env changes

## Security & Configuration Tips
- Copy env templates (`.env.example`) for local setup; never commit secrets.
- Review DB migration diffs carefully before applying to shared environments.
