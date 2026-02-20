# Quality Fixer Memory - Genmap App

## Project Structure
- Monorepo root: `D:\git\github\nookstead\server`
- Genmap app: `apps/genmap` (Next.js 16 + Tailwind 4)
- DB package: `packages/db`
- Map lib: `packages/map-lib`
- Package manager: pnpm with Nx 22.5.0

## Quality Commands
- Typecheck: `cd apps/genmap && npx tsc --noEmit --pretty` (no Nx `typecheck` target for genmap)
- Lint: `pnpm nx lint genmap`
- Build: `pnpm nx build genmap`
- DB typecheck: `cd packages/db && npx tsc --noEmit --pretty`

## Known Patterns
- ESLint config: flat config (`eslint.config.mjs`), uses `@nx/eslint-plugin` flat/react-typescript
- The genmap ESLint config does NOT include `react-hooks` plugin. Do not use `eslint-disable-next-line react-hooks/exhaustive-deps` -- it causes "Definition for rule not found" errors.
- Use plain comments instead of eslint-disable for react-hooks rules.
