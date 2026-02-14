# Task 4.2: Run Lint, Typecheck, and Build

**Phase**: Phase 4 - Quality Assurance
**Estimated Duration**: 10 minutes
**Dependencies**: Task 4.1 (tests must be updated)
**Task Type**: Verification

## Overview

Run all quality checks (lint, typecheck, test, build) to ensure the codebase meets quality standards before manual testing. All commands must pass with zero errors.

## Target Files

### Verification Only
- No file changes, only running quality check commands

## Implementation Steps

### 1. Run ESLint

Check code style and catch common errors:

```bash
npx nx lint game
```

**Expected result**: Zero errors, zero warnings (or only warnings that are acceptable).

**If errors occur**:
- Review ESLint output
- Fix any code style violations
- Re-run lint until it passes

**Common issues**:
- Unused imports
- Missing dependencies in useEffect (not applicable here, but common in client components)
- Indentation or formatting issues

### 2. Run TypeScript Type Checking

Verify all types are correct:

```bash
npx nx typecheck game
```

**Expected result**: Zero TypeScript errors.

**If errors occur**:
- Review TypeScript error messages
- Fix type mismatches
- Ensure all imports are correctly typed
- Re-run typecheck until it passes

**Common issues**:
- Import path errors (verify `@/*` alias works)
- Type mismatches in component props
- Missing type annotations

### 3. Run Unit Tests

Run all Jest tests:

```bash
npx nx test game
```

**Expected result**: All tests pass, zero failures.

**If tests fail**:
- Review test output
- Fix failing tests (should not fail if Task 4.1 was completed correctly)
- Re-run tests until they pass

**Common issues**:
- Mock setup issues
- Async component testing errors
- Component rendering errors

### 4. Run Production Build

Build the app for production:

```bash
npx nx build game
```

**Expected result**: Build completes successfully, no errors.

**If build fails**:
- Review build output for errors
- Common issues include:
  - Missing environment variables (not an issue for build, only runtime)
  - TypeScript errors not caught by typecheck
  - Import resolution errors
- Fix errors and re-run build

**Build output location**: `apps/game/.next/` (or `dist/apps/game/.next/` depending on Nx config)

### 5. Run All Quality Checks Together (Recommended)

Run all checks in one command:

```bash
npx nx run-many -t lint test build typecheck --projects=game
```

**Expected result**: All targets pass with zero errors.

## Implementation Details

### Quality Check Order

The order matters:
1. **Lint** - Catches code style issues early
2. **Typecheck** - Verifies types before running tests
3. **Test** - Ensures functionality is correct
4. **Build** - Verifies production build works

### Why All Must Pass

- **Lint**: Ensures code quality and consistency
- **Typecheck**: Prevents runtime type errors
- **Test**: Verifies functionality is correct
- **Build**: Ensures production deployment will succeed

### CI/CD Alignment

These are the same checks that run in CI (`.github/workflows/ci.yml`). Passing locally means CI will likely pass.

### Zero Tolerance

**Do NOT proceed to Task 4.3 if any check fails.** Fix all errors first.

## Acceptance Criteria

- [ ] `npx nx lint game` passes with zero errors
- [ ] `npx nx typecheck game` passes with zero errors
- [ ] `npx nx test game` passes - all tests pass
- [ ] `npx nx build game` completes successfully
- [ ] (Optional) `npx nx run-many -t lint test build typecheck --projects=game` passes

## Verification Steps

1. Run each command sequentially:
   ```bash
   npx nx lint game
   npx nx typecheck game
   npx nx test game
   npx nx build game
   ```

2. Verify each command exits with code 0 (success)

3. Review any warnings (warnings are acceptable, errors are not)

4. (Optional) Run all at once:
   ```bash
   npx nx run-many -t lint test build typecheck --projects=game
   ```

## Rollback Procedure

If quality checks fail due to changes in previous tasks:

1. Identify which task introduced the failing code
2. Review that task's implementation
3. Fix the errors
4. Re-run quality checks
5. Do NOT rollback; fix forward

## Notes

- Lint warnings (vs errors) may be acceptable depending on project conventions
- TypeScript strict mode is enabled; all types must be explicit
- Tests should have been updated in Task 4.1; if tests fail, review that task
- Build errors are often related to import paths or missing dependencies
- If build succeeds but runtime fails, that's checked in Task 4.3 and 4.4
- Quality checks are fast; total runtime should be < 2 minutes for this small project
- Nx caching may make subsequent runs even faster

## Error Troubleshooting

### Lint Errors

**"Unexpected console statement"**:
- Review if console.log/error is necessary
- If for debugging, remove it
- If for production logging, add eslint-disable comment with justification

**"Import not found"**:
- Verify import path uses `@/*` alias correctly
- Check file exists at the import path

### TypeScript Errors

**"Cannot find module '@/...'"**:
- Verify `tsconfig.json` has correct path mapping for `@/*`
- Ensure file exists at the path

**"Type 'X' is not assignable to type 'Y'"**:
- Review the type mismatch
- Fix the type annotation or the value

### Test Failures

**"Cannot find module 'next-auth/react'"**:
- Verify jest mock is set up correctly in test file (Task 4.1)

**"Component did not render"**:
- Check if async component is awaited in test

### Build Errors

**"Module not found"**:
- Verify all imports are correct
- Check `next.config.js` for any custom module resolution

**"Type error in ..."**:
- Should have been caught by typecheck
- Run `npx nx typecheck game` first to identify type issues
