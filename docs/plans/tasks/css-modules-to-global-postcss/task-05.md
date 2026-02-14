# Task 5: Delete all .module.css files

## Overview

Delete all 11 CSS Module files that are no longer imported by any component. This cleanup step removes unused files from the codebase.

## Related Documents

- **Work Plan**: Phase 3, Task 5
- **Design Doc**: Section "Deleted Files (11)"

## Prerequisites

- Tasks 4a, 4b, and 4c must be completed (all TSX imports removed)

## Target Files

All files to be **deleted**:

1. `D:/git/github/nookstead/main/apps/game/src/app/page.module.css`
2. `D:/git/github/nookstead/main/apps/game/src/components/hud/HUD.module.css`
3. `D:/git/github/nookstead/main/apps/game/src/components/hud/ClockPanel.module.css`
4. `D:/git/github/nookstead/main/apps/game/src/components/hud/CurrencyDisplay.module.css`
5. `D:/git/github/nookstead/main/apps/game/src/components/hud/MenuButton.module.css`
6. `D:/git/github/nookstead/main/apps/game/src/components/hud/EnergyBar.module.css`
7. `D:/git/github/nookstead/main/apps/game/src/components/hud/NineSlicePanel.module.css`
8. `D:/git/github/nookstead/main/apps/game/src/components/hud/HotbarSlot.module.css`
9. `D:/git/github/nookstead/main/apps/game/src/components/hud/Hotbar.module.css`
10. `D:/git/github/nookstead/main/apps/game/src/components/game/LoadingScreen.module.css`
11. `D:/git/github/nookstead/main/apps/game/src/components/game/GameApp.module.css`

## Implementation Steps

### Step 1: Verify no imports remain (safety check)

Before deleting files, confirm no TSX files still import them:

```bash
grep -r "import styles from" apps/game/src/
```

Expected: **Zero results**. If any imports are found, **STOP** and complete Tasks 4a/4b/4c first.

### Step 2: Delete all .module.css files

Delete the 11 files listed above:

```bash
rm apps/game/src/app/page.module.css
rm apps/game/src/components/hud/HUD.module.css
rm apps/game/src/components/hud/ClockPanel.module.css
rm apps/game/src/components/hud/CurrencyDisplay.module.css
rm apps/game/src/components/hud/MenuButton.module.css
rm apps/game/src/components/hud/EnergyBar.module.css
rm apps/game/src/components/hud/NineSlicePanel.module.css
rm apps/game/src/components/hud/HotbarSlot.module.css
rm apps/game/src/components/hud/Hotbar.module.css
rm apps/game/src/components/game/LoadingScreen.module.css
rm apps/game/src/components/game/GameApp.module.css
```

### Step 3: Verify deletion

Confirm no `.module.css` files remain under `apps/game/src/`:

```bash
find apps/game/src/ -name "*.module.css"
```

Expected: **Zero results**.

### Step 4: Verify build still succeeds

Run build to confirm no dangling import references:

```bash
npx nx build game
```

Expected: Build succeeds (exit code 0) with no "module not found" errors.

## Completion Criteria

- [ ] Zero `.module.css` files exist under `apps/game/src/`
- [ ] `npx nx build game` succeeds without "module not found" errors
- [ ] No dangling import references in any TSX file

## Verification Procedure

1. Verify no imports remain:
   ```bash
   grep -r "import styles from" apps/game/src/
   ```
   Expected: Zero results
2. Delete all 11 `.module.css` files using the commands above
3. Verify deletion:
   ```bash
   find apps/game/src/ -name "*.module.css"
   ```
   Expected: Zero results
4. Run build:
   ```bash
   npx nx build game
   ```
   Expected: Build succeeds with no errors

## Notes

- This task **must** be done after Tasks 4a, 4b, and 4c (TSX migration)
- Deleting files before TSX migration will cause build errors
- Git preserves deleted files in version history -- they can be recovered if needed
- This is the final implementation task before quality assurance phase
