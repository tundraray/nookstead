# Autotile System Reference

**Date:** 2026-02-22
**Status:** Reference (derived from source code)
**Primary source files:**
- `packages/map-lib/src/core/autotile.ts`
- `packages/map-lib/src/core/neighbor-mask.ts`
- `packages/map-lib/src/core/autotile-layers.ts`
- `packages/map-lib/src/core/commands.ts`
- `packages/map-lib/src/core/material-resolver.ts`
- `packages/map-lib/src/types/editor-types.ts`
- `packages/map-lib/src/types/material-types.ts`
- `apps/genmap/src/components/map-editor/canvas-renderer.ts`

---

## 1. System Overview

The autotile system selects the correct sprite frame from a terrain spritesheet for each cell on the map, based on that cell's 8 neighbors. The result is seamless blending of terrain regions — grass fading into water, water fading into deep water, and so on — with no manual sprite selection by the user.

The implementation is a **Blob-47** autotile algorithm: 47 valid frame configurations derived from an 8-bit neighbor bitmask, with diagonal gating applied to keep the frame count manageable.

The system also selects which **tileset spritesheet** to sample from for each cell. Interior cells use their material's base tileset; cells at a border between two materials use a specialized **transition tileset** for that material pair.

### Architecture: Where Each Piece Lives

```
packages/map-lib/src/core/autotile.ts
  - Bit constants (N, NE, E, …)
  - gateDiagonals()
  - getFrame()
  - VALID_BLOB47_MASKS[]
  - FRAME_TABLE[] (256-entry lookup)
  - Constants: SOLID_FRAME=1, ISOLATED_FRAME=47, EMPTY_FRAME=0

packages/map-lib/src/core/neighbor-mask.ts
  - computeNeighborMask()           — tileset-key-based lookup (legacy)
  - computeNeighborMaskByMaterial() — direct material string comparison (active)
  - computeTransitionMask()         — transition-specific mask for multi-foreign cells
  - checkTerrainPresence()

packages/map-lib/src/core/autotile-layers.ts
  - recomputeAutotileLayers()       — top-level entry point after any paint
  - buildTilesetPairMap()           — "from:to" → tilesetKey lookup
  - findDominantNeighbor()          — which foreign material is most common
  - findIndirectTileset()           — 2-hop path when direct pair is missing

packages/map-lib/src/core/commands.ts
  - applyDeltas()                   — applies terrain changes + triggers recompute
  - PaintCommand / FillCommand      — undo/redo wrappers

apps/genmap/src/components/map-editor/canvas-renderer.ts
  - renderMapCanvas()               — reads frames and tilesetKeys, draws to canvas
```

---

## 2. Bit Constants and the 8-Neighbor Bitmask

Each of the 8 directions around a cell is mapped to a power-of-two bit:

```
NW(128)  N(1)  NE(2)
W(64)   cell   E(4)
SW(32)  S(16)  SE(8)
```

These are exported from `autotile.ts`:

```typescript
export const N  = 1;
export const NE = 2;
export const E  = 4;
export const SE = 8;
export const S  = 16;
export const SW = 32;
export const W  = 64;
export const NW = 128;
```

A mask with all 8 bits set = 255 (0xFF) means "all 8 neighbors match" — a fully interior cell.
A mask of 0 means "no matching neighbors" — a completely isolated cell.

### NEIGHBOR_OFFSETS (iteration order)

`neighbor-mask.ts` defines the canonical iteration order matching the bit constants:

```typescript
export const NEIGHBOR_OFFSETS = [
  [0, -1, N],   // North
  [1, -1, NE],  // Northeast
  [1,  0, E],   // East
  [1,  1, SE],  // Southeast
  [0,  1, S],   // South
  [-1, 1, SW],  // Southwest
  [-1, 0, W],   // West
  [-1,-1, NW],  // Northwest
];
```

Grid indexing is `grid[y][x]`.

---

## 3. Diagonal Gating

Raw 8-bit masks can describe geometrically impossible corners. For example: NE bit set but neither N nor E is set. Diagonal gating eliminates these impossible states, reducing 256 raw possibilities to exactly **47 valid configurations**.

**Rule:** A diagonal bit is kept only when both of its adjacent cardinal bits are present.

```typescript
export function gateDiagonals(mask: number): number {
  const hasN = !!(mask & N);
  const hasE = !!(mask & E);
  const hasS = !!(mask & S);
  const hasW = !!(mask & W);

  let gated = mask & (N | E | S | W); // always keep cardinals

  if (hasN && hasE && (mask & NE)) gated |= NE;
  if (hasS && hasE && (mask & SE)) gated |= SE;
  if (hasS && hasW && (mask & SW)) gated |= SW;
  if (hasN && hasW && (mask & NW)) gated |= NW;

  return gated;
}
```

`getFrame()` always calls `gateDiagonals()` internally, so callers never need to pre-gate the mask:

```typescript
export function getFrame(neighbors: number): number {
  return FRAME_TABLE[gateDiagonals(neighbors)];
}
```

---

## 4. Frame Table: All 47 Valid Configurations

The spritesheet is 12 columns x 4 rows = 48 slots. Frame 0 is reserved for "empty" (no terrain). Frames 1–47 map to the 47 valid gated masks.

The frame table is built once at module load by `buildFrameTable()`. It is a 256-entry array initialized to `ISOLATED_FRAME` (47); only the 47 valid masks are overwritten.

### Frame categories (frame number → visual type)

| Frames | Category | Mask examples |
|--------|----------|--------------|
| 1 | Solid (all neighbors) | 255 |
| 2–16 | Center tiles: all 4 cardinals, corner variations | 127, 253, 125, 247, … |
| 17–20 | T-junction open W (N+E+S present, W absent) | 31, 29, 23, 21 |
| 21–24 | T-junction open N (E+S+W present, N absent) | 124, 116, 92, 84 |
| 25–28 | T-junction open E (N+S+W present, E absent) | 241, 113, 209, 81 |
| 29–32 | T-junction open S (N+E+W present, S absent) | 199, 71, 197, 69 |
| 33 | Corridor vertical (N+S) | 17 |
| 34 | Corridor horizontal (E+W) | 68 |
| 35–36 | L-corner E+S | 28, 20 |
| 37–38 | L-corner S+W | 112, 80 |
| 39–40 | L-corner N+W | 193, 65 |
| 41–42 | L-corner N+E | 7, 5 |
| 43 | Dead-end S | 16 |
| 44 | Dead-end E | 4 |
| 45 | Dead-end N | 1 |
| 46 | Dead-end W | 64 |
| 47 | Isolated (no neighbors) | 0 |

### Complete mask-to-frame mapping

```
mask=255 → frame 1  (SOLID)
mask=127 → frame 2  (SE+SW+NE, missing NW)
mask=253 → frame 3  (NW+SE+SW, missing NE)
mask=125 → frame 4  (SE+SW, missing NW+NE)
mask=247 → frame 5  (NW+NE+SW, missing SE)
mask=119 → frame 6  (NE+SW, missing NW+SE)
mask=245 → frame 7  (NW+SW, missing NE+SE)
mask=117 → frame 8  (SW only corner)
mask=223 → frame 9  (NW+NE+SE, missing SW)
mask=95  → frame 10 (NE+SE, missing NW+SW)
mask=221 → frame 11 (NW+SE, missing NE+SW)
mask=93  → frame 12 (SE only corner)
mask=215 → frame 13 (NW+NE, missing SE+SW)
mask=87  → frame 14 (NE only corner)
mask=213 → frame 15 (NW only corner)
mask=85  → frame 16 (cross, no corners)
mask=31  → frame 17 (T open-W, +NE+SE)
mask=29  → frame 18 (T open-W, +SE, NE absent)
mask=23  → frame 19 (T open-W, +NE, SE absent)
mask=21  → frame 20 (T open-W, bare)
mask=124 → frame 21 (T open-N, +SE+SW)
mask=116 → frame 22 (T open-N, +SW, SE absent)
mask=92  → frame 23 (T open-N, +SE, SW absent)
mask=84  → frame 24 (T open-N, bare)
mask=241 → frame 25 (T open-E, +NW+SW)
mask=113 → frame 26 (T open-E, +SW, NW absent)
mask=209 → frame 27 (T open-E, +NW, SW absent)
mask=81  → frame 28 (T open-E, bare)
mask=199 → frame 29 (T open-S, +NW+NE)
mask=71  → frame 30 (T open-S, +NE, NW absent)
mask=197 → frame 31 (T open-S, +NW, NE absent)
mask=69  → frame 32 (T open-S, bare)
mask=17  → frame 33 (corridor vertical N+S)
mask=68  → frame 34 (corridor horizontal E+W)
mask=28  → frame 35 (L-corner E+S, filled)
mask=20  → frame 36 (L-corner E+S, bare)
mask=112 → frame 37 (L-corner S+W, filled)
mask=80  → frame 38 (L-corner S+W, bare)
mask=193 → frame 39 (L-corner N+W, filled)
mask=65  → frame 40 (L-corner N+W, bare)
mask=7   → frame 41 (L-corner N+E, filled)
mask=5   → frame 42 (L-corner N+E, bare)
mask=16  → frame 43 (dead-end S)
mask=4   → frame 44 (dead-end E)
mask=1   → frame 45 (dead-end N)
mask=64  → frame 46 (dead-end W)
mask=0   → frame 47 (ISOLATED)
```

### Named constants

```typescript
SOLID_FRAME    = 1   // getFrame(255)
ISOLATED_FRAME = 47  // getFrame(0)
EMPTY_FRAME    = 0   // no terrain in this cell
FRAMES_PER_TERRAIN = 48
```

### Spritesheet layout

```
Frame 0  (empty — col 0,  row 0)
Frame 1  (solid — col 1,  row 0)
...
Frame 11 (         col 11, row 0)
Frame 12 (         col 0,  row 1)
...
Frame 47 (isolated— col 11, row 3)
```

The renderer computes source pixel coordinates as:

```typescript
const TILESET_COLS = 12; // FRAMES_PER_TERRAIN / 4
const TILE_PX = 16;
const srcX = (frame % TILESET_COLS) * TILE_PX;
const srcY = Math.floor(frame / TILESET_COLS) * TILE_PX;
```

---

## 5. Neighbor Mask Computation

Three functions compute the 8-bit neighbor mask. All live in `neighbor-mask.ts`.

### 5.1 computeNeighborMask (tileset-key-based, legacy)

```typescript
function computeNeighborMask(
  grid, x, y, width, height,
  terrainKey: string,          // e.g. "terrain-03"
  tilesets: TilesetInfo[],
  options?: { outOfBoundsMatches?: boolean }
): number
```

Looks up the tileset entry by `terrainKey`, then checks each neighbor's `terrain` string against `entry.fromMaterialKey ?? entry.name`. This function is no longer called by `recomputeAutotileLayers` — it exists for backward-compatibility consumers (e.g. the old per-layer `terrainKey` approach).

### 5.2 computeNeighborMaskByMaterial (direct comparison, active)

```typescript
function computeNeighborMaskByMaterial(
  grid, x, y, width, height,
  materialKey: string,         // e.g. "grass"
  options?: { outOfBoundsMatches?: boolean }
): number
```

Sets bit = 1 when `neighbor.terrain === materialKey`. This is the function used by `recomputeAutotileLayers` for all mask computation. It performs no tileset lookup — comparison is a direct string equality check.

### 5.3 computeTransitionMask (target-specific, anti-tunnel)

```typescript
function computeTransitionMask(
  grid, x, y, width, height,
  targetMaterial: string,      // the dominant foreign neighbor
  options?: { outOfBoundsMatches?: boolean }
): number
```

Sets bit = 1 when `neighbor.terrain !== targetMaterial`.

This is the **inverse** of `computeNeighborMaskByMaterial` from the perspective of the target. The purpose is to prevent "tunnel artifacts" when a cell borders two different foreign materials simultaneously.

**Example — why it matters:**

```
Cell = deep_sand (DS), neighbors W = deep_water (DW), E = sand (S)
  computeNeighborMaskByMaterial(DS): W=0, E=0  → both sides open
  computeTransitionMask(target=DW):  W=0, E=1  → only DW side open, sand side treated as solid
```

Without the transition mask, the frame would show open transitions on both the DW and S sides simultaneously, creating a visual "tunnel" through the DS cell to both foreign materials. With the transition mask, only the dominant neighbor (DW) creates a transition; the sand side appears solid.

### 5.4 Out-of-bounds behavior

All three functions accept `options.outOfBoundsMatches` (default: `true`):

- `true`: OOB neighbors are treated as matching (bit set). This makes map edges appear seamlessly connected — a tile at the top edge looks like it continues upward.
- `false`: OOB neighbors are treated as non-matching (bit clear). This produces isolated/transition behavior at the map boundary.

`recomputeAutotileLayers` uses the default (`true`) for all mask computations.

---

## 6. The Full Recompute Pipeline

### 6.1 Entry point: recomputeAutotileLayers

```typescript
function recomputeAutotileLayers(
  grid: Cell[][],
  layers: EditorLayer[],
  affectedCells: ReadonlyArray<{ x: number; y: number }>,
  materials: ReadonlyMap<string, MaterialInfo> = new Map(),
  paintedCells?: ReadonlySet<string>,   // "x,y" keys of directly painted cells
  tilesets?: ReadonlyArray<TilesetInfo>,
): EditorLayer[]
```

Returns a **new** layers array with updated `frames` and `tilesetKeys` 2D arrays. The input is not mutated.

### 6.2 Recalculation scope

For each affected cell, the function adds the cell itself **plus its 8 neighbors** to a `recalcSet`. This means up to 9 cells per affected cell, deduplicated via a `Set<string>`.

```
Affected cell at (x, y) → recalc all (x-1..x+1, y-1..y+1) in bounds
```

### 6.3 Same-material skip optimization

Before computing the mask for a cell, the system checks whether it can be skipped. A cell is skipped if ALL of the following are true:

1. `paintedMaterialKey` is known (i.e., this is a forward paint, not an undo)
2. The cell was **not** directly painted (`!paintedCells.has(key)`)
3. The cell has the same material as what was painted (`cellTerrain === paintedMaterialKey`)
4. The cell already has `SOLID_FRAME` (frame = 1)
5. The cell's `tilesetKey` already equals `baseTsKey` (not a stale pair key)

Condition 5 is critical: a cell can have `SOLID_FRAME` via a reverse-pair transition with a transition tilesetKey. If neighbors change, it must be recalculated to get the correct `baseTsKey`.

If the cell has a transition frame (not SOLID), condition 4 fails and it is always recalculated — a new same-material neighbor may change its mask.

### 6.4 Per-cell decision logic

For each cell in the recalc set:

**Step 1: Empty terrain**
```
if (!cellTerrain) → frame = EMPTY_FRAME (0), tilesetKey = ''
```

**Step 2: Base tileset lookup**
```
mat = materials.get(cellTerrain)
baseTsKey = mat?.baseTilesetKey ?? ''
```

**Step 3: Compute same-material mask**
```
mask = computeNeighborMaskByMaterial(grid, cx, cy, width, height, cellTerrain)
```

**Step 4: Solid case (mask = 255)**
```
if mask === 255:
  tilesetKey = baseTsKey
  frame = getFrame(255) = 1 (SOLID_FRAME)
```

**Step 5: Transition case (mask < 255)**

Find the dominant foreign neighbor:
```
target = findDominantNeighbor(grid, cx, cy, width, height, cellTerrain)
```

If no foreign neighbor is found (unusual — mask < 255 but all non-matching are empty):
```
tilesetKey = baseTsKey
frame = getFrame(mask)
```

If a target is found, compute the target-specific transition mask:
```
tMask = computeTransitionMask(grid, cx, cy, width, height, target)
```

Then look up the tileset pair (priority order):

1. **Forward pair** (`cellTerrain:target` exists in pairMap):
   ```
   tilesetKey = pairMap.get(`${cellTerrain}:${target}`)
   frame = getFrame(tMask)
   ```

2. **Reverse pair** (`target:cellTerrain` exists in pairMap):
   ```
   tilesetKey = pairMap.get(`${target}:${cellTerrain}`)
   frame = getFrame((~tMask) & 0xFF)   // invert the mask
   ```
   Mask inversion works because the transition tileset is authored from the other material's perspective.

3. **Indirect pair** (no direct pair; `findIndirectTileset` finds a 2-hop path):
   ```
   tilesetKey = indirect.key
   frame = indirect.reverse ? getFrame((~tMask) & 0xFF) : getFrame(tMask)
   ```

4. **Fallback** (no tileset found at all):
   ```
   tilesetKey = baseTsKey
   frame = getFrame(tMask)
   ```

---

## 7. Transition Tileset Resolution

### 7.1 Data model

A `TilesetInfo` describes a tileset:

```typescript
interface TilesetInfo {
  key: string;             // unique tileset key e.g. "terrain-03"
  name: string;            // human-readable name e.g. "water_grass"
  fromMaterialKey?: string; // e.g. "grass"
  toMaterialKey?: string;   // e.g. "deep_water"
}
```

- **Standalone tileset**: Only `fromMaterialKey` is set (no `toMaterialKey`). Used as the base tileset for that material. Every material should have one.
- **Transition tileset**: Both `fromMaterialKey` and `toMaterialKey` are set. Used for the visual border between two specific materials. Only one direction needs to exist; the reverse is handled by mask inversion.

### 7.2 pairMap construction

`buildTilesetPairMap` scans all tilesets and builds:

```
"fromMaterialKey:toMaterialKey" → tilesetKey
```

Only tilesets with both keys are included. The first entry wins for duplicate pairs.

### 7.3 Forward and reverse pair lookup

Given a cell with material `A` bordering dominant neighbor `B`:

- **Forward**: Look up `A:B` in pairMap. If found, use that tileset with the transition mask as-is.
- **Reverse**: Look up `B:A` in pairMap. If found, use that tileset with the **inverted** transition mask (`~tMask & 0xFF`).

The reverse pair approach means you only need to create a transition tileset in one direction. The system handles both sides symmetrically through mask inversion.

**Why inverted mask works:** If a tileset is authored as `grass:deep_water` (grass cells showing their transition into deep_water), then when a deep_water cell needs to render its border with grass, it uses the same tileset but shows the complementary frames — the bits that were "open toward deep_water" become "open toward grass".

### 7.4 Indirect (2-hop) pair lookup

When no direct pair `A:B` or `B:A` exists, `findIndirectTileset` searches for a tileset that connects `A` to `B` through an intermediate material `M`. Two search paths are tried:

**Path 1 — tileset starts from A** (`ts.fromMaterialKey === cellMaterial`):
- Intermediate = `ts.toMaterialKey`
- If `intermediate:B` or `B:intermediate` exists in pairMap → return `{ key: ts.key, reverse: false }`
- Frame uses the transition mask as-is

**Path 2 — tileset ends at A** (`ts.toMaterialKey === cellMaterial`):
- Intermediate = `ts.fromMaterialKey`
- If `intermediate:B` or `B:intermediate` exists in pairMap → return `{ key: ts.key, reverse: true }`
- Frame uses the **inverted** mask (`~tMask & 0xFF`), identical to how a reverse direct pair is handled

Path 1 is tried first for all tilesets; Path 2 is tried only if Path 1 finds no match.

**Visual result:** The seam between A and B shows material M from both sides, creating a gradual multi-step transition rather than an abrupt cut.

**Example (Path 1):**
```
deep_water — (no direct tileset) — grass
  Indirect: deep_water:water exists + water:grass exists
  deep_water cell → uses deep_water:water tileset (Path 1, reverse: false)
  grass cell     → uses water:grass tileset
  Visible seam:  water appears on both sides of the edge
```

**Example (Path 2):**
```
Cell material = sand, target = deep_water
  No tileset with fromMaterialKey = sand found
  But tileset water:sand exists (toMaterialKey = sand)
  Intermediate = water, and deep_water:water exists in pairMap
  → uses water:sand tileset with reverse: true (inverted mask)
```

### 7.5 Dominant neighbor selection

`findDominantNeighbor` scans the 8 neighbors, counts occurrences of each foreign material (ignoring same material and empty cells), and returns the material with the highest count. In a tie, the first-encountered wins.

This ensures that on a complex boundary — e.g., a `deep_sand` cell bordered by 5 `deep_water` and 1 `sand` — the system picks `deep_water` as the dominant neighbor and shows the `deep_water:deep_sand` transition, ignoring the minor `sand` influence. The `sand` side gets bit=1 in the transition mask (treated as solid from the deep_water perspective).

---

## 8. Commands and State Flow

### 8.1 Paint flow (forward)

```
User paints cell(s)
  → PaintCommand(deltas) created
  → PaintCommand.execute(state) called
    → applyDeltas(state, deltas, 'forward')
      1. Shallow-copy grid rows
      2. Shallow-copy layer frames + tilesetKeys
      3. Apply delta: set grid[y][x].terrain = delta.newTerrain
      4. Apply delta: set layer.frames[y][x] = delta.newFrame
      5. Build paintedCells set (all directly painted "x,y" keys)
      6. recomputeAutotileLayers(newGrid, newLayers, affectedCells, materials, paintedCells, tilesets)
      7. recomputeWalkability(newGrid, ...)
    → return new state
```

### 8.2 Undo flow (backward)

```
User presses Undo
  → PaintCommand.undo(state) called
    → applyDeltas(state, deltas, 'backward')
      1. Apply delta: set grid[y][x].terrain = delta.oldTerrain
      2. Apply delta: set layer.frames[y][x] = delta.oldFrame
      3. paintedCells = undefined  (full recalc, no skip optimization)
      4. recomputeAutotileLayers(...)
      5. recomputeWalkability(...)
```

Key difference: on undo, `paintedCells` is `undefined`, so the skip optimization is disabled. Every cell in the recalc window is fully recomputed.

### 8.3 FillCommand

Structurally identical to `PaintCommand`. The difference is only semantic (description string) and how the deltas are produced (flood fill algorithm produces more deltas covering a contiguous region). The undo/redo and autotile recompute path is identical.

### 8.4 CellDelta structure

```typescript
interface CellDelta {
  layerIndex: number;
  x: number;
  y: number;
  oldTerrain: string;
  newTerrain: string;
  oldFrame: number;
  newFrame: number;
}
```

The stored `oldFrame` and `newFrame` are used only for direct application during undo/redo; the autotile recompute overwrites them with the correctly computed values.

---

## 9. State Structure

### 9.1 MapEditorState

The central state object:

```typescript
interface MapEditorState {
  grid: Cell[][];          // [y][x] — each cell has .terrain string
  layers: EditorLayer[];   // ordered list of layers (bottom to top)
  tilesets: TilesetInfo[]; // all available tilesets
  materials: Map<string, MaterialInfo>; // key → material descriptor
  walkable: boolean[][];   // [y][x] — computed from materials
  activeLayerIndex: number;
  // ... editor UI state, undo/redo stacks, etc.
}
```

### 9.2 EditorLayer

```typescript
interface EditorLayer {
  id: string;
  name: string;
  terrainKey: string;    // legacy — identifies which material this layer displays
  visible: boolean;
  opacity: number;
  frames: number[][];    // [y][x] — autotile frame index (0-47)
  tilesetKeys?: string[][]; // [y][x] — which tileset spritesheet to use per cell
}
```

`frames` and `tilesetKeys` are parallel 2D arrays with the same dimensions as the map.

### 9.3 MaterialInfo

```typescript
interface MaterialInfo {
  key: string;            // material identifier, e.g. "grass"
  color: string;          // hex fallback color "#2d6a4f"
  walkable: boolean;
  renderPriority: number; // higher = rendered on top (not used by autotile)
  baseTilesetKey?: string; // tileset key for interior cells
}
```

`baseTilesetKey` points to the standalone tileset for this material. It is used as the tilesetKey for fully solid cells (mask=255) and as the fallback when no transition tileset is found.

---

## 10. Rendering

### 10.1 Canvas renderer lookup chain

For each visible cell `(x, y)` in every visible layer:

```typescript
const frame = layer.frames[y][x];
if (frame === EMPTY_FRAME) continue; // skip empty

const cellTerrain = state.grid[y][x]?.terrain;
const matInfo = cellTerrain ? state.materials.get(cellTerrain) : undefined;
const tilesetKey =
  layer.tilesetKeys?.[y]?.[x]  // per-cell pair key (transition cells)
  || matInfo?.baseTilesetKey    // material's base tileset (solid cells)
  || layer.terrainKey;          // last-resort legacy fallback

const img = tilesetImages.get(tilesetKey);
if (!img) continue; // tileset image not loaded
```

Priority order for tilesetKey:
1. `layer.tilesetKeys[y][x]` — set by autotile recompute for transition cells
2. `matInfo.baseTilesetKey` — set by material configuration
3. `layer.terrainKey` — legacy fallback for layers without per-cell keys

### 10.2 Frame → spritesheet coordinates

```typescript
const TILESET_COLS = 12;  // FRAMES_PER_TERRAIN (48) / 4 rows
const TILE_PX = 16;       // source tile size in pixels

const srcX = (frame % TILESET_COLS) * TILE_PX;
const srcY = Math.floor(frame / TILESET_COLS) * TILE_PX;
```

### 10.3 Viewport culling

The renderer computes `startX/Y` and `endX/Y` from the camera position and canvas dimensions before the render loop. Only cells within the visible viewport are drawn. This is critical for large maps (256x256 = 65,536 cells).

### 10.4 Layer stacking

Layers are rendered in array order (index 0 = bottom, last = top). Each layer's `opacity` is applied via `ctx.globalAlpha`. Object layers render placed game objects using their sprite data rather than the autotile frame system.

---

## 11. Edge Cases and Special Handling

### 11.1 Empty terrain

A cell with `terrain = ''` or `terrain = undefined` gets:
- `frame = EMPTY_FRAME (0)`
- `tilesetKey = ''`

The renderer skips all cells where `frame === EMPTY_FRAME`, so empty cells are transparent.

### 11.2 Out-of-bounds at map edges

By default (`outOfBoundsMatches = true`), neighbors outside the map boundary are treated as matching. This means cells at the map edge appear fully connected in the directions facing outside the map. An edge cell of all-grass terrain on a uniform map would get `SOLID_FRAME` even though its north neighbor is OOB.

### 11.3 Multi-foreign-material cells (tunnel artifact prevention)

When a cell borders two or more different foreign materials simultaneously, naive mask computation would show transitions on all sides toward all foreign materials. This creates a visual "tunnel" artifact.

The system prevents this with `computeTransitionMask`:
- Identify the dominant foreign neighbor (most common foreign material)
- Use `computeTransitionMask(target = dominantNeighbor)` instead of `computeNeighborMaskByMaterial`
- Non-dominant foreign neighbors get bit=1 in the transition mask (treated as solid, no transition drawn toward them)

Only the single dominant transition is shown; the cell's relationship with non-dominant foreign materials is rendered as if those sides are solid.

### 11.4 Inverted mask for reverse pairs

When using a reverse pair (`B:A` to render cell of material A):
```
frame = getFrame((~tMask) & 0xFF)
```

The mask is bitwise-inverted before gating. A transition mask where bit=0 means "open toward target" becomes, when inverted, a mask where bit=1 means "open toward target" — matching the perspective of the reverse tileset.

**Concrete example:**
```
Cell: sand (isolated, mask=0 for same-material)
Target: deep_sand (all 8 neighbors are deep_sand)
tMask = computeTransitionMask(target=deep_sand) = 0 (all neighbors ARE target → all bits 0)
No forward pair sand:deep_sand exists.
Reverse pair deep_sand:sand exists (ds-s).
inverted tMask = ~0 & 0xFF = 255
frame = getFrame(255) = SOLID_FRAME (1)
```

The sand cell in the center of deep_sand renders as solid, but using the transition tileset sampled at frame 1. This is the correct behavior: from the deep_sand tileset's perspective, the sand cell is a fully interior deep_sand cell.

### 11.5 Missing tileset image

If `tilesetImages.get(tilesetKey)` returns `undefined` in the renderer (image not loaded or wrong key), the cell is skipped silently. No error is thrown.

### 11.6 Object layers

`recomputeAutotileLayers` skips layers where `layer.frames` is absent (i.e., object layers). The check is:
```typescript
if (!layer.frames) return layer; // same reference, no copy
```

Object layers are not affected by autotile recomputation.

### 11.7 Disabled Solid Block Rule

A commented-out optimization previously forced directly-painted cells to `SOLID_FRAME` immediately (before mask computation), to avoid a transitional flash. This is now disabled — all cells compute their mask normally, including cells that were just painted. The skip optimization for same-material SOLID neighbors compensates for performance without sacrificing correctness.

---

## 12. The 47 Valid Blob Masks (Complete List)

For reference and tooling, `autotile.ts` exports `VALID_BLOB47_MASKS` — the 47 valid gated mask values in ascending order:

```typescript
const VALID_BLOB47_MASKS = [
  0, 1, 4, 5, 7,
  16, 17, 20, 21, 23,
  28, 29, 31,
  64, 65, 68, 69, 71,
  80, 81, 84, 85, 87,
  92, 93, 95,
  112, 113, 116, 117, 119,
  124, 125, 127,
  193, 197, 199,
  209, 213, 215,
  221, 223,
  241, 245, 247, 253, 255,
];
```

By construction, `gateDiagonals()` always produces a value that is in this list — every possible 8-bit combination gates to one of the 47 valid masks. For example, raw mask 3 (`N + NE`, no other bits) gates to 1 (`N` only, since `NE` requires both `N` and `E`), which yields frame 45 (dead-end N). The table's default fill of `ISOLATED_FRAME` serves as a safety net for table slots corresponding to non-valid mask values, which can only be reached if the table were ever accessed without going through `gateDiagonals()` — which `getFrame()` prevents.

---

## 13. Public API (packages/map-lib exports)

All autotile functionality is exported through `packages/map-lib/src/index.ts`:

**Core engine:**
```typescript
// Bit constants
export { N, NE, E, SE, S, SW, W, NW } from './core/autotile';
// Frame constants
export { FRAMES_PER_TERRAIN, SOLID_FRAME, ISOLATED_FRAME, EMPTY_FRAME } from './core/autotile';
// Frame computation
export { getFrame, gateDiagonals, VALID_BLOB47_MASKS } from './core/autotile';
```

**Neighbor masks:**
```typescript
export { NEIGHBOR_OFFSETS, computeNeighborMask, computeNeighborMaskByMaterial, computeTransitionMask } from './core/neighbor-mask';
export type { NeighborMaskOptions } from './core/neighbor-mask';
```

**Layer recompute:**
```typescript
export { recomputeAutotileLayers } from './core/autotile-layers';
```

**Commands:**
```typescript
export { applyDeltas, PaintCommand, FillCommand } from './core/commands';
```

**Material resolver:**
```typescript
export { buildTransitionMap, resolvePaint } from './core/material-resolver';
```

**Types:**
```typescript
export type { TilesetInfo, MaterialInfo } from './types/material-types';
export type { EditorLayer, MapEditorState, CellDelta, EditorCommand, /* … */ } from './types/editor-types';
```

---

## 14. Data Flow Diagram

```
User paint action
  │
  ▼
resolvePaint()                    [material-resolver.ts]
  validates materialKey
  sets grid[y][x].terrain
  returns affectedCells (cell + 8 neighbors)
  │
  ▼
PaintCommand / FillCommand        [commands.ts]
  creates CellDelta[]
  calls applyDeltas()
  │
  ▼
applyDeltas()                     [commands.ts]
  applies terrain to newGrid
  builds paintedCells set
  calls recomputeAutotileLayers()
  calls recomputeWalkability()
  │
  ▼
recomputeAutotileLayers()         [autotile-layers.ts]
  expands affected cells → recalcSet (cell + all 8 neighbors each)
  for each cell in recalcSet:
    if empty → EMPTY_FRAME, done
    if skip optimization applies → skip
    compute mask via computeNeighborMaskByMaterial()
    if mask=255 → SOLID_FRAME + baseTsKey
    else:
      findDominantNeighbor()
      computeTransitionMask(target)
      lookup pairMap: forward → reverse → indirect → fallback
      getFrame(tMask or ~tMask)
  returns new layers[]
  │
  ▼
State update
  grid, layers (frames + tilesetKeys), walkable all updated
  │
  ▼
renderMapCanvas()                 [canvas-renderer.ts]
  for each visible cell in each visible layer:
    read frame from layer.frames[y][x]
    if EMPTY_FRAME → skip
    resolve tilesetKey: per-cell → baseTilesetKey → terrainKey fallback
    load img from tilesetImages map
    compute srcX, srcY from frame number
    ctx.drawImage(img, srcX, srcY, 16, 16, destX, destY, tileSize, tileSize)
```

---

## 15. Key Design Decisions and Rationale

**Single-layer material model.** All materials live in one flat grid (`Cell.terrain`). Layers are presentation artifacts for opacity/visibility stacking, not separate terrain planes. The autotile system computes frames for every layer regardless of `terrainKey`, using actual cell terrain data.

**Material string comparison (not tileset-key comparison).** The active mask function (`computeNeighborMaskByMaterial`) compares raw material string equality. No tileset lookup is involved in mask computation. This allows one layer to contain multiple materials.

**Dominant-neighbor single-transition principle.** Each cell shows at most one transition at a time — toward the dominant foreign neighbor. This keeps the visual result predictable and avoids complex multi-way blending.

**Reverse pair with mask inversion.** Transition tilesets only need to be created in one direction. The system automatically handles the reverse direction by inverting the mask bits. This halves the required number of transition tileset assets.

**Indirect (2-hop) resolution.** Rather than requiring every material pair to have a direct transition tileset, the system finds visual solutions using intermediate materials. The seam shows the intermediate material from both sides, which is often visually correct (e.g., deep_water and grass separated by shallow water).

**Immutability throughout.** All state updates return new arrays/objects; original inputs are never mutated. This is required for React state compatibility and undo/redo correctness.

**Per-cell tilesetKey storage.** The `layer.tilesetKeys[y][x]` parallel array stores the resolved tileset key for every cell. This avoids re-running tileset resolution at render time — the renderer reads it directly.
