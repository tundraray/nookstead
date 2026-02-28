# Autotile Routing Pipeline — Automatic Tile Transition Selection for 2D Maps

## The Problem

Imagine a 2D map editor: the user paints with materials — grass, water, sand, stone. At boundaries between them, you need **smooth transitions** — not just a hard cut "grass | water", but beautiful smooth edges, corners, and corridors.

This is what **autotiling** does — a system that automatically selects the right sprite frame based on the cell's neighborhood.

But classic autotiling only handles **one** transition type (material present / absent). What if you have 10+ materials and not every pair has a dedicated transition spritesheet? How do you visually connect sand to water when you only have `sand→dirt` and `dirt→water`?

---

## The Solution: Material Routing

The idea: treat materials as **nodes in a graph** and transition tilesets as **edges**. Then "how to visually connect two materials" becomes a **shortest path** problem.

---

## The 5-Step Pipeline

### Step 1 — Tileset Registry

**What it is.** A centralized, immutable index of all available tilesets. Each tileset declares a pair of materials it can render a transition for: foreground (FG) on top of background (BG). For example:

- `grass_dirt` — grass on a dirt background (transition tileset)
- `dirt_water` — dirt on a water background (transition tileset)
- `grass` (standalone) — grass with no transition, solid fill (base tileset)

If tileset `A_B` doesn't exist but `B_A` does, it's used in **reverse orientation** (mirrored). The registry handles this internally: when asked "can you render grass on water?", it checks both `grass_water` (direct) and `water_grass` (reverse) and returns the first hit along with the orientation flag.

**Why it's needed.** Every downstream step needs fast answers to questions like "does a tileset exist for this pair?", "what's the base tileset for this material?", "give me all known transition pairs." The registry resolves each of these in O(1) via prebuilt hash maps, so the rest of the pipeline never needs to scan the raw tileset array again.

### Step 2 — Compatibility Graph Construction

![Compatibility Graph Construction](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/hmap6wi0o4wac16q5qaw.png)

**What it is.** An **undirected graph** built from the registry. Nodes are materials. An edge A↔B exists if a tileset for the pair A_B or B_A is registered (in any orientation). A second, **directed graph** is also built: edge A→B exists only if the direct tileset A_B exists.

**Why it's needed.** The graph is the input for the routing algorithm in the next step. Without it, we'd have no way to discover multi-hop connections between materials. The undirected graph tells us "which materials can visually transition to each other, directly or through intermediaries." The directed graph is used later for rendering decisions — knowing whether a tileset is direct or reverse matters for correct sprite orientation.

**Example.** Given tilesets `grass_dirt`, `dirt_water`, and `sand_dirt`, the compatibility graph contains edges: grass↔dirt, dirt↔water, sand↔dirt. There's no direct edge grass↔water or sand↔water, but paths exist through dirt.

### Step 3 — BFS Routing (All-Pairs)

**What it is.** A classic **Breadth-First Search from every node** over the compatibility graph — an all-pairs shortest path algorithm. For each pair of materials (A, B), the result is stored in a routing table as `nextHop(A, B)` — the first material on the shortest path from A to B.

> `nextHop(sand, water) → dirt`

This means: "to visually connect sand to water, the first step is dirt — so use the `sand_dirt` tileset at this boundary."

When multiple shortest paths of equal length exist, tie-breaking uses a configurable **preference array** (e.g., prefer dirt over stone as an intermediate). This guarantees deterministic, artist-controllable results.

**Why it's needed.** This is the core insight of the entire pipeline. Classic autotiling requires a dedicated spritesheet for every pair of adjacent materials. With M materials, that's up to M×(M−1)/2 spritesheets — a combinatorial explosion. The routing table eliminates this: artists only need to draw tilesets for **direct neighbors** in the graph, and the system automatically chains multi-hop transitions for distant materials.

**Why BFS specifically?** BFS finds the shortest path in an unweighted graph, which maps directly to our goal: minimize the number of intermediate materials in a visual transition chain. It runs in O(V + E) per source, O(V × (V + E)) total — fast enough for the typical 10–30 materials in a game.

### Step 4 — Edge Ownership Resolution

![Edge Ownership Resolution](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/lo1hdg4x2axfjowk28ai.png)

**What it is.** For each **cardinal boundary** (N/E/S/W) between two cells with different materials, the algorithm determines which cell "owns" the transition — i.e., which cell is responsible for drawing the boundary sprite.

The resolution algorithm:

1. **Compute virtual backgrounds.** Both sides query the routing table: cell A computes `nextHop(A_material, B_material)`, cell B computes `nextHop(B_material, A_material)`.
2. **Check tileset availability.** Each candidate is valid only if `registry.resolvePair(material, virtualBG)` returns a result.
3. **Resolve conflicts.** If only one side has a valid tileset — that side wins ownership by default. If both sides are valid — the material with the **higher priority** wins (priority is an artist-configured number). If priorities are equal — **lexicographic order** on material keys serves as a deterministic tiebreaker so the result is identical regardless of which cell queries.

**Why it's needed.** Without ownership, both cells would try to draw the same boundary — resulting in double-rendered edges, z-fighting, or visual seams. Exactly one cell must take responsibility for each edge. Ownership also feeds into the Blob-47 mask computation in the next step: a cell's mask bits are adjusted based on which edges it owns, preventing incorrect corner patterns at transition boundaries.

### Step 5 — Blob-47 Autotiling

Now we need to turn the routing decisions into an actual sprite frame. This is where **Blob-47** comes in — an autotile technique for square-grid tilemaps that determines which sprite to draw based on **which of a cell's 8 neighbors share the same terrain**. It's called "47" because exactly **47 unique tile configurations** exist after applying diagonal gating rules.

#### The 8-Neighbor Bitmask

Each cell examines all 8 neighbors and builds an **8-bit mask** using these weights:

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/odxx4p6c5mflbftgo9jc.png)


If a neighbor has the same terrain, its bit is set to 1. Otherwise, 0.

For example, if a grass cell has grass neighbors to the North, East, and Northeast, the raw mask is:

```
N(1) + NE(2) + E(4) = 7
```

**Why a bitmask?** It encodes all 256 possible 8-neighbor combinations into a single integer, enabling O(1) lookup into a precomputed frame table. No conditionals, no branching — just a table index.

#### Diagonal Gating

Here's the key insight: **a diagonal neighbor only matters if both adjacent cardinals are also present**. Without this rule, you'd get visual artifacts — a corner tile drawn where there's no actual corner.

Consider a cell with grass to the North and Northeast, but not to the East. Drawing a NE corner here is wrong — there's no actual enclosed corner, just two separate edges. Diagonal gating prevents this by clearing the NE bit whenever N or E is absent.

The gating rules:
- **NE** counts only if both **N** and **E** are set
- **SE** counts only if both **S** and **E** are set
- **SW** counts only if both **S** and **W** are set
- **NW** counts only if both **N** and **W** are set

```
gated_mask = keep only cardinal bits (N, E, S, W)
if N and E are set and NE was set → add NE
if S and E are set and SE was set → add SE
if S and W are set and SW was set → add SW
if N and W are set and NW was set → add NW
```

This reduces the 256 possible raw masks down to exactly **47 valid configurations**.

**Why exactly 47?** There are 4 cardinal bits (2⁴ = 16 cardinal combinations). For each cardinal combination, only the diagonals adjacent to two present cardinals can vary. The math works out to exactly 47 valid gated masks — every other one is impossible under gating.

#### The 47 Configurations

The 47 valid masks map to specific tile shapes:

| Frame Range | Shape | Description |
|-------------|-------|-------------|
| 1 | Solid | All 8 neighbors present |
| 2–16 | Center variants | All 4 cardinals present, different corner combinations |
| 17–20 | T-junction open West | N+E+S present, W absent, corner variants |
| 21–24 | T-junction open North | E+S+W present, N absent, corner variants |
| 25–28 | T-junction open East | N+S+W present, E absent, corner variants |
| 29–32 | T-junction open South | N+E+W present, S absent, corner variants |
| 33–34 | Corridors | Vertical (N+S) or Horizontal (E+W) |
| 35–42 | L-corners | Two adjacent cardinals, with/without filled corner |
| 43–46 | Dead-ends | Only one cardinal neighbor |
| 47 | Isolated | No neighbors at all |

#### Frame Table Lookup

Instead of computing the frame at runtime with conditionals, a **256-entry lookup table** is prebuilt at load time:

```
FRAME_TABLE[gated_mask] → frame index (0–47)
```

Frame 0 is reserved for "empty" (no terrain). Frames 1–47 correspond to the autotile variants. Any invalid mask maps to the isolated frame (47) as a fallback.

The full computation for a single cell is:

```
raw_mask = scan 8 neighbors, set bits for matching terrain
gated_mask = apply diagonal gating
frame = FRAME_TABLE[gated_mask]
```

This is **O(1)** per cell — just a bitmask build + a single array lookup.

**Why a lookup table instead of if/else chains?** With 47 unique cases, hand-coding conditional logic would be error-prone and slow. A 256-byte table is trivial to precompute, fits in L1 cache, and reduces frame resolution to a single memory access.

#### Spritesheet Layout

Each terrain's spritesheet is a grid of **12 columns × 4 rows = 48 frames**:

```
Frame 0  = empty/transparent
Frame 1  = solid (all neighbors)
Frame 2  = missing NW corner
...
Frame 47 = isolated (no neighbors)
```

The ordering goes from **most connected** (solid, frame 1) to **least connected** (isolated, frame 47). This convention is shared across all terrain types, so artists always know which frame corresponds to which shape.

#### Out-of-Bounds Handling

Cells at map edges have fewer than 8 neighbors. Two strategies:
- **Out-of-bounds = matching** (default): map edges appear seamless, as if terrain continues beyond the border
- **Out-of-bounds = not matching**: map edges show explicit borders (island-style)

The choice is a single boolean flag on the mask computation — no extra logic needed.

#### Why Not Blob-255?

Blob-255 uses all 256 possible masks without diagonal gating, requiring 256 sprites per terrain. Blob-47 achieves nearly identical visual quality with **6× fewer sprites** — a significant reduction in art production effort. The diagonal gating rule eliminates configurations that would be visually indistinguishable or incorrect anyway.

#### Transition Mode Extension

Everything described above works for a single terrain type ("same material or not"). The routing pipeline extends it for **multi-material transitions**:

- **Base mode** (no transition): the mask checks whether each neighbor is the same FG material
- **Transition mode** (selected BG via routing): the mask is built relative to the **virtual background** material. Additionally, **ownership gating** overrides cardinal bits based on which cell owns each boundary edge (from Step 4)

This means the same Blob-47 frame table is reused for both plain terrain fills and complex routed transitions — only the mask computation changes.

**Why this matters.** Reusing the same 47-frame spritesheet for both base terrain and routed transitions means zero additional art assets for multi-material support. The entire multi-material complexity is handled purely in code at the mask level.

---

## Repaint Optimization

![Repaint Optimization](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/82e52q06zz1vtp6ozpdp.png)

When a single cell changes, there's no need to recompute the entire map. The system uses **smart dirty propagation**:

**1. Chebyshev R=2 expansion.** When a cell changes, a 5×5 square around it is marked dirty. Why R=2 and not R=1? Because diagonal gating means a cell's frame depends on its neighbors' neighbors. If cell X changes, its neighbor Y's mask changes, and Y's diagonal neighbor Z might also be affected via Y's cardinal relationship with Z. Two hops in Chebyshev distance covers the full influence radius.

**2. Edge stability classification.** Not all dirty cells actually need redrawing. Each cardinal boundary gets a stability class:
   - **C1** — same material (always stable — nothing to redraw)
   - **C2** — symmetric direct pair; both sides have direct tilesets (stable)
   - **C3** — pair through a common intermediate hop; both sides direct (stable)
   - **C4** — both resolved but routing may change on neighbor edit (unstable)
   - **C5** — at least one side has no route (invalid)

**Why classify?** The stability class drives the **selective commit** policy: only cells near stable edges (C1/C2/C3) are committed. C4/C5 neighbors are left untouched — their cached visual state is preserved. This prevents "ripple" artifacts where editing one cell causes a cascade of visual changes across the map through unstable routing chains.

**3. Selective commit.** From the dirty set, only these are actually redrawn:
   - The changed cell itself (always)
   - Cardinal neighbors with C1/C2/C3 edges
   - Diagonal neighbors, but only if both adjacent cardinals are stable
   - C4/C5 neighbors are **left untouched** — their visual state is preserved from cache

**4. Per-cell cache.** Each cell stores its last computation result: selected tileset key, render tileset key, frame index, virtual background, and orientation. Reverse indices (tileset key → set of cells) enable instant lookup when a tileset is updated or removed — no full-map scan needed.

---

## Complexity Summary

| Component | Complexity | Purpose |
|-----------|-----------|---------| 
| Registry | O(T) | Index T tilesets into hash maps |
| Graph | O(T) | Build adjacency from T pairs |
| BFS Router | O(M² · E) | All-pairs shortest path for M materials |
| Edge Resolution | O(1) per edge | Determine boundary owner per cardinal |
| Blob-47 | O(1) per cell | Lookup table `mask → frame` |
| Dirty propagation | O(changed × 25) | Chebyshev 5×5 per changed cell |

The entire pipeline exists for one thing: **the user just paints with a brush, and the system picks the correct transition tiles in real time — even for materials that have no direct tileset between them** — via routing through intermediate materials.
