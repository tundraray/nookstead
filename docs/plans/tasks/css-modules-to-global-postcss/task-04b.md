# Task 4b: Migrate HUD components (8 files)

## Overview

Update all 8 HUD component TSX files to remove CSS Module imports and use string class names matching the new global CSS naming convention.

## Related Documents

- **Work Plan**: Phase 2, Task 4b
- **Design Doc**: Section "4. TSX Component Changes" -- all HUD component diffs
- **Design Doc**: Section "Naming Convention Mapping" -- authoritative class name table

## Prerequisites

- Task 3 must be completed (`global.css` rewritten with all component styles)

## Target Files

All files under `D:/git/github/nookstead/main/apps/game/src/components/hud/`:

1. `HUD.tsx` (modified)
2. `ClockPanel.tsx` (modified)
3. `CurrencyDisplay.tsx` (modified)
4. `MenuButton.tsx` (modified)
5. `EnergyBar.tsx` (modified)
6. `NineSlicePanel.tsx` (modified)
7. `HotbarSlot.tsx` (modified)
8. `Hotbar.tsx` (modified)

## Implementation Steps

### Step 1: Migrate HUD.tsx

**File**: `apps/game/src/components/hud/HUD.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './HUD.module.css';
```

**Change 2**: Replace `styles.hud` with `"hud"` in template literal
```diff
- className={`${styles.hud} ${pixelFont.variable}`}
+ className={`hud ${pixelFont.variable}`}
```

**Important**: Preserve the `${pixelFont.variable}` part -- this is the Next.js font loader variable class.

---

### Step 2: Migrate ClockPanel.tsx

**File**: `apps/game/src/components/hud/ClockPanel.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './ClockPanel.module.css';
```

**Change 2**: Replace all 6 class references per mapping table:

| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.wrapper` | `"clock-panel"` |
| `styles.content` | `"clock-panel__content"` |
| `styles.seasonIcon` | `"clock-panel__season-icon"` |
| `styles.text` | `"clock-panel__text"` |
| `styles.line` | `"clock-panel__line"` |
| `styles.time` | `"clock-panel__time"` (modifier) |

**Special case**: The time line uses **two classes**:
```diff
- className={`${styles.line} ${styles.time}`}
+ className="clock-panel__line clock-panel__time"
```

---

### Step 3: Migrate CurrencyDisplay.tsx

**File**: `apps/game/src/components/hud/CurrencyDisplay.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './CurrencyDisplay.module.css';
```

**Change 2**: Replace all 4 class references per mapping table:

| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.wrapper` | `"currency-display"` |
| `styles.content` | `"currency-display__content"` |
| `styles.icon` | `"currency-display__icon"` |
| `styles.amount` | `"currency-display__amount"` |

---

### Step 4: Migrate MenuButton.tsx

**File**: `apps/game/src/components/hud/MenuButton.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './MenuButton.module.css';
```

**Change 2**: Replace all 3 class references per mapping table:

| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.button` | `"menu-button"` |
| `styles.spriteNormal` | `"menu-button__sprite-normal"` |
| `styles.spriteHover` | `"menu-button__sprite-hover"` |

---

### Step 5: Migrate EnergyBar.tsx

**File**: `apps/game/src/components/hud/EnergyBar.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './EnergyBar.module.css';
```

**Change 2**: Replace all 5 class references per mapping table:

| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.wrapper` | `"energy-bar"` |
| `styles.frame` | `"energy-bar__frame"` |
| `styles.track` | `"energy-bar__track"` |
| `styles.fill` | `"energy-bar__fill"` |
| `styles.label` | `"energy-bar__label"` |

---

### Step 6: Migrate NineSlicePanel.tsx

**File**: `apps/game/src/components/hud/NineSlicePanel.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './NineSlicePanel.module.css';
```

**Change 2**: Replace all 4 class references per mapping table:

| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.grid` | `"nine-slice"` |
| `styles.cell` | `"nine-slice__cell"` |
| `styles.edge` | `"nine-slice__edge"` |
| `styles.content` | `"nine-slice__content"` |

**Special cases**:
- Preserve `className` prop passthrough pattern:
  ```diff
  - className={`${styles.grid} ${className ?? ''}`}
  + className={`nine-slice ${className ?? ''}`}
  ```
- Combined classes:
  ```diff
  - className={`${styles.cell} ${styles.edge}`}
  + className="nine-slice__cell nine-slice__edge"
  ```

---

### Step 7: Migrate HotbarSlot.tsx

**File**: `apps/game/src/components/hud/HotbarSlot.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './HotbarSlot.module.css';
```

**Change 2**: Replace all 7 class references per mapping table:

| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.wrapper` | `"hotbar-slot"` |
| `styles.keyHint` | `"hotbar-slot__key-hint"` |
| `styles.slot` | `"hotbar-slot__button"` |
| `styles.background` | `"hotbar-slot__background"` |
| `styles.content` | `"hotbar-slot__content"` |
| `styles.itemIcon` | `"hotbar-slot__item-icon"` |
| `styles.quantity` | `"hotbar-slot__quantity"` |

---

### Step 8: Migrate Hotbar.tsx

**File**: `apps/game/src/components/hud/Hotbar.tsx`

**Change 1**: Remove CSS Module import
```diff
- import styles from './Hotbar.module.css';
```

**Change 2**: Replace all 2 class references per mapping table:

| Old (CSS Module) | New (Global) |
|------------------|--------------|
| `styles.wrapper` | `"hotbar"` |
| `styles.slots` | `"hotbar__slots"` |

---

### Step 9: Verify no module imports remain

Search for any remaining CSS Module imports in HUD components:

```bash
grep -r "import styles from" apps/game/src/components/hud/
```

Expected: **Zero results**.

Search for any remaining `styles.` references:

```bash
grep -r "styles\." apps/game/src/components/hud/
```

Expected: **Zero results**.

### Step 10: Verify type checking passes

Run TypeScript type checking to confirm removed imports don't cause errors:

```bash
npx nx typecheck game
```

Expected: Command exits with code 0, no TypeScript errors.

## Completion Criteria

- [ ] All 8 HUD components: `import styles from './X.module.css'` removed
- [ ] All className references replaced per mapping table
- [ ] NineSlicePanel `className` prop passthrough preserved (`nine-slice ${className ?? ''}`)
- [ ] HUD.tsx font variable class preserved (`hud ${pixelFont.variable}`)
- [ ] ClockPanel time line uses two classes (`"clock-panel__line clock-panel__time"`)
- [ ] Zero `import styles from` statements in any HUD component
- [ ] Zero `styles.` references in any HUD component
- [ ] `npx nx typecheck game` passes

## Verification Procedure

1. For each of the 8 HUD component files:
   - Remove CSS Module import
   - Replace all `styles.xxx` references with string class names per mapping table
   - Cross-reference each replacement against Design Doc "Naming Convention Mapping" table
2. Verify special cases:
   - HUD.tsx template literal includes both `"hud"` and `pixelFont.variable`
   - NineSlicePanel still accepts and applies external `className` prop
   - ClockPanel time line has two space-separated classes
3. Search for remaining module references:
   ```bash
   grep -r "import styles from" apps/game/src/components/hud/
   grep -r "styles\." apps/game/src/components/hud/
   ```
4. Expected: Both searches return zero results
5. Run type checking:
   ```bash
   npx nx typecheck game
   ```
6. Expected: Type checking passes with no errors

## Notes

- This task can be done in parallel with Tasks 4a and 4c (no dependencies between them)
- All three tasks (4a, 4b, 4c) must complete before Task 5 (deleting .module.css files)
- HUD.tsx and NineSlicePanel.tsx have special cases -- preserve template literal patterns
- ClockPanel.tsx has a combined class case -- use two space-separated class names
- HotbarSlot.tsx has the most class references (7) -- use the mapping table carefully
