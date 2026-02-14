# HUD Design Spec: Farming Interface

**Project:** Nookstead -- 2D Pixel Art Farming RPG
**Style:** Pixel Art (Stardew Valley-like)
**Source Sprite Sheet:** `apps/game/public/assets/ui/hud_32.png` (1952 x 1376 px)
**Base Tile Size:** 32 x 32 px (61 columns x 43 rows)
**Version:** 2.0 | Date: February 14, 2026

---

## Contributors

| Role | Responsibility |
|------|----------------|
| **UI Art Director** | Layout concept, visual direction, color palette, style rules |
| **Technical Artist** | Sprite sheet coordinate mapping, scaling rules |
| **Game UI Developer** | CSS/HTML implementation, component architecture |
| **Gameplay Designer** | HUD feedback mechanics, state behaviors, interactions |

---

## 1. Layout Concept (Art Director)

### 1.1 Vision Statement

The Nookstead HUD should feel like a set of handwritten notes pinned to a farmhouse kitchen corkboard -- warm, tactile, and unobtrusive. Every panel draws from the LimeZu Modern UI parchment frames: cream-colored backgrounds with soft brown borders, as though the player's tools and status are written on scraps of recipe paper. The interface recedes into the periphery during exploration and farming, letting the pixel-art world breathe, but becomes instantly legible the moment the player glances at it. Nothing about this HUD should feel cold, metallic, or "gamey" -- it should feel like it belongs in the same cozy world the player is tending.

### 1.2 Screen Map (ASCII Art)

Base resolution: 480w x 270h (1x). All coordinates and sizes in base pixels.

```
 480px
+------------------------------------------------------------------------+
|4px                                                           4px       | 4px
|  +------------------+                      +---------------+           |
|  | [clock] 8:30 AM  |                      | [coin] 12,450|           |
|  | [leaf]  Day 12    |                      | [star]    38  |           |
|  |    Spring         |                      +---------------+           |
|  +------------------+                       (46x28) @ x430,y4          |
|   (56x28) @ x4,y4                                                     |
|                                                                        |
|                                                                        |
|                                                                        |
|                                                              +------+  |
|                                                              |######|  |
|                                                              |######|  |
|                      (GAME WORLD)                            |  EN  |  |
|                                                              |  ER  |  |
|                                                              |  GY  |  |
|                                                              |######|  |
|                                                              |######|  |
|                                                              +------+  |
|                                                              (10x48)   |
|                                                            @ x466,y111 |
|                                                                        |
|                                                                        |
|   +------------------------------------------------------------------+ |
|   | [1] [2] [3] [4] [5] [6] [7] [8] [9] [0] |              +------+ | |
|   |  hotbar: 10 slots, 16px each, 2px gap    |              | MENU | | |
|   +------------------------------------------------------------------+ |
|    (186x24) centered @ x147,y242                             (16x16)   |
|                                                            @ x460,y250 |
+------------------------------------------------------------------------+
                              270px (height)
```

**Precise anchor positions (top-left corner of each element, 1x base):**

| Element | Position (x, y) | Size (w x h) | Anchor |
|---------|------------------|---------------|--------|
| Clock Panel | (4, 4) | 56 x 28 | top-left |
| Currency Panel | (430, 4) | 46 x 28 | top-right |
| Energy Bar | (466, 111) | 10 x 48 | right-center |
| Hotbar | (147, 242) | 186 x 24 | bottom-center |
| Menu Button | (460, 250) | 16 x 16 | bottom-right |

**Margin rules:** All HUD elements maintain a minimum 4px margin from screen edges at base resolution. The hotbar is horizontally centered. The energy bar is vertically centered on the right edge. The menu button sits in the bottom-right corner.

### 1.3 Color Palette

Derived from the LimeZu Modern User Interface sprite sheet for consistency.

| Name | Hex | Usage |
|------|-----|-------|
| **Parchment** | `#F2E2C4` | Panel backgrounds, inventory slot fill, tooltip fills |
| **Walnut** | `#6B4226` | Panel borders (9-slice edges), frame outlines |
| **Ink Brown** | `#3B2819` | Primary text, icon outlines, separators |
| **Harvest Gold** | `#DAA520` | Active slot highlight, currency text, selected states |
| **Meadow Green** | `#5FAD46` | Energy bar fill, positive feedback, health indicators |
| **Warm White** | `#FFF8EC` | Hover highlights, bright text on dark backgrounds |

**Extended palette (secondary use):**

| Name | Hex | Usage |
|------|-----|-------|
| **Faded Tan** | `#C8A882` | Disabled/empty slot backgrounds, shadow tones |
| **Sunset Red** | `#C0392B` | Low energy warning, negative feedback, alerts |
| **Sky Blue** | `#5DADE2` | Star currency icon tint, special/rare item highlight |
| **Shadow Brown** | `#2C1A0E` | Drop shadows behind panels (50% opacity, offset 1px) |

### 1.4 Style Rules

**Panel Construction**
- All rectangular HUD panels use 9-slice scaling from the LimeZu parchment frame sprites. Each 9-slice is composed of 32px tiles: 4 corners (fixed), 4 edges (stretched), 1 center (stretched).
- Panels cast a 1px drop shadow in Shadow Brown (`#2C1A0E`) at 50% opacity, offset (1, 1).

**Typography**
- All HUD text uses a bitmap pixel font ("Press Start 2P" via `next/font/google`).
- Primary text color: Ink Brown (`#3B2819`).
- Currency values and highlighted numbers: Harvest Gold (`#DAA520`).
- Text size: 5px character height at base resolution (15px at 3x, 20px at 4x).

**Hotbar**
- Each slot is a 9-slice panel (NineSlicePanel component) rendered at 96px (3x3 grid of 32px tiles), clipped to 40px via `overflow: hidden` and centered positioning to show 4px border + 32px center + 4px border.
- Active slot: Uses `SLOT_SELECTED` 9-slice set (golden border variant).
- Slot number labels (1-9, 0) rendered above each slot in Ink Brown at 50% opacity.
- Gaps between slots: 2px transparent.

**Energy Bar**
- Vertical bar, right side. Inner fill color transitions: Meadow Green (`#5FAD46`) > 35% | Harvest Gold (`#DAA520`) 15-35% | Sunset Red (`#C0392B`) < 15%.
- Depletes top-to-bottom.

**Opacity and Layering**
- HUD renders on topmost layer above all game world sprites and lighting.

**Spacing and Alignment**
- 4px minimum gap from HUD element to screen edge.
- 2px minimum gap between adjacent HUD elements.
- 2px internal padding from panel border to text.
- 2px icon-to-text spacing within panels.

**Interaction Feedback**
- Hover: overlay Warm White (`#FFF8EC`) at 20% opacity.
- Press: content shifts 1px down and 1px right (pixel-art press effect).
- Menu button: three-state sprite (default, hover, pressed).

**Mobile Adaptations**
- All touch targets minimum 44x44 CSS pixels.
- Hotbar slot number labels hidden on mobile (tap selection).

### 1.5 Element Sizing Guide

| Element | Base (1x) | 3x Display | 4x Display | Notes |
|---------|-----------|------------|------------|-------|
| **Hotbar slot** | 40 x 40 px | -- | -- | 9-slice clipped (32px content + 4px border each side) |
| **Hotbar (full)** | 10 slots + 9 gaps | -- | -- | 10 x 40px + 9 x 2px = 418px |
| **Hotbar gap** | 2 | -- | -- | Transparent between slots |
| **Clock Panel** | auto | auto | auto | Content-driven 9-slice |
| **Currency Panel** | auto | auto | auto | Content-driven 9-slice |
| **Energy Bar** | 10 x 48 | 30 x 144 | 40 x 192 | Narrow vertical bar |
| **Menu Button** | 16 x 16 | 48 x 48 | 64 x 64 | Three-state sprite |
| **Icon (small)** | 8 x 8 | 24 x 24 | 32 x 32 | Clock, coin, star icons |
| **Text (standard)** | 5px h | 15px h | 20px h | Bitmap font |
| **Text (small)** | 3px h | 9px h | 12px h | Slot labels, annotations |
| **Screen margin** | 4 | 12 | 16 | HUD element to screen edge |
| **Shadow offset** | 1, 1 | 3, 3 | 4, 4 | Panel drop shadow |

---

## 2. Sprite Sheet Map (Technical Artist)

### 2.1 Sprite Sheet Overview

**Source:** `apps/game/public/assets/ui/hud_32.png`
**Dimensions:** 1952 x 1376 px
**Base Tile Grid:** 32 x 32 px (61 columns x 43 rows)
**Pack:** LimeZu Modern User Interface

**Tile index formula:** tile N -> col = N % 61, row = floor(N / 61) -> pixel coords (col * 32, row * 32)

### 2.2 Verified Sprite Coordinates

The following coordinates have been verified and are implemented in `apps/game/src/components/hud/sprites.ts`.

#### 2.2.1 9-Slice Panel Frames

Each panel frame is a 3x3 grid of 32px tiles forming a `NineSliceSet`: 4 corners (fixed size) + 4 edges (stretched) + 1 center (stretched).

**Slot Normal (tiles 1101-1225) -- Primary HUD Panel**

Row 18-20, columns 3-5 of the sprite sheet.

| Piece | Tile | X | Y | W | H |
|-------|------|---|---|---|---|
| Corner TL | 1101 | 96 | 576 | 32 | 32 |
| Edge T | 1102 | 128 | 576 | 32 | 32 |
| Corner TR | 1103 | 160 | 576 | 32 | 32 |
| Edge L | 1162 | 96 | 608 | 32 | 32 |
| Center | 1163 | 128 | 608 | 32 | 32 |
| Edge R | 1164 | 160 | 608 | 32 | 32 |
| Corner BL | 1223 | 96 | 640 | 32 | 32 |
| Edge B | 1224 | 128 | 640 | 32 | 32 |
| Corner BR | 1225 | 160 | 640 | 32 | 32 |

**Slot Selected (tiles 613-737) -- Active/Golden Panel**

Row 10-12, columns 3-5 of the sprite sheet.

| Piece | Tile | X | Y | W | H |
|-------|------|---|---|---|---|
| Corner TL | 613 | 96 | 320 | 32 | 32 |
| Edge T | 614 | 128 | 320 | 32 | 32 |
| Corner TR | 615 | 160 | 320 | 32 | 32 |
| Edge L | 674 | 96 | 352 | 32 | 32 |
| Center | 675 | 128 | 352 | 32 | 32 |
| Edge R | 676 | 160 | 352 | 32 | 32 |
| Corner BL | 735 | 96 | 384 | 32 | 32 |
| Edge B | 736 | 128 | 384 | 32 | 32 |
| Corner BR | 737 | 160 | 384 | 32 | 32 |

#### 2.2.2 Icons (Approximate -- Pending Verification)

These coordinates are approximate and need verification at 1:1 zoom in an image editor.

| Icon | X | Y | W | H | Status |
|------|---|---|---|---|--------|
| Coin | 32 | 32 | 11 | 11 | Approximate |
| Menu Button (normal) | 24 | 32 | 11 | 11 | Approximate |
| Menu Button (hover) | 35 | 32 | 11 | 11 | Approximate |
| Season: Spring | 0 | 48 | 11 | 11 | Approximate |
| Season: Summer | 11 | 48 | 11 | 11 | Approximate |
| Season: Autumn | 21 | 48 | 11 | 11 | Approximate |
| Season: Winter | 32 | 48 | 11 | 11 | Approximate |

#### 2.2.3 Bar Components (Approximate -- Pending Verification)

| Element | X | Y | W | H | Status |
|---------|---|---|---|---|--------|
| Energy frame | 64 | 0 | 5 | 32 | Approximate |
| Energy fill | 69 | 0 | 3 | 32 | Approximate |
| Energy empty | 72 | 0 | 3 | 32 | Approximate |

### 2.3 Scaling Rules

| Rule | Value |
|------|-------|
| **Base tile** | 32 x 32 px (native sprite sheet tile) |
| **9-slice panels** | Rendered at native 1:1 pixel size (corners: `spriteNativeStyle`, edges/center: `spriteStretchStyle`) |
| **UI text/spacing** | Scaled via `calc(Xpx * var(--ui-scale))` CSS custom property |
| **Integer scaling only** | **MANDATORY.** No fractional scaling. |
| **CSS rendering** | `image-rendering: pixelated` (Chrome/Edge), `crisp-edges` (Firefox), `-webkit-optimize-contrast` (Safari) |
| **Anti-aliasing** | DISABLED for all sprite elements. |
| **Sub-pixel positioning** | PROHIBITED. All sprite positions must land on whole-pixel boundaries. |

### 2.4 Coordinate Verification Checklist

- [x] Open `hud_32.png` in an image editor at 1:1 zoom
- [x] Locate 9-slice slot normal tiles (1101-1225) and record exact coordinates
- [x] Locate 9-slice slot selected tiles (613-737) and record exact coordinates
- [x] Verify 9-slice corner/edge/center pieces tile correctly via `spriteStretchStyle()`
- [x] Test slicing in browser -- confirmed working
- [x] Document verified coordinates in `sprites.ts`
- [ ] Verify icon sprite coordinates (coin, season, menu, energy) at 1:1 zoom
- [ ] Confirm icon sizes match expected rendering

---

## 3. Implementation (UI Developer)

### 3.1 Component Architecture

```
apps/game/src/components/hud/
├── HUD.tsx                    # Root overlay, manages scale + keyboard dispatch
├── HUD.module.css             # Root layout, scale custom property, pixel font
├── ClockPanel.tsx             # Day number, time, season icon (top-left)
├── ClockPanel.module.css
├── CurrencyDisplay.tsx        # Coin icon + gold amount (top-right)
├── CurrencyDisplay.module.css
├── EnergyBar.tsx              # Vertical energy bar (right edge)
├── EnergyBar.module.css
├── Hotbar.tsx                 # 10-slot hotbar container (bottom-center)
├── Hotbar.module.css
├── HotbarSlot.tsx             # Single hotbar slot (9-slice + item icon + quantity)
├── HotbarSlot.module.css
├── MenuButton.tsx             # Opens main menu (bottom-right)
├── MenuButton.module.css
├── NineSlicePanel.tsx         # Reusable 9-slice background component
├── NineSlicePanel.module.css
├── sprite.ts                  # Sprite-slicing utilities (4 functions)
├── sprites.ts                 # Named sprite coordinate map + NineSliceSet constants
└── types.ts                   # Shared HUD prop/state interfaces
```

Integration in `GameApp.tsx`:

```tsx
import { HUD } from '@/components/hud/HUD';
// ...
{!loading && <HUD />}
```

Data flows from Phaser to the HUD via the existing `EventBus`. The HUD subscribes to events; it never reaches into Phaser directly.

### 3.2 CSS Foundation

```css
/* HUD.module.css */
.hud {
  --ui-scale: 3;

  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  font-family: var(--font-pixel);
  color: #3b2819;

  /* MANDATORY pixel-perfect rendering (triple fallback) */
  image-rendering: -webkit-optimize-contrast; /* Safari */
  image-rendering: crisp-edges;               /* Firefox */
  image-rendering: pixelated;                 /* Chrome, Edge */
}

/* Interactive children re-enable pointer events */
.hud button,
.hud [data-interactive='true'] {
  pointer-events: auto;
  cursor: pointer;
}

/* Global sprite rendering guarantee */
.hud * {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
}
```

**Pixel font (in HUD.tsx):**

```tsx
import { Press_Start_2P } from 'next/font/google';

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixel',
});
```

### 3.3 Sprite Slice Helpers

#### `sprite.ts`

Four utility functions for rendering sprites from the sheet:

```typescript
export const SHEET_PATH = '/assets/ui/hud_32.png';
export const SHEET_W = 1952;
export const SHEET_H = 1376;
```

| Function | Purpose | When to use |
|----------|---------|-------------|
| `spriteStyle(x, y, w, h, scale)` | Fixed numeric scale factor | Legacy/testing |
| `spriteCSSStyle(x, y, w, h)` | `calc(Xpx * var(--ui-scale))` -- reflows on resize | Text-adjacent icons that scale with UI |
| `spriteNativeStyle(x, y, w, h)` | 1:1 pixel rendering, explicit width/height | 9-slice corners (fixed 32px) |
| `spriteStretchStyle(x, y, w, h)` | Percentage-based background-size/position | 9-slice edges/center (stretch to fill container) |

**`spriteStretchStyle` math** (key insight for 9-slice edge stretching):

```typescript
// Cannot use background-repeat because it repeats the ENTIRE sheet, not one tile.
// Instead, use percentage-based sizing to stretch a single tile to fill its container.
export function spriteStretchStyle(x, y, w, h): React.CSSProperties {
  const cols = SHEET_W / w;   // total columns of this tile size in sheet
  const rows = SHEET_H / h;   // total rows
  const tileCol = x / w;      // which column this tile is at
  const tileRow = y / h;      // which row
  const posX = cols > 1 ? (tileCol / (cols - 1)) * 100 : 0;
  const posY = rows > 1 ? (tileRow / (rows - 1)) * 100 : 0;

  return {
    backgroundImage: `url('${SHEET_PATH}')`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${posX}% ${posY}%`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    imageRendering: 'pixelated',
  };
}
```

#### `sprites.ts` -- Named Sprite Coordinates

```typescript
import type { NineSliceSet, SpriteRect } from './types';

// 9-slice: slot normal (tiles 1101-1225)
export const SLOT_NORMAL: NineSliceSet = {
  cornerTL: [96, 576, 32, 32], edgeT: [128, 576, 32, 32], cornerTR: [160, 576, 32, 32],
  edgeL: [96, 608, 32, 32],    center: [128, 608, 32, 32], edgeR: [160, 608, 32, 32],
  cornerBL: [96, 640, 32, 32], edgeB: [128, 640, 32, 32],  cornerBR: [160, 640, 32, 32],
};

// 9-slice: slot selected (tiles 613-737)
export const SLOT_SELECTED: NineSliceSet = {
  cornerTL: [96, 320, 32, 32], edgeT: [128, 320, 32, 32], cornerTR: [160, 320, 32, 32],
  edgeL: [96, 352, 32, 32],    center: [128, 352, 32, 32], edgeR: [160, 352, 32, 32],
  cornerBL: [96, 384, 32, 32], edgeB: [128, 384, 32, 32],  cornerBR: [160, 384, 32, 32],
};

export const PANEL_DEFAULT = SLOT_NORMAL;

export const SPRITES = {
  coinIcon: [32, 32, 11, 11] as SpriteRect,       // approximate
  menuBtnNormal: [24, 32, 11, 11] as SpriteRect,  // approximate
  // ... etc
} as const;
```

### 3.4 Types (`types.ts`)

```typescript
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SpriteRect = [x: number, y: number, w: number, h: number];

export interface NineSliceSet {
  cornerTL: SpriteRect; edgeT: SpriteRect; cornerTR: SpriteRect;
  edgeL: SpriteRect;    center: SpriteRect; edgeR: SpriteRect;
  cornerBL: SpriteRect; edgeB: SpriteRect;  cornerBR: SpriteRect;
}

export interface HotbarItem {
  id: string;
  spriteRect: SpriteRect;
  quantity: number;
}

export interface HUDState {
  day: number;
  time: string;           // "HH:MM"
  season: Season;
  gold: number;
  energy: number;         // 0-100
  maxEnergy: number;
  hotbarItems: (HotbarItem | null)[];  // length 10
  selectedSlot: number;   // 0-9
}
```

### 3.5 NineSlicePanel (CSS Grid Approach)

**Key design decision:** CSS Grid 3x3 with explicit cell placement.

```css
/* NineSlicePanel.module.css */
.grid {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  grid-template-rows: 32px 1fr 32px;
  position: relative;
  filter: drop-shadow(1px 1px 0 rgba(44, 26, 14, 0.5));
}
.cell { overflow: hidden; }
.edge { width: 100%; height: 100%; min-width: 0; min-height: 0; }
.content { grid-column: 2; grid-row: 2; position: relative; z-index: 1; }
```

**Critical implementation detail:** All 9 decorative cells MUST have explicit `gridColumn`/`gridRow` inline styles. Without explicit placement, auto-flow creates 10 children in a 3x3 grid (9 decorative + 1 content overlay at grid-column:2/grid-row:2), which pushes the 9th auto cell to an implicit 4th row and collapses the `1fr` middle row to 0px.

```tsx
// Each cell gets explicit placement via inline style:
<div style={{ gridColumn: 1, gridRow: 1, ...spriteNativeStyle(...slices.cornerTL) }} />
<div style={{ gridColumn: 2, gridRow: 1, ...spriteStretchStyle(...slices.edgeT) }} />
// ... all 9 cells explicitly placed
<div className={styles.content}>{children}</div>  // overlaps center at (2,2)
```

The `NineSliceSet` prop allows different tile sets to be passed in:

```tsx
<NineSlicePanel slices={isSelected ? SLOT_SELECTED : SLOT_NORMAL}>
  {children}
</NineSlicePanel>
```

**How `1fr` resolves:**
- With explicit parent height (e.g., HotbarSlot `.background` at 96px): `1fr = 96 - 32 - 32 = 32px`
- With content children (e.g., ClockPanel text): `1fr` expands to fit content

### 3.6 HotbarSlot Architecture

Each slot is 40px x 40px with the 96px NineSlicePanel centered and clipped:

```
 40px slot (overflow: hidden)
+--------------------------------------+
|   4px  |      32px center     | 4px  |   <- visible portion of 96px panel
|  edge  |       (items go      | edge |
|        |        here)         |      |
+--------------------------------------+
```

Structure:
```tsx
<div className={styles.wrapper}>          {/* flex column, centers key hint */}
  <span className={styles.keyHint}>1</span>  {/* above the slot, NOT clipped */}
  <button className={styles.slot}>        {/* 40x40, overflow: hidden */}
    <NineSlicePanel className={styles.background}> {/* absolute, centered, 96x96 */}
      <div className={styles.content}>    {/* item icon + quantity */}
    </NineSlicePanel>
  </button>
</div>
```

CSS:
```css
.slot {
  width: 32px; height: 32px;
  padding: 16px;
  box-sizing: content-box;      /* total = 32 + 16*2 = 64px */
  overflow: hidden;
}
.background {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 96px; height: 96px;
}
```

### 3.7 Responsive Scaling Strategy

| Tier | Viewport | --ui-scale | Notes |
|------|----------|------------|-------|
| Minimum | 960x540 | 2 | Small laptops |
| Default | 1440x810 | 3 | Most displays |
| Full HD | 1920x1080 | 4 | Standard desktop |
| QHD | 2560x1440 | 5 | Large monitors |
| 4K | 3840x2160 | 6 | High-res displays |

**Formula:** `Math.max(2, Math.min(6, Math.min(Math.floor(vw/480), Math.floor(vh/270))))`

**Why `calc()` over `transform: scale()`:**
- `transform: scale(N)` causes layout breakage (elements occupy pre-transform space)
- Sub-pixel positioning causes half-pixel jitter on pixel art
- `calc(Xpx * var(--ui-scale))` gives integer pixels at every breakpoint

**Note:** 9-slice panel tiles render at native 1:1 size (no `--ui-scale` multiplication). Only text, spacing, and icon elements use `--ui-scale`.

### 3.8 EventBus Integration

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `hud:time` | Phaser -> React | `(day, time, season)` | Update clock panel |
| `hud:gold` | Phaser -> React | `(gold)` | Update currency display |
| `hud:energy` | Phaser -> React | `(energy, maxEnergy)` | Update energy bar |
| `hud:select-slot` | React -> Phaser | `(slotIndex)` | Notify Phaser of slot change |
| `hud:menu-toggle` | React -> Phaser | -- | Toggle game menu |

### 3.9 Accessibility

| Element | ARIA | Notes |
|---------|------|-------|
| HUD root | `role="region" aria-label="Game heads-up display"` | Container |
| Clock | `role="status" aria-live="polite"` | Gentle time announcements |
| Currency | `role="status" aria-label="Gold: 1,250"` | Currency readout |
| Energy | `role="progressbar" aria-valuenow/min/max` | Progress bar semantics |
| Hotbar | `role="toolbar"` | Slot group |
| Slot | `<button> aria-pressed` | Active/inactive state |
| Menu | `<button> aria-label="Open game menu"` | Action button |

All decorative sprites: `aria-hidden="true"`.

Focus: `:focus-visible` yellow outline (`#ffdd57`), 2px wide.

---

## 4. HUD Behavior & Feedback (Gameplay Designer)

See dedicated document: [`hud-behavior-and-feedback.md`](./hud-behavior-and-feedback.md)

Covers: Energy system (costs, recovery, visual states), clock/time display, hotbar interactions (drag-and-drop, cooldowns, durability), currency animations, contextual HUD changes, notification system, mobile-specific behavior, animation timing reference, and keyboard shortcuts.

---

## Implementation Status

### V1 (Implemented)

- [x] Static layout -- all 5 HUD elements positioned correctly
- [x] Sprite rendering from `hud_32.png` (32px tile grid)
- [x] NineSlicePanel with CSS Grid and explicit cell placement
- [x] `spriteNativeStyle` (1:1 corners) and `spriteStretchStyle` (percentage edges)
- [x] `NineSliceSet` interface for swappable 9-slice tile sets
- [x] Integer pixel scaling via `--ui-scale` CSS custom property
- [x] Keyboard slot selection (1-0) and click selection
- [x] Pixel font (Press Start 2P) via `--font-pixel`
- [x] EventBus listener stubs (`hud:time`, `hud:gold`, `hud:energy`)
- [x] Energy bar fill with color thresholds
- [x] ARIA accessibility (roles, labels, live regions)

### Pending

- [ ] Verify icon sprite coordinates (coin, season, menu, energy) at 1:1 zoom in image editor
- [ ] Animations (bounces, shakes, pulses, item use feedback)
- [ ] Drag-and-drop hotbar reordering
- [ ] Cooldown overlays
- [ ] Toast notifications
- [ ] Weather effects on HUD
- [ ] Contextual HUD changes (dialogue fade, fishing mode, etc.)
- [ ] Mobile behavior (swipe, long-press, condensed layout)
- [ ] Tool durability bars
- [ ] Currency earn/spend animations

---

## Appendix: File Inventory

| File | Purpose |
|------|---------|
| `apps/game/src/components/hud/HUD.tsx` | Root overlay, scale, keyboard, EventBus |
| `apps/game/src/components/hud/HUD.module.css` | Root layout, pixel font, image-rendering |
| `apps/game/src/components/hud/ClockPanel.tsx` | Day/time/season display |
| `apps/game/src/components/hud/CurrencyDisplay.tsx` | Gold counter |
| `apps/game/src/components/hud/EnergyBar.tsx` | Vertical energy bar |
| `apps/game/src/components/hud/Hotbar.tsx` | 10-slot container |
| `apps/game/src/components/hud/HotbarSlot.tsx` | Individual slot with 9-slice |
| `apps/game/src/components/hud/MenuButton.tsx` | Menu toggle |
| `apps/game/src/components/hud/NineSlicePanel.tsx` | Reusable 9-slice panel |
| `apps/game/src/components/hud/sprite.ts` | Sprite slicing utilities (4 functions) |
| `apps/game/src/components/hud/sprites.ts` | Named coordinate map + NineSliceSet constants |
| `apps/game/src/components/hud/types.ts` | Shared TS interfaces |
| `docs/documentation/design/systems/hud-design-spec.md` | **This document** |
| `docs/documentation/design/systems/hud-behavior-and-feedback.md` | Section 4 detailed spec |

---

*End of HUD Design Spec v2.0*
*Combined output from: UI Art Director, Technical Artist, Game UI Developer, Gameplay Designer*
