# Fence System Mechanics Architecture

## Overview

This document defines the mechanics architecture for the Nookstead fence system. Fences are connectable grid structures that use a 4-cardinal autotile engine to automatically select the correct sprite variant based on adjacent same-type neighbors. The system supports multiple fence visual styles loaded from the database, gate functionality with open/closed state, and rendering via RenderTexture stamping in both the GenMap editor and the Phaser game client.

**Related Documents:**
- **ADR-0010:** `docs/adr/ADR-0010-fence-system-architecture.md` -- Architecture decision for dedicated fence layer with 4-cardinal autotile
- **ADR-0009:** `docs/adr/ADR-0009-tileset-management-architecture.md` -- DB-driven tileset direction that fence types follow

## Design Summary (Meta)

```yaml
design_type: "new_feature"
risk_level: "medium"
complexity_level: "medium"
complexity_rationale: >
  The fence system introduces a new 4-cardinal autotile engine (simpler than
  existing Blob-47), a new fence layer type in the editor state model, virtual
  tileset generation from atlas frames, gate state management, and walkability
  grid integration. The rendering approach (RenderTexture stamping) reuses the
  proven terrain pattern, reducing rendering risk. The 4-cardinal engine is a
  16-entry lookup vs Blob-47's 256-entry table, making it straightforward to
  implement and verify.
main_constraints:
  - "16x16 tile grid on all maps (TILE_SIZE = 16, FRAME_SIZE = 16)"
  - "Maps can be 60x60+ tiles; fence rendering must match terrain performance"
  - "Fence sprites are individual atlas frames, not pre-assembled tilesets"
  - "Virtual tileset composed at load time from 16 atlas frames per fence type"
  - "Backward compatible: existing maps without fences continue to work"
  - "Gate frames limited to 4 variants (vertical/horizontal x open/closed)"
biggest_risks:
  - "Virtual tileset generation latency on maps with many fence types"
  - "Gate placement validation edge cases at corners and T-junctions"
  - "Walkability grid consistency during bulk fence operations"
unknowns:
  - "Whether 4-cardinal connectivity suffices for all desired fence aesthetics"
  - "Optimal UX for gate interaction in the game client (proximity, key binding)"
```

---

## 1. 4-Cardinal Connection Engine

### 1.1 Cardinal Direction Bitmask

The fence connection engine uses a 4-bit bitmask encoding the presence of same-type neighbors in each cardinal direction. This is distinct from the terrain autotile engine (which uses an 8-bit bitmask with diagonal gating).

| Bit | Direction | Value | Binary |
|-----|-----------|-------|--------|
| 0   | North     | 1     | 0001   |
| 1   | East      | 2     | 0010   |
| 2   | South     | 4     | 0100   |
| 3   | West      | 8     | 1000   |

The bitmask range is 0-15 (2^4 = 16 possible states).

**Relationship to terrain autotile constants:** The terrain system (`autotile.ts`) uses N=1, E=4, S=16, W=64 with diagonal bits interleaved. The fence system uses a compact N=1, E=2, S=4, W=8 encoding with no gaps between bits. These are intentionally different encodings optimized for their respective use cases. The fence constants are defined in their own module and do not reference or conflict with the terrain constants.

### 1.2 Canonical Frame Table (16 States)

The bitmask value directly serves as the frame index within the virtual tileset. No lookup table is needed at the mathematical level -- the mapping is identity: `frameIndex = bitmask`. However, the frame values stored in the fence layer data grid are offset by +1 to reserve 0 as the EMPTY_FRAME sentinel (consistent with the terrain system convention).

| Bitmask | Binary | Frame Index | Configuration | Visual Description |
|---------|--------|-------------|---------------|-------------------|
| 0       | 0000   | 1           | Isolated      | Single post, no connections |
| 1       | 0001   | 2           | Dead-end N    | Segment extending north only |
| 2       | 0010   | 3           | Dead-end E    | Segment extending east only |
| 3       | 0011   | 4           | L-corner NE   | Corner connecting north and east |
| 4       | 0100   | 5           | Dead-end S    | Segment extending south only |
| 5       | 0101   | 6           | Corridor NS   | Vertical run (north-south) |
| 6       | 0110   | 7           | L-corner SE   | Corner connecting south and east |
| 7       | 0111   | 8           | T-junction (open W) | Three-way, open to west |
| 8       | 1000   | 9           | Dead-end W    | Segment extending west only |
| 9       | 1001   | 10          | L-corner NW   | Corner connecting north and west |
| 10      | 1010   | 11          | Corridor EW   | Horizontal run (east-west) |
| 11      | 1011   | 12          | T-junction (open S) | Three-way, open to south |
| 12      | 1100   | 13          | L-corner SW   | Corner connecting south and west |
| 13      | 1101   | 14          | T-junction (open E) | Three-way, open to east |
| 14      | 1110   | 15          | T-junction (open N) | Three-way, open to north |
| 15      | 1111   | 16          | Cross         | Four-way intersection |

**Frame index formula:** `frameIndex = bitmask + 1` (0 = FENCE_EMPTY_FRAME).

**Tileset source rectangle formula** (for a 4-column virtual tileset):
```
srcX = (bitmask % 4) * 16
srcY = Math.floor(bitmask / 4) * 16
```

Where `bitmask = frameIndex - 1` for non-empty frames.

### 1.3 Connection Detection Algorithm

The pure function `computeFenceBitmask(layer, x, y)` scans the 4 cardinal neighbors of cell (x, y) and sets the corresponding bit for each neighbor that:

1. Is within map bounds (out-of-bounds = no connection)
2. Contains a fence cell (not empty)
3. Belongs to the same fence type (same `fenceTypeKey`)

**Gate participation:** Gate cells are treated identically to fence cells for connection purposes. A gate connects to adjacent fences, and fences connect to adjacent gates, provided they share the same fence type. This ensures visual continuity -- a gate in a fence run does not break the visual connections of its neighbors.

**Cross-layer interaction:** Fence cells on different layers (different fence types) do NOT connect to each other. Connection detection operates within a single fence layer. If a wooden fence and a stone fence are placed on adjacent cells but on separate layers, neither influences the other's bitmask.

**Pseudocode:**
```
FENCE_N = 1
FENCE_E = 2
FENCE_S = 4
FENCE_W = 8

function computeFenceBitmask(cells[][], x, y, mapWidth, mapHeight):
  thisCell = cells[y][x]
  if thisCell is null: return 0

  mask = 0

  // North neighbor (y - 1)
  if y > 0 AND cells[y-1][x] is not null:
    mask |= FENCE_N

  // East neighbor (x + 1)
  if x < mapWidth - 1 AND cells[y][x+1] is not null:
    mask |= FENCE_E

  // South neighbor (y + 1)
  if y < mapHeight - 1 AND cells[y+1][x] is not null:
    mask |= FENCE_S

  // West neighbor (x - 1)
  if x > 0 AND cells[y][x-1] is not null:
    mask |= FENCE_W

  return mask
```

Note: The `cells` array is scoped to a single fence layer, so all non-null cells are guaranteed to be the same fence type. No explicit type comparison is needed within the function.

### 1.4 Frame Resolution Function

The public API function `getFenceFrame(neighbors)` converts a 4-bit bitmask to a frame index suitable for rendering.

**Pseudocode:**
```
FENCE_EMPTY_FRAME = 0

function getFenceFrame(neighbors: number): number
  // neighbors is 4-bit (0-15), validated by caller
  return neighbors + 1
```

This function is deliberately trivial. The abstraction exists to:
1. Maintain API consistency with the terrain `getFrame(neighbors)` function
2. Provide a single point of change if the frame ordering convention changes
3. Encapsulate the +1 offset for empty frame reservation

### 1.5 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Cell at map boundary | Out-of-bounds directions contribute 0 (no connection) |
| Isolated fence cell (no neighbors) | Bitmask = 0, frame = 1 (isolated post sprite) |
| Adjacent different fence types | Each is on its own layer; no cross-layer connection |
| Gate next to fence (same type) | Gate and fence connect normally |
| Gate next to gate (same type) | Two adjacent gates connect normally |
| Empty cell adjacent to fence | No connection on that edge |
| All 4 neighbors present | Bitmask = 15, frame = 16 (cross sprite) |

---

## 2. Fence Placement Mechanics

### 2.1 Placement Modes

The fence tool in the GenMap editor supports three placement modes:

#### 2.1.1 Single Segment Mode

- User selects the fence tool and a fence type from the palette
- Click on any cell to place a single fence segment at that position
- If the cell is already occupied by the same fence type, the click is a no-op
- If the cell is occupied by a different fence type (on a different layer), placement is allowed (each layer is independent)

**State changes on placement:**
1. Set `cells[y][x]` to a new FenceCellData with the active fence type, `isGate = false`, `gateOpen = false`
2. Recalculate bitmask and frame for the placed cell
3. Recalculate bitmask and frame for each cardinal neighbor that is a non-empty same-layer cell
4. Update `walkable[y][x] = false` (fence segments are non-walkable)

#### 2.1.2 Rectangle Perimeter Mode (Primary Mode)

- User clicks to set one corner, drags to define a rectangle, releases to confirm
- Fence segments are placed along the perimeter of the rectangle (not filled)
- Minimum rectangle size: 2x1 or 1x2 (a line). A 1x1 rectangle degenerates to single segment placement.

**Perimeter cell determination:**

Given a rectangle from `(minX, minY)` to `(maxX, maxY)` (inclusive):

A cell `(x, y)` is on the perimeter if:
```
x == minX OR x == maxX OR y == minY OR y == maxY
```

The set of perimeter cells forms the boundary ring.

**State changes (batch):**
1. Compute the set of all perimeter cells
2. For each perimeter cell, set `cells[y][x]` to a new FenceCellData (skip cells already occupied by the same fence type)
3. Compute the set of all affected cells: all newly placed cells UNION all cardinal neighbors of newly placed cells that are non-empty same-layer cells
4. Recalculate bitmask and frame for every cell in the affected set
5. Update `walkable[y][x] = false` for all newly placed cells

**Preview rendering:** While dragging, the editor renders a semi-transparent rectangle outline showing where fences will be placed. This reuses the existing `previewRect` mechanism in the canvas renderer.

#### 2.1.3 Line Drawing Mode

- Click to set start point, click again to set end point
- The line is constrained to horizontal or vertical: if `|deltaX| >= |deltaY|`, the line is horizontal at `startY`; otherwise vertical at `startX`
- All cells along the line are filled with fence segments

**Line cell determination:**

For a horizontal line from `(x1, y)` to `(x2, y)`:
```
cells = [(x, y) for x in range(min(x1,x2), max(x1,x2)+1)]
```

For a vertical line from `(x, y1)` to `(x, y2)`:
```
cells = [(x, y) for y in range(min(y1,y2), max(y1,y2)+1)]
```

**State changes:** Same batch recalculation as rectangle perimeter mode.

### 2.2 Fence Eraser

- Eraser tool removes fence segments from the active fence layer
- Click or drag to erase cells
- On removal: set `cells[y][x] = null`, set `frames[y][x] = 0`
- Recalculate bitmask for all cardinal neighbors of the removed cell
- Revert `walkable[y][x]` to the underlying terrain's walkability value

### 2.3 Batch Bitmask Recalculation

All placement and removal operations use a shared recalculation algorithm:

**Pseudocode:**
```
function recalculateAffectedCells(layer, changedPositions[], mapWidth, mapHeight):
  // Build the set of all cells that need frame updates
  affectedSet = new Set<{x, y}>()

  for each (cx, cy) in changedPositions:
    affectedSet.add(cx, cy)

    // Each cardinal neighbor of a changed cell may also need updating
    for each (nx, ny) in [(cx, cy-1), (cx+1, cy), (cx, cy+1), (cx-1, cy)]:
      if inBounds(nx, ny, mapWidth, mapHeight) AND layer.cells[ny][nx] is not null:
        affectedSet.add(nx, ny)

  // Recalculate frame for each affected cell
  for each (ax, ay) in affectedSet:
    if layer.cells[ay][ax] is null:
      layer.frames[ay][ax] = FENCE_EMPTY_FRAME
    else:
      bitmask = computeFenceBitmask(layer.cells, ax, ay, mapWidth, mapHeight)

      // Gate invalidation: if this cell is a gate but its bitmask is no longer
      // a valid corridor (NS=5 or EW=10), revert it to a regular fence cell.
      cell = layer.cells[ay][ax]
      if cell.isGate AND bitmask != 5 AND bitmask != 10:
        cell.isGate = false
        cell.gateOpen = false

      if cell.isGate:
        layer.frames[ay][ax] = getGateFrame(bitmask, cell.gateOpen)
      else:
        layer.frames[ay][ax] = getFenceFrame(bitmask)
```

**Performance:** Each changed cell touches at most 4 neighbors. For a rectangle perimeter of N cells, the affected set is at most 5N cells (each cell plus up to 4 unique neighbors). Frame recalculation per cell is O(1) -- a constant-time bitmask computation. Total cost: O(N) for N changed cells.

### 2.4 Undo/Redo

Fence operations follow the existing editor command pattern (`EditorCommand`). Each fence operation produces a command containing:

- The set of cells that changed (positions + previous cell data + new cell data)
- The set of frame changes (positions + previous frame + new frame)
- The set of walkability changes (positions + previous value + new value)

Undo reverses all three sets. Redo reapplies them. This is consistent with the existing undo/redo architecture in `map-editor-commands.ts`.

---

## 3. Gate Mechanics

### 3.1 Gate Definition

A gate is a special fence cell with the following properties:
- Shares the visual style (atlas, sprite set) of its parent fence type
- Has its own dedicated frame set (separate from the 16 connection frames)
- Can be toggled between **open** (walkable) and **closed** (non-walkable) states
- Participates in the connection engine identically to regular fence cells

### 3.2 Gate Placement

**Action:** The user places a gate by Shift-clicking on an existing fence segment in the editor.

**Placement constraint:** Gates can only be placed on fence cells whose current bitmask represents a straight corridor:
- Bitmask 5 (0101): north-south corridor (vertical gate)
- Bitmask 10 (1010): east-west corridor (horizontal gate)

Placement on any other configuration (isolated posts, dead-ends, L-corners, T-junctions, crosses) is rejected. The rationale: gates represent openings in a fence run, which only makes visual and gameplay sense on straight segments.

**Validation pseudocode:**
```
function canPlaceGate(layer, x, y, mapWidth, mapHeight): boolean
  cell = layer.cells[y][x]
  if cell is null: return false          // no fence to convert
  if cell.isGate: return false           // already a gate
  bitmask = computeFenceBitmask(layer.cells, x, y, mapWidth, mapHeight)
  return bitmask == 5 OR bitmask == 10   // NS corridor or EW corridor
```

**State change on gate placement:**
1. Set `cells[y][x].isGate = true`
2. Set `cells[y][x].gateOpen = false` (gates start closed)
3. Recalculate the gate's display frame (see section 3.4)
4. No bitmask recalculation needed for neighbors (the cell remains a fence cell for connection purposes)
5. Walkability does not change (closed gate = non-walkable, same as fence)

### 3.3 Gate State Machine

```
         interact          interact
  CLOSED ---------> OPEN ----------> CLOSED
    |                 |
    | walkable=false  | walkable=terrain_base
    | frame=closed    | frame=open
```

**States:**

| State  | walkable | Frame Set | Collision |
|--------|----------|-----------|-----------|
| CLOSED | false    | Closed variant (matches fence visual, with gate hardware visible) | Blocks movement |
| OPEN   | terrain base | Open variant (gate swung open, passable gap) | Allows movement (if terrain is walkable) |

**Transitions:**

| From   | Trigger | To     | Side Effects |
|--------|---------|--------|-------------|
| CLOSED | Player interaction (proximity + action key) | OPEN | Update `gateOpen = true`, recompute walkability, update display frame |
| OPEN   | Player interaction (proximity + action key) | CLOSED | Update `gateOpen = false`, recompute walkability, update display frame |

**Auto-close (optional, future):** A timer-based auto-close after N game-seconds could be added. Not included in the initial implementation.

### 3.4 Gate Frame Selection

Gates use a separate frame set from the 16-state connection frames. Each fence type defines 4 gate frames:

| Key                | Description |
|--------------------|-------------|
| `vertical_closed`  | North-south gate, closed position |
| `vertical_open`    | North-south gate, open position |
| `horizontal_closed`| East-west gate, closed position |
| `horizontal_open`  | East-west gate, open position |

**Frame selection logic:**

```
function getGateFrame(bitmask, isOpen):
  if bitmask == 5:   // N+S corridor
    return isOpen ? gateFrames.vertical_open : gateFrames.vertical_closed
  if bitmask == 10:  // E+W corridor
    return isOpen ? gateFrames.horizontal_open : gateFrames.horizontal_closed
  // Should not reach here if canPlaceGate() was enforced
  return null
```

**Gate frames in the virtual tileset:** Gate frames occupy positions 17-20 in the virtual tileset (after the 16 connection frames + 1 empty frame). The tileset layout becomes:

| Frame Index | Content |
|-------------|---------|
| 0           | Empty (transparent, sentinel) |
| 1-16        | Fence connection states (bitmask 0-15) |
| 17          | Gate: vertical closed |
| 18          | Gate: vertical open |
| 19          | Gate: horizontal closed |
| 20          | Gate: horizontal open |

Virtual tileset dimensions: 4 columns x 5 rows = 64x80 pixels (20 content slots). Frame 0 (empty sentinel) is not stored in the image — it is a rendering skip. Frames 1-20 map to image positions using unified indexing.

**Source rectangle formula (unified for all frames):**
```
idx = frameIndex - 1   // 0-based into the image (skip frame 0 = empty)
srcX = (idx % 4) * 16
srcY = Math.floor(idx / 4) * 16
```

Content frames 1-16 (fence connection states) occupy rows 0-3. Gate frames 17-20 occupy row 4.

### 3.5 Gate Removal

- Shift-clicking an existing gate in the editor converts it back to a regular fence segment
- Set `cells[y][x].isGate = false`, `cells[y][x].gateOpen = false`
- Recalculate the cell's display frame using the standard fence connection table
- Update walkability to `false` (regular fence is non-walkable)

### 3.6 Runtime Gate Interaction (Game Client)

In the game client, gate toggling is a player action:

1. Player must be within interaction range (adjacent tile, 1 tile distance)
2. Player presses the interaction key (e.g., E key or click)
3. Client sends a gate toggle request to the server (Colyseus message)
4. Server validates proximity and toggles `gateOpen` state
5. Server broadcasts the state change to all clients in the room
6. Each client updates the gate's display frame and walkability grid

**Server authority:** The server is the authority on gate state. Clients do not toggle gates locally -- they request and wait for server confirmation. This prevents desync in multiplayer.

---

## 4. Fence Layer Data Model

### 4.1 Per-Cell Data Structure

Each cell in a fence layer is either empty (null) or contains:

```
FenceCellData {
  fenceTypeId: string    // UUID referencing fence_types table
  isGate: boolean        // true if this cell is a gate
  gateOpen: boolean      // true if gate is open (only meaningful when isGate = true)
}
```

This is the authoritative data. Frame indices are derived from this data plus neighbor analysis.

### 4.2 Editor Fence Layer

The editor state model gains a new layer type:

```
FenceLayer {
  id: string              // unique layer identifier
  type: 'fence'           // discriminator for the layer union type
  name: string            // display name (e.g., "Wooden Fence")
  fenceTypeKey: string    // key into fence_types table (e.g., "wooden_fence")
  visible: boolean        // layer visibility toggle
  opacity: number         // layer opacity (0.0 - 1.0)
  cells: (FenceCellData | null)[][]  // [y][x] authoritative cell data
  frames: number[][]      // [y][x] derived frame indices (0 = empty)
}
```

**Layer type union:** The editor's layer discriminated union expands:
```
EditorLayerUnion = TileLayer | ObjectLayer | FenceLayer
```

The `type` field ('tile', 'object', 'fence') discriminates the union.

### 4.3 Single Fence Type Per Layer

Each fence layer is associated with exactly one fence type (identified by `fenceTypeKey`). This mirrors the terrain layer pattern where each layer has one `terrainKey`.

**Rationale:**
- Simplifies connection detection (all non-null cells in a layer are the same type)
- Simplifies virtual tileset generation (one tileset per layer)
- Avoids complex cross-type connection rules
- Maps naturally to the rendering pipeline (one texture per layer)

**Multi-type support:** To place multiple fence types on the same map, the user adds multiple fence layers. For example:
- Layer "Wooden Fence" (fenceTypeKey: "wooden_fence")
- Layer "Stone Wall" (fenceTypeKey: "stone_wall")

Each layer is independent. Cells from different fence layers do not interact for connection purposes, even if they occupy the same grid position.

### 4.4 Layer Rendering Order

Fence layers render ABOVE terrain layers and BELOW player/NPC sprites:

```
Rendering stack (bottom to top):
1. Background color
2. Terrain layers (existing RenderTexture)
3. Fence layers (new RenderTexture, same stamping technique)
4. Player and NPC sprites (individual game objects with depth sorting)
5. UI overlays
```

If multiple fence layers exist, they render in layer order (first to last in the layers array). Fence layer ordering can be adjusted by the user in the editor's layer panel.

### 4.5 Network Serialization

For transmission via `MapDataPayload` (Colyseus):

```
SerializedFenceLayer {
  name: string
  fenceTypeKey: string
  frames: number[][]               // precomputed frame indices
  gates: SerializedGateData[]      // sparse gate positions
}

SerializedGateData {
  x: number
  y: number
  open: boolean
}
```

Extension to `MapDataPayload`:
```
MapDataPayload {
  // ... existing fields ...
  fenceLayers?: SerializedFenceLayer[]  // optional, backward compatible
}
```

**Backward compatibility:** The `fenceLayers` field is optional. Clients that do not understand fence layers safely ignore it. Maps without fences omit the field entirely.

### 4.6 Persistence (DB Storage)

Fence layer data is stored alongside other map data in the editor maps table. The existing `layers` JSONB column stores tile and object layers. Fence layers are stored in a new `fenceLayers` JSONB column on the editor maps table (or within the existing layers array with the `type: 'fence'` discriminator).

The recommended approach: store fence layers within the existing `layers` array using the `type` discriminator. This avoids schema changes to the editor maps table and aligns with how tile and object layers are already stored.

Each persisted fence layer includes:
- `type: 'fence'`
- `fenceTypeKey`
- `cells` (authoritative cell data -- sparse or dense)
- `frames` (derived, can be recomputed but stored for efficiency)

---

## 5. Collision Integration

### 5.1 Walkability Grid Relationship

The `walkable[][]` grid is the single source of truth for pathfinding and collision. It is a boolean 2D array (`[y][x]`) where `true` = walkable and `false` = blocked.

Currently, walkability is derived entirely from terrain properties. With fences, walkability becomes a composite:

```
walkable[y][x] = terrainWalkable[y][x] AND NOT blockedByFence[y][x]
```

Where `blockedByFence` is true if any fence layer has a non-walkable fence cell at (x, y).

### 5.2 Walkability Computation

**Full recomputation** (on map load or bulk operations):

```
function computeWalkability(grid, fenceLayers, mapWidth, mapHeight): boolean[][]
  walkable = new boolean[mapHeight][mapWidth]

  for y in 0..mapHeight-1:
    for x in 0..mapWidth-1:
      // Base: terrain walkability
      terrainWalkable = isWalkable(grid[y][x].terrain)

      // Override: fence layers
      fenceBlocked = false
      for each fenceLayer in fenceLayers:
        cell = fenceLayer.cells[y][x]
        if cell is not null:
          if cell.isGate AND cell.gateOpen:
            // Open gate: does not block
            continue
          else:
            // Fence segment or closed gate: blocks
            fenceBlocked = true
            break

      walkable[y][x] = terrainWalkable AND NOT fenceBlocked

  return walkable
```

### 5.3 Incremental Walkability Update

When a single cell changes (fence placed, removed, or gate toggled), only that cell's walkability needs updating:

```
function updateCellWalkability(walkable, grid, fenceLayers, x, y):
  terrainWalkable = isWalkable(grid[y][x].terrain)
  fenceBlocked = false

  for each fenceLayer in fenceLayers:
    cell = fenceLayer.cells[y][x]
    if cell is not null:
      if cell.isGate AND cell.gateOpen:
        continue
      else:
        fenceBlocked = true
        break

  walkable[y][x] = terrainWalkable AND NOT fenceBlocked
```

### 5.4 Fence Placement Walkability Updates

| Operation | Walkability Change |
|-----------|-------------------|
| Place fence segment | `walkable[y][x] = false` |
| Remove fence segment | `walkable[y][x] = terrainWalkable(grid[y][x])` (recheck other fence layers) |
| Place gate (initially closed) | `walkable[y][x] = false` (no change from fence) |
| Open gate | `walkable[y][x] = terrainWalkable(grid[y][x])` (recheck other fence layers) |
| Close gate | `walkable[y][x] = false` |
| Convert gate back to fence | `walkable[y][x] = false` (no change if gate was closed) |

**Multi-layer consideration:** When removing a fence from one layer, the cell might still be blocked by a fence on another layer. The `updateCellWalkability` function checks all fence layers, so it handles this correctly.

### 5.5 Pathfinding Integration

The player's pathfinding system (click-to-move in `Game.ts`) uses the `walkable[][]` grid. No changes to the pathfinding algorithm are needed -- it already reads the walkable grid. Fence placement and gate toggling update the grid, and the next pathfinding request automatically respects the new state.

**Runtime gate toggling:** When a gate is opened or closed during gameplay, the server updates the walkable grid and broadcasts the change. Clients update their local walkable grid. Any in-progress pathfinding that passes through the toggled cell may need recalculation, but this is handled naturally by the movement system -- the player stops when reaching a non-walkable cell.

---

## 6. Fence Type Definition

### 6.1 Database Schema

The `fence_types` table stores fence type definitions:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Primary key, auto-generated |
| `name` | VARCHAR(255) | Display name (e.g., "Wooden Fence") |
| `key` | VARCHAR(100), UNIQUE | Programmatic key (e.g., "wooden_fence") |
| `category` | VARCHAR(100) | Style grouping (e.g., "rustic", "stone", "metal") |
| `frame_mapping` | JSONB | 16-entry mapping: bitmask string key ("0"-"15") to atlas frame UUID |
| `gate_frame_mapping` | JSONB | 4-entry mapping: orientation+state key to atlas frame UUID |
| `sort_order` | INTEGER | Display order in editor palette |
| `created_at` | TIMESTAMP WITH TIME ZONE | Row creation time |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update time |

**`frame_mapping` schema:**
```json
{
  "0": "uuid-atlas-frame-isolated",
  "1": "uuid-atlas-frame-dead-end-n",
  "2": "uuid-atlas-frame-dead-end-e",
  "3": "uuid-atlas-frame-l-corner-ne",
  "4": "uuid-atlas-frame-dead-end-s",
  "5": "uuid-atlas-frame-corridor-ns",
  "6": "uuid-atlas-frame-l-corner-se",
  "7": "uuid-atlas-frame-t-junction-open-w",
  "8": "uuid-atlas-frame-dead-end-w",
  "9": "uuid-atlas-frame-l-corner-nw",
  "10": "uuid-atlas-frame-corridor-ew",
  "11": "uuid-atlas-frame-t-junction-open-s",
  "12": "uuid-atlas-frame-l-corner-sw",
  "13": "uuid-atlas-frame-t-junction-open-e",
  "14": "uuid-atlas-frame-t-junction-open-n",
  "15": "uuid-atlas-frame-cross"
}
```

**`gate_frame_mapping` schema:**
```json
{
  "vertical_closed": "uuid-atlas-frame-gate-v-closed",
  "vertical_open": "uuid-atlas-frame-gate-v-open",
  "horizontal_closed": "uuid-atlas-frame-gate-h-closed",
  "horizontal_open": "uuid-atlas-frame-gate-h-open"
}
```

### 6.2 Relationship to Atlas Frames

Each UUID in the frame mappings references a row in the `atlas_frames` table. The atlas frame record provides:
- `spriteId`: FK to the parent sprite (atlas image)
- `frameX`, `frameY`, `frameW`, `frameH`: source rectangle within the atlas image

This means fence types can reference frames from any uploaded sprite atlas. The user does not need to prepare a pre-assembled tileset -- they upload their fence sprites as part of a sprite atlas, and the fence type definition maps individual frames to connection states.

### 6.3 Fence Type Validation

When creating or updating a fence type, validate:
1. `frame_mapping` has exactly 16 entries (keys "0" through "15")
2. Each value is a valid UUID referencing an existing `atlas_frames` row
3. `gate_frame_mapping` (if provided) has exactly 4 entries with the expected keys
4. All referenced atlas frames have dimensions of 16x16 (matching `FRAME_SIZE`)
5. `key` is unique and follows the pattern `[a-z][a-z0-9_]*`

### 6.4 Virtual Tileset Generation

At load time (editor startup or game scene initialization), the system generates a virtual tileset texture for each fence type used on the current map.

**Generation steps:**

1. **Fetch fence type definitions** from the API for all fence types referenced by the map's fence layers
2. **Resolve atlas frames:** For each frame mapping entry, look up the atlas frame coordinates and parent sprite image
3. **Create virtual tileset canvas:**
   - Dimensions: 64x80 pixels (4 columns x 5 rows, 20 slots)
   - Frame 0 (slot 0): left transparent (empty frame sentinel)
   - Frames 1-16 (slots 1-16): draw each of the 16 connection state frames from their atlas sources
   - Frames 17-20 (slots 17-20): draw the 4 gate frames from their atlas sources
4. **Register the texture:**
   - Phaser (game client): `this.textures.addCanvas('fence-{key}', canvas)` then define frame data for each of the 21 frames
   - HTML Canvas (editor): store the canvas as an `HTMLImageElement` in the tileset image map

**Tileset key convention:** `fence-{fenceTypeKey}` (e.g., `fence-wooden_fence`)

**Caching:** Virtual tilesets can be cached in memory (or as data URLs in the editor) to avoid regeneration on every frame render. Regeneration is only needed when the fence type definition changes.

### 6.5 Runtime Loading Flow

**Game client (Phaser):**
```
LoadingScene:
  1. Receive MapDataPayload from server
  2. If fenceLayers exists and is non-empty:
     a. Extract unique fenceTypeKeys from all fence layers
     b. For each unique key, fetch fence type definition from API
     c. For each fence type, load all referenced atlas images
     d. For each fence type, generate virtual tileset texture
  3. Start Game scene with mapData (including fenceLayers)

Game scene:
  1. Render terrain layers to RenderTexture (existing)
  2. Render fence layers to RenderTexture:
     For each fenceLayer in mapData.fenceLayers:
       For y, x in grid:
         frame = fenceLayer.frames[y][x]
         if frame == 0: continue
         stamp.setTexture('fence-{fenceTypeKey}', frame)
         rt.draw(stamp, x * TILE_SIZE, y * TILE_SIZE)
```

**Editor (HTML Canvas):**
```
On map load:
  1. Parse layers from DB, identify fence layers by type == 'fence'
  2. For each fence layer, fetch fence type definition
  3. Generate virtual tileset as HTMLImageElement
  4. Store in tilesetImages map with key 'fence-{fenceTypeKey}'

On render:
  1. Existing terrain rendering (unchanged)
  2. For fence layers, use same tile rendering logic with:
     - 4-column tileset layout (srcX = ((frame-1) % 4) * 16, srcY = floor((frame-1) / 4) * 16)
     - fence-specific tileset image from tilesetImages map
```

### 6.6 Extensibility

The fence type system is designed for future extension:

- **8-neighbor support:** If a fence style needs diagonal-aware rendering, the `frame_mapping` JSONB can be expanded to include entries for 8-bit bitmasks (up to 47 entries). The connection engine detects which mode to use based on the number of entries in the mapping.
- **New connectable structures:** Walls, hedges, and pipes can use the same `fence_types` table (perhaps renamed to `connectable_types`) with a `structure_type` discriminator column.
- **Animated frames:** The frame mapping values could reference animation sequences instead of single atlas frames, supporting animated fences or gates.
- **Collision height:** A future `collision_height` column on `fence_types` could support 2.5D rendering where taller fences cast shadows or block projectiles at different heights.

---

## 7. Summary of Data Flow

### 7.1 Editor Placement Flow

```
User clicks fence tool + selects fence type
  -> Editor activates fence placement mode
  -> User clicks/drags on canvas
  -> Editor creates FenceCellData for each placement cell
  -> Batch bitmask recalculation for affected cells
  -> Frame indices updated in layer.frames[][]
  -> Walkability grid updated for placed cells
  -> Canvas re-renders with updated frames
  -> EditorCommand pushed to undo stack
```

### 7.2 Map Save Flow

```
Editor state (layers including fence layers)
  -> Serialize to DB format:
     - cells[][] -> sparse or dense JSONB
     - frames[][] -> number[][] JSONB
     - gate data -> embedded in cells
  -> Save to editor_maps table
```

### 7.3 Map Load Flow (Game Client)

```
Server sends MapDataPayload with fenceLayers[]
  -> Client extracts unique fence type keys
  -> Client fetches fence type definitions (API)
  -> Client loads atlas images for each fence type
  -> Client generates virtual tilesets (canvas -> texture)
  -> Client renders fence layers via RenderTexture stamping
  -> Client initializes walkability grid (terrain + fences)
  -> Client registers gate positions for interaction system
```

### 7.4 Runtime Gate Toggle Flow

```
Player presses interaction key near gate
  -> Client sends gate toggle request to server
  -> Server validates proximity and gate existence
  -> Server toggles gateOpen state
  -> Server updates authoritative walkability grid
  -> Server broadcasts gate state change to all clients
  -> Each client:
     - Updates local gate state
     - Updates local walkability grid cell
     - Updates gate display frame (open/closed variant)
     - Re-renders the affected tile on the RenderTexture
```

---

## 8. Constants Reference

| Constant | Value | Description |
|----------|-------|-------------|
| `FENCE_N` | 1 | North neighbor bit |
| `FENCE_E` | 2 | East neighbor bit |
| `FENCE_S` | 4 | South neighbor bit |
| `FENCE_W` | 8 | West neighbor bit |
| `FENCE_EMPTY_FRAME` | 0 | Sentinel for empty cells in frames grid |
| `FENCE_TILESET_COLS` | 4 | Virtual tileset column count |
| `FENCE_FRAME_COUNT` | 16 | Number of connection state frames |
| `FENCE_GATE_FRAME_COUNT` | 4 | Number of gate variant frames |
| `FENCE_TOTAL_FRAMES` | 20 | Total content frames (16 + 4) |
| `GATE_BITMASK_NS` | 5 | North-south corridor bitmask (valid for gate placement) |
| `GATE_BITMASK_EW` | 10 | East-west corridor bitmask (valid for gate placement) |

---

## 9. File Placement Plan

| File | Package | Purpose |
|------|---------|---------|
| `fence-autotile.ts` | `packages/map-lib/src/core/` | 4-cardinal connection engine (constants, computeBitmask, getFenceFrame) |
| `fence-types.ts` | `packages/db/src/schema/` | Drizzle ORM schema for `fence_types` table |
| `fence-type.ts` | `packages/db/src/services/` | CRUD service for fence type records |
| `fence-layer.ts` | `packages/shared/src/types/` | Shared types (FenceCellData, SerializedFenceLayer, etc.) |
| `fence-tileset.ts` | `packages/map-lib/src/core/` | Virtual tileset generation logic |
| Route handlers | `apps/genmap/src/app/api/fence-types/` | REST API for fence type CRUD |
| Fence tool UI | `apps/genmap/src/components/map-editor/` | Editor fence tool, palette, layer panel extension |
| Game rendering | `apps/game/src/game/scenes/Game.ts` | Fence layer RenderTexture stamping (extend existing) |
| Editor rendering | `apps/genmap/src/components/map-editor/canvas-renderer.ts` | Fence layer canvas rendering (extend existing) |
| Editor state | `apps/genmap/src/hooks/map-editor-types.ts` | FenceLayer type, reducer actions |
