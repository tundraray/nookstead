# Task 4a: Migrate game components (GameApp.tsx, LoadingScreen.tsx)

## Overview

Update GameApp.tsx and LoadingScreen.tsx to remove CSS Module imports and use string class names matching the new global CSS naming convention.

## Related Documents

- **Work Plan**: Phase 2, Task 4a
- **Design Doc**: Section "4. TSX Component Changes" -- GameApp.tsx, LoadingScreen.tsx diffs
- **Design Doc**: Section "Naming Convention Mapping" -- authoritative class name table

## Prerequisites

- Task 3 must be completed (`global.css` rewritten with all component styles)

## Target Files

- `D:/git/github/nookstead/main/apps/game/src/components/game/GameApp.tsx` (modified)
- `D:/git/github/nookstead/main/apps/game/src/components/game/LoadingScreen.tsx` (modified)

## Implementation Steps

### Step 1: Migrate GameApp.tsx

**File**: `D:/git/github/nookstead/main/apps/game/src/components/game/GameApp.tsx`

**Change 1**: Remove CSS Module import

```diff
- import styles from './GameApp.module.css';
```

**Change 2**: Replace `styles.wrapper` with `"game-app"`

Find the line:
```tsx
<div className={styles.wrapper}>
```

Replace with:
```tsx
<div className="game-app">
```

**Naming Convention Reference**:
| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.wrapper` | `"game-app"` |

### Step 2: Migrate LoadingScreen.tsx

**File**: `D:/git/github/nookstead/main/apps/game/src/components/game/LoadingScreen.tsx`

**Change 1**: Remove CSS Module import

```diff
- import styles from './LoadingScreen.module.css';
```

**Change 2**: Replace all 6 class references

Use the following mapping (from Design Doc "Naming Convention Mapping" table):

| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.overlay` | `"loading-screen"` |
| `styles.container` | `"loading-screen__container"` |
| `styles.title` | `"loading-screen__title"` |
| `styles.barOuter` | `"loading-screen__bar-outer"` |
| `styles.barInner` | `"loading-screen__bar-inner"` |
| `styles.text` | `"loading-screen__text"` |

**Example diff** (find each className and replace):
```diff
- <div className={styles.overlay}>
+ <div className="loading-screen">
-   <div className={styles.container}>
+   <div className="loading-screen__container">
-     <h1 className={styles.title}>Nookstead</h1>
+     <h1 className="loading-screen__title">Nookstead</h1>
-     <div className={styles.barOuter}>
+     <div className="loading-screen__bar-outer">
-       <div className={styles.barInner} />
+       <div className="loading-screen__bar-inner" />
      </div>
-     <p className={styles.text}>Loading...</p>
+     <p className="loading-screen__text">Loading...</p>
    </div>
  </div>
```

### Step 3: Verify no module imports remain

Search for any remaining CSS Module imports in these files:

```bash
grep "import styles from" apps/game/src/components/game/GameApp.tsx
grep "import styles from" apps/game/src/components/game/LoadingScreen.tsx
```

Expected: Both commands should return **zero results**.

### Step 4: Verify type checking passes

Run TypeScript type checking to confirm removed imports don't cause errors:

```bash
npx nx typecheck game
```

Expected: Command exits with code 0, no TypeScript errors.

## Completion Criteria

- [ ] GameApp.tsx: `import styles from './GameApp.module.css'` removed
- [ ] GameApp.tsx: `styles.wrapper` replaced with `"game-app"`
- [ ] LoadingScreen.tsx: `import styles from './LoadingScreen.module.css'` removed
- [ ] LoadingScreen.tsx: All 6 class references replaced per mapping table
- [ ] Zero `import styles from` statements in both files
- [ ] Zero `styles.` references in both files
- [ ] `npx nx typecheck game` passes

## Verification Procedure

1. Remove CSS Module imports from both files
2. Replace all `styles.xxx` references with string class names per mapping table
3. Cross-reference each replacement against Design Doc "Naming Convention Mapping" table
4. Search for remaining module references:
   ```bash
   grep "import styles from" apps/game/src/components/game/*.tsx
   grep "styles\." apps/game/src/components/game/*.tsx
   ```
5. Expected: Both searches return zero results
6. Run type checking:
   ```bash
   npx nx typecheck game
   ```
7. Expected: Type checking passes with no errors

## Notes

- This task can be done in parallel with Tasks 4b and 4c (no dependencies between them)
- All three tasks (4a, 4b, 4c) must complete before Task 5 (deleting .module.css files)
- GameApp.tsx has only 1 class reference -- simple migration
- LoadingScreen.tsx has 6 class references -- use the mapping table to ensure all are replaced correctly
