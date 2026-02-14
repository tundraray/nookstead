# Task 4c: Migrate page.tsx

## Overview

Update the landing page (page.tsx) to remove CSS Module import and remove the unused `.page` className. Note that this page also uses Nx boilerplate global classes which will no longer exist -- this is intentional.

## Related Documents

- **Work Plan**: Phase 2, Task 4c
- **Design Doc**: Section "4. TSX Component Changes" -- page.tsx diff

## Prerequisites

- Task 3 must be completed (`global.css` rewritten with all component styles)

## Target Files

- `D:/git/github/nookstead/main/apps/game/src/app/page.tsx` (modified)

## Implementation Steps

### Step 1: Remove CSS Module import

**File**: `apps/game/src/app/page.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './page.module.css';
```

### Step 2: Remove unused className

**Change 2**: Remove `styles.page` className

Find the line (likely near the top of the return statement):
```tsx
<div className={styles.page}>
```

Replace with:
```tsx
<div>
```

**Note**: The `.page` class in `page.module.css` is empty (`{}`) -- it was effectively unused. Removing the className has no visual impact.

### Step 3: Understand intentional styling loss

**Important context**: This landing page currently uses Nx boilerplate global CSS classes:
- `.wrapper`
- `.container`
- `.rounded`
- `.shadow`
- `.list-item-link`
- `.button-pill`

These classes are being removed from `global.css` as part of Task 3 (Nx boilerplate cleanup). **This is intentional** -- the landing page is Nx scaffold content that will be replaced with the actual game entry point.

**Expected behavior after migration**:
- The landing page will lose its Nx boilerplate styling
- This is cosmetic only -- the page is not part of the game UI
- Per Design Doc: "Landing page is Nx scaffold content to be replaced"

No action is required to address this styling loss. It is documented and expected.

### Step 4: Verify no module imports remain

Search for any remaining CSS Module imports:

```bash
grep "import styles from" apps/game/src/app/page.tsx
```

Expected: **Zero results**.

Search for any remaining `styles.` references:

```bash
grep "styles\." apps/game/src/app/page.tsx
```

Expected: **Zero results**.

### Step 5: Verify type checking passes

Run TypeScript type checking to confirm removed import doesn't cause errors:

```bash
npx nx typecheck game
```

Expected: Command exits with code 0, no TypeScript errors.

## Completion Criteria

- [ ] `import styles from './page.module.css'` removed
- [ ] `styles.page` className removed (or element no longer has className)
- [ ] Zero `import styles from` statements in page.tsx
- [ ] Zero `styles.` references in page.tsx
- [ ] `npx nx typecheck game` passes
- [ ] Intentional styling loss is understood and documented

## Verification Procedure

1. Remove CSS Module import from `apps/game/src/app/page.tsx`
2. Remove `styles.page` className (or entire className attribute if it was the only class)
3. Search for remaining module references:
   ```bash
   grep "import styles from" apps/game/src/app/page.tsx
   grep "styles\." apps/game/src/app/page.tsx
   ```
4. Expected: Both searches return zero results
5. Run type checking:
   ```bash
   npx nx typecheck game
   ```
6. Expected: Type checking passes with no errors
7. Confirm understanding: Landing page will lose Nx boilerplate styling -- this is intentional

## Notes

- This task can be done in parallel with Tasks 4a and 4b (no dependencies between them)
- All three tasks (4a, 4b, 4c) must complete before Task 5 (deleting .module.css files)
- This is the simplest TSX migration (only 1 import and 1 className to remove)
- The landing page styling loss is **not a bug** -- it is expected and documented
