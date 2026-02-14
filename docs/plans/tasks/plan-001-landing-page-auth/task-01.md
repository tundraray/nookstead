# Task 1.1: Install next-auth Package

**Phase**: Phase 1 - Authentication Foundation
**Estimated Duration**: 5 minutes
**Dependencies**: None (first task)
**Task Type**: Infrastructure Setup

## Overview

Install NextAuth.js v5 beta as a dependency in the game app. This version is required for Next.js 16 compatibility but has peer dependency conflicts that require the `--legacy-peer-deps` flag.

## Target Files

### Modified
- `apps/game/package.json` - Add next-auth dependency

## Implementation Steps

### 1. Install next-auth with legacy peer deps flag

From the workspace root:

```bash
npm install next-auth@5.0.0-beta.30 --legacy-peer-deps --workspace=apps/game
```

**Why `--legacy-peer-deps`**: NextAuth v5 beta has peer dependency requirements that don't perfectly align with Next.js 16. This flag allows the install to proceed. See ADR-002 for full rationale.

**Why pin to 5.0.0-beta.30**: This specific beta version is tested and compatible with the project. Do not upgrade without consulting ADR-002 kill criteria.

### 2. Verify installation

Check that `apps/game/package.json` now includes:

```json
{
  "dependencies": {
    "next-auth": "5.0.0-beta.30"
  }
}
```

### 3. Verify no runtime errors

Run a basic build to ensure the package installed correctly:

```bash
npx nx build game
```

Build should complete without errors related to next-auth.

## Acceptance Criteria

- [ ] `next-auth@5.0.0-beta.30` appears in `apps/game/package.json` dependencies
- [ ] `npx nx build game` completes successfully
- [ ] No error messages in console related to peer dependencies or next-auth installation

## Verification Steps

1. Run `npx nx build game` from workspace root
2. Verify build output shows no errors
3. Check `apps/game/package.json` contains exact version `5.0.0-beta.30`

## Rollback Procedure

If installation fails or causes issues:

```bash
npm uninstall next-auth --workspace=apps/game
```

Then investigate error messages before retrying.

## Notes

- This task only installs the package; no code changes are made
- The package will be imported and configured in Task 1.2 (auth.ts)
- OAuth providers will be configured in Task 1.2; no credentials needed yet
- The `--legacy-peer-deps` flag is documented in ADR-002 as a known requirement
