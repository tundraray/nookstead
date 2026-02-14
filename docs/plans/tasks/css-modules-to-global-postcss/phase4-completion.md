# Phase 4 Completion: Quality Assurance

## Overview

This task performs comprehensive build verification, linting, type checking, and visual correctness confirmation. It verifies all Design Doc acceptance criteria are met and the migration is complete.

## Related Documents

- **Work Plan**: Phase 4 (Quality Assurance)
- **Design Doc**: Section "Acceptance Criteria (AC) - EARS Format"
- **Design Doc**: Section "Testing Strategy -- Manual verification checklist"

## Prerequisites

- All Phase 1, 2, and 3 tasks completed
- Phase 1 Completion task verified
- Task 5 (Delete .module.css files) completed

## Build Verification

### Step 1: Run build

```bash
npx nx build game
```

**Expected**: Command exits with code 0, no errors.

**If build fails**:
- Check for PostCSS errors (verify Task 2 config)
- Check for TypeScript errors (verify Tasks 4a/4b/4c removed all imports)
- Check for missing module errors (verify Task 5 deletions)

### Step 2: Run type checking

```bash
npx nx typecheck game
```

**Expected**: Command exits with code 0, no TypeScript errors.

**If type checking fails**:
- Check for unused import errors (verify Tasks 4a/4b/4c removed all CSS Module imports)
- Check for missing type definitions

### Step 3: Run linting

```bash
npx nx lint game
```

**Expected**: Command exits with code 0, no ESLint errors.

**If linting fails**:
- Check for unused variable errors (verify all `styles` imports removed)
- Check for formatting issues (run Prettier if needed)

## Visual Verification

### Step 4: Start development server

```bash
npx nx dev game
```

**Expected**: Dev server starts successfully on port 3000.

### Step 5: Visual inspection checklist

Navigate to the game in browser and verify:

#### Loading Screen
- [ ] Loading screen displays correctly
- [ ] Title "Nookstead" renders with correct font and color
- [ ] Progress bar shows animated loading indicator
- [ ] Loading text displays below progress bar
- [ ] Background color is dark blue (#1a1a2e)

#### HUD Container
- [ ] HUD renders with correct positioning (all components visible)
- [ ] Pixel font renders correctly via `--font-pixel` variable
- [ ] `pointer-events` model works (HUD overlay non-interactive, buttons clickable)

#### Clock Panel (Top-Left)
- [ ] Clock panel positioned in top-left corner
- [ ] Season icon displays correctly
- [ ] Day number displays (e.g., "Day 1")
- [ ] Time displays with different color (e.g., "8:00 AM")
- [ ] Nine-slice panel background renders correctly

#### Currency Display (Top-Right)
- [ ] Currency display positioned in top-right corner
- [ ] Coin icon displays correctly
- [ ] Gold amount displays with golden color
- [ ] Nine-slice panel background renders correctly

#### Energy Bar (Right-Center)
- [ ] Energy bar positioned on right side, vertically centered
- [ ] Energy bar frame sprite displays
- [ ] Energy fill bar displays with correct height based on current energy
- [ ] Energy fill color matches energy level (green/yellow/red)
- [ ] Energy number label displays below bar

#### Hotbar (Bottom-Center)
- [ ] Hotbar positioned at bottom-center
- [ ] All hotbar slots display in a row
- [ ] Key hints display above each slot (1-9)
- [ ] Nine-slice panel backgrounds render for each slot
- [ ] Empty slots show correctly
- [ ] Item icons display when slots are filled (if applicable)
- [ ] Quantity labels display when applicable

#### Menu Button (Bottom-Right)
- [ ] Menu button positioned in bottom-right corner
- [ ] Normal sprite displays by default
- [ ] Hover sprite displays on hover
- [ ] Active state shows slight offset on click
- [ ] Focus outline displays on keyboard focus

#### Nine-Slice Panels
- [ ] All nine-slice panels render with correct corner/edge stretching
- [ ] Corner tiles (32x32) render without distortion
- [ ] Edge tiles stretch correctly
- [ ] Content areas are positioned correctly within panels
- [ ] Drop shadows render on panels

### Step 6: Confirm no console errors

Open browser DevTools console and verify:

- [ ] No CSS-related errors
- [ ] No "Failed to load resource" errors for CSS files
- [ ] No missing class name warnings

## Acceptance Criteria Verification

### FR-1: CSS Module Migration

- [ ] **When** the application renders the HUD, the system shall display all components with identical visual appearance to the CSS Modules version
  - Verification: Visual inspection (Step 5 checklist)
- [ ] **When** `global.css` is loaded, the system shall contain all styles previously defined in the 11 `.module.css` files
  - Verification: File inspection (Phase 1 Completion)
- [ ] The system shall not contain any `.module.css` files in the `apps/game/src/` directory
  - Verification:
    ```bash
    find apps/game/src/ -name "*.module.css"
    ```
    Expected: Zero results

### FR-2: PostCSS Configuration

- [ ] **When** `npx nx build game` is executed, the system shall process `global.css` through postcss-preset-env without errors
  - Verification: Step 1 (build succeeds)
- [ ] **When** CSS nesting syntax is used in `global.css`, the system shall compile it to flat CSS for browser compatibility
  - Verification: Build output check (Phase 1 Completion)
- [ ] The file `apps/game/postcss.config.js` shall exist and export a valid PostCSS configuration
  - Verification:
    ```bash
    cat apps/game/postcss.config.js
    ```
    Expected: Valid config with postcss-preset-env

### FR-3: TSX Component Updates

- [ ] The system shall not contain any `import styles from` statements referencing `.module.css` files
  - Verification:
    ```bash
    grep -r "import styles from" apps/game/src/
    ```
    Expected: Zero results
- [ ] **When** a component is rendered, the system shall apply the correct global CSS class names
  - Verification: Visual inspection (Step 5 checklist)
- [ ] **When** NineSlicePanel receives a `className` prop, the system shall apply it alongside the component's own classes
  - Verification: Visual inspection (hotbar slots use NineSlicePanel with custom className)

### FR-4: Build Verification

- [ ] **When** `npx nx build game` is executed, the system shall complete without errors
  - Verification: Step 1
- [ ] **When** `npx nx typecheck game` is executed, the system shall complete without errors
  - Verification: Step 2
- [ ] **When** `npx nx lint game` is executed, the system shall complete without errors
  - Verification: Step 3

## Completion Criteria Summary

All of the following must pass:

- [ ] `npx nx build game` passes
- [ ] `npx nx typecheck game` passes
- [ ] `npx nx lint game` passes
- [ ] All Design Doc acceptance criteria verified (checklist above)
- [ ] Visual inspection confirms pixel-identical rendering
- [ ] No console errors related to missing styles or CSS
- [ ] Zero `.module.css` files remain under `apps/game/src/`
- [ ] Zero `import styles from` statements remain in TSX files

## Operational Verification Script

Run this comprehensive verification script:

```bash
#!/bin/bash
set -e

echo "=== Phase 4 Quality Assurance Verification ==="

echo "1. Verifying no .module.css files remain..."
MODULE_FILES=$(find apps/game/src/ -name "*.module.css" | wc -l)
if [ "$MODULE_FILES" -eq 0 ]; then
  echo "✓ No .module.css files found"
else
  echo "✗ Found $MODULE_FILES .module.css files (should be 0)"
  exit 1
fi

echo "2. Verifying no CSS Module imports remain..."
IMPORTS=$(grep -r "import styles from" apps/game/src/ | wc -l)
if [ "$IMPORTS" -eq 0 ]; then
  echo "✓ No CSS Module imports found"
else
  echo "✗ Found $IMPORTS CSS Module imports (should be 0)"
  exit 1
fi

echo "3. Running build..."
npx nx build game
echo "✓ Build succeeded"

echo "4. Running type checking..."
npx nx typecheck game
echo "✓ Type checking succeeded"

echo "5. Running linting..."
npx nx lint game
echo "✓ Linting succeeded"

echo ""
echo "=== Automated Checks Complete ==="
echo "Please proceed with manual visual verification (Step 5)."
```

## Notes

- This is the final verification step before the migration is considered complete
- All automated checks must pass before manual visual verification
- Visual verification is critical -- automated tools cannot detect CSS class name typos
- If any check fails, resolve the issue before marking the migration complete
- Once all criteria pass, the migration is complete and ready for commit (user decides when to commit)

## Next Steps

Once all Phase 4 criteria are met:
1. Confirm all work plan phases are complete
2. Confirm all acceptance criteria are satisfied
3. User decides when to commit the changes
4. Migration is complete
