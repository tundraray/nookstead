# Procedural Island Map Generation

**Status:** Draft
**Date:** 2026-02-14
**Author:** Game Studio Agents

## 1. Overview

This feature adds procedural island generation to Nookstead. A noise-based algorithm produces an organic island shape surrounded by water, classifies terrain into three types (deep water, shallow water, grass), and renders the result using the existing GMS 48-frame autotile engine and Phaser.js tilemap layers.

On startup the Game scene generates a 64x64 island with a random seed and renders it as three GPU-batched tilemap layers. Each refresh produces a unique island; passing a seed produces a deterministic result.

---

## 2. Algorithm Design

### 2.1 Elevation Generation

Use multi-octave fractional Brownian motion (FBM) with 2D simplex noise to produce a smooth heightmap in the range [0, 1].

**Parameters:**

| Parameter     | Value | Description                                    |
|---------------|-------|------------------------------------------------|
| `octaves`     | 5     | Number of noise layers                         |
| `lacunarity`  | 2.0   | Frequency multiplier per octave                |
| `persistence` | 0.5   | Amplitude multiplier per octave                |
| `scale`       | 0.04  | Base frequency (lower = larger landmasses)     |
| `exponent`    | 1.8   | Redistribution exponent for terrain sharpness  |

**Pseudocode:**

```
function fbm(x, y, seed):
    value = 0
    amplitude = 1.0
    frequency = scale
    maxAmplitude = 0

    for i in 0..octaves:
        value += amplitude * noise2D(x * frequency, y * frequency)
        maxAmplitude += amplitude
        amplitude *= persistence
        frequency *= lacunarity

    // Normalize to [0, 1]
    value = (value / maxAmplitude + 1) / 2

    // Redistribution: flatten lows, sharpen highs
    value = pow(value, exponent)

    return value
```

The `simplex-noise` npm package (MIT, zero-dependency) provides `createNoise2D(rng)` where `rng` is a seeded PRNG. Use `alea` from the same package or a simple seeded LCG.

### 2.2 Island Mask

A pure noise heightmap produces landmasses that extend to the map edges. An island mask forces elevation to zero at borders, creating a water-surrounded island.

**Square-based falloff** (produces rounded-rectangle shapes with organic variation):

```
function islandMask(x, y, width, height):
    // Normalize to [0, 1]
    nx = x / width
    ny = y / height

    // Distance from center on each axis, range [0, 1]
    dx = abs(2 * nx - 1)
    dy = abs(2 * ny - 1)

    // Fourth-power falloff for soft edges
    mask = (1 - dx^4) * (1 - dy^4)

    return clamp(mask, 0, 1)
```

**Blending noise with mask:**

```
function elevation(x, y, width, height, seed):
    noise = fbm(x, y, seed)
    mask = islandMask(x, y, width, height)

    // Blend: mostly mask-driven, with noise adding variation
    e = noise * lerp(1.0, mask, 0.7)

    return clamp(e, 0, 1)
```

The `lerp(1.0, mask, 0.7)` blend means: 70% mask influence, 30% pure noise. This keeps the island contained while allowing irregular coastlines. The effective formula is:

```
e = noise * (0.3 + 0.7 * mask)
```

### 2.3 Terrain Classification

After computing the elevation grid, classify each cell into one of three terrain types using threshold values:

| Elevation Range | Terrain Type | Description            |
|-----------------|-------------|------------------------|
| `< 0.15`        | `deep_water` | Open ocean             |
| `< 0.30`        | `water`      | Shallow coastal water  |
| `>= 0.30`       | `grass`      | Land (shore + interior)|

**Pseudocode:**

```
function classifyTerrain(elevation):
    if elevation < 0.15: return 'deep_water'
    if elevation < 0.30: return 'water'
    return 'grass'
```

These thresholds should be defined as named constants so they can be tuned easily.

### 2.4 Water Border Enforcement

The noise-based classification alone does not guarantee a minimum water border around the island. A post-processing step enforces at least 5 tiles of shallow water between any grass tile and the deep water region.

**Algorithm: BFS distance field from grass**

```
function enforceWaterBorder(terrain[][], width, height):
    // Step 1: BFS from all grass cells to compute distance-to-grass
    queue = new Queue()
    distance[][] = fill(Infinity)

    for each cell (x, y):
        if terrain[y][x] == 'grass':
            distance[y][x] = 0
            queue.enqueue((x, y))

    while queue is not empty:
        (cx, cy) = queue.dequeue()
        for each 4-neighbor (nx, ny) of (cx, cy):
            if inBounds(nx, ny) and distance[ny][nx] > distance[cy][cx] + 1:
                distance[ny][nx] = distance[cy][cx] + 1
                queue.enqueue((nx, ny))

    // Step 2: Reclassify water cells based on distance
    for each cell (x, y) where terrain[y][x] != 'grass':
        d = distance[y][x]
        if d <= 5:
            terrain[y][x] = 'water'       // shallow water buffer
        else:
            terrain[y][x] = 'deep_water'   // everything beyond buffer
```

This BFS uses 4-connectivity (not 8) so the water border is measured in Manhattan distance, producing a diamond-shaped minimum buffer that looks natural for tile-based water.

**Edge case:** If the island is very small, the entire non-grass area may become shallow water with no deep water. This is acceptable for small islands; the deep water threshold can be increased if desired.

---

## 3. Terrain Connection Mapping

### 3.1 Tileset Semantics

Each autotile spritesheet represents a **foreground** terrain transitioning over a **background** terrain:

| Tileset              | Key         | Foreground   | Background     |
|----------------------|-------------|-------------|----------------|
| `deep_water_water`   | `terrain-16` | Deep water  | Shallow water  |
| `water_grass`        | `terrain-03` | Water       | Grass          |
| `grass_water`        | `terrain-15` | Grass       | Water          |

- **Frame 0** = empty/transparent (no foreground drawn)
- **Frame 1** = solid foreground (background completely hidden)
- **Frames 2-47** = autotile transition shapes (foreground shape with background showing through at edges/corners)

### 3.2 Layer Stack

The rendering uses 3 Phaser tilemap layers, drawn bottom to top:

| Order | Layer Name     | Tileset        | Content                                              |
|-------|---------------|----------------|------------------------------------------------------|
| 0     | `base`        | `terrain-03`   | Solid shallow water fill on every cell (frame 1)     |
| 1     | `deep_water`  | `terrain-16`   | Deep water cells autotiled (deep water fg on water bg) |
| 2     | `grass`       | `terrain-15`   | Grass cells autotiled (grass fg on water bg)          |

**How it works:**

1. **Layer 0 (base):** Every cell in the map gets `water_grass` frame 1 (solid water foreground). This establishes a uniform shallow water base across the entire map. The `water_grass` tileset shows water on grass background, but since every cell is solid (frame 1), no grass background is visible. This layer exists solely to provide shallow water color underneath the other layers.

2. **Layer 1 (deep_water):** Cells classified as `deep_water` are marked as "present." The autotile algorithm computes 8-bit neighbor masks where a neighbor is "present" if it is also `deep_water`. The `deep_water_water` tileset (terrain-16) renders deep water foreground with shallow water background showing through at transition edges. Interior deep water cells get the solid frame; edge cells get appropriate transition frames. Cells that are NOT deep_water get frame 0 (empty/transparent), so the shallow water base layer shows through.

3. **Layer 2 (grass):** Cells classified as `grass` are marked as "present." Same autotile process: neighbors are "present" if also `grass`. The `grass_water` tileset (terrain-15) renders grass foreground with water background at edges. Interior grass gets solid grass; coastline cells get shaped grass tiles with water background baked into the tile art. Non-grass cells get frame 0, showing the layers below.

**Visual result (per pixel column, from viewer's eye down through layers):**

| Terrain Type | Layer 2 (grass) | Layer 1 (deep) | Layer 0 (base) | What Viewer Sees     |
|-------------|-----------------|-----------------|-----------------|----------------------|
| `grass`     | Solid grass      | --              | --              | Grass                |
| `grass` edge| Grass+water edge | --              | --              | Grass with water edge|
| `water`     | Empty (frame 0)  | Empty (frame 0) | Solid water     | Shallow water        |
| `deep_water`| Empty (frame 0)  | Solid deep water| --              | Deep water           |
| `deep_water` edge | Empty     | Deep+water edge | Solid water     | Deep water fading to shallow |

**Tile count estimate for 64x64 map:**
- Layer 0: 4,096 tiles (full fill)
- Layer 1: ~2,000-3,000 tiles (deep water region)
- Layer 2: ~800-1,500 tiles (island grass)
- **Total: ~7,000-8,500 tiles** across 3 layers

Phaser handles this comfortably with tilemap layers, which are GPU-batched.

### 3.3 Layer Definition Types

```typescript
interface TerrainLayer {
  name: string;           // Layer identifier (e.g., 'deep_water', 'grass')
  terrainKey: string;     // Phaser spritesheet key (e.g., 'terrain-16')
  zIndex: number;         // Rendering order (0 = bottom)
  isFill: boolean;        // If true, every cell gets solidFrame (no autotile)
  isPresent: (type: TerrainCellType) => boolean;  // Which cell types are "present"
}

const LAYERS: TerrainLayer[] = [
  {
    name: 'base',
    terrainKey: 'terrain-03',    // water_grass
    zIndex: 0,
    isFill: true,                // solid frame on every cell
    isPresent: () => true,
  },
  {
    name: 'deep_water',
    terrainKey: 'terrain-16',    // deep_water_water
    zIndex: 1,
    isFill: false,
    isPresent: (type) => type === 'deep_water',
  },
  {
    name: 'grass',
    terrainKey: 'terrain-15',    // grass_water
    zIndex: 2,
    isFill: false,
    isPresent: (type) => type === 'grass',
  },
];
```

---

## 4. Autotile Computation

For each non-fill layer, compute the 8-bit neighbor mask per cell and use the existing `getFrame()` function from `autotile.ts`.

**Pseudocode:**

```
function computeAutotileFrames(terrain[][], layer, width, height):
    frames[][] = new Array[height][width], fill with EMPTY_FRAME (0)

    if layer.isFill:
        fill all cells with SOLID_FRAME (1)
        return frames

    for y in 0..height:
        for x in 0..width:
            if not layer.isPresent(terrain[y][x]):
                frames[y][x] = EMPTY_FRAME
                continue

            // Build 8-bit neighbor mask
            neighbors = 0
            if y > 0          and layer.isPresent(terrain[y-1][x]):   neighbors |= N    // 1
            if y > 0 and x < w-1 and layer.isPresent(terrain[y-1][x+1]): neighbors |= NE // 2
            if x < w-1        and layer.isPresent(terrain[y][x+1]):   neighbors |= E    // 4
            if y < h-1 and x < w-1 and layer.isPresent(terrain[y+1][x+1]): neighbors |= SE // 8
            if y < h-1        and layer.isPresent(terrain[y+1][x]):   neighbors |= S    // 16
            if y < h-1 and x > 0  and layer.isPresent(terrain[y+1][x-1]): neighbors |= SW // 32
            if x > 0          and layer.isPresent(terrain[y][x-1]):   neighbors |= W    // 64
            if y > 0 and x > 0    and layer.isPresent(terrain[y-1][x-1]): neighbors |= NW // 128

            frames[y][x] = getFrame(neighbors)

    return frames
```

The neighbor mask directions match the constants in `autotile.ts`: N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128.

Out-of-bounds neighbors are treated as "not present," which causes edge-of-map cells to get appropriate border frames.

---

## 5. Data Structures

```typescript
type TerrainCellType = 'deep_water' | 'water' | 'grass';

/** Raw island generation output. */
interface IslandData {
  width: number;
  height: number;
  seed: number;
  elevation: number[][];        // [y][x] in range [0, 1]
  terrain: TerrainCellType[][]; // [y][x] classified terrain
}

/** Autotile frame data for a single rendering layer. */
interface LayerData {
  name: string;
  terrainKey: string;           // Phaser spritesheet key
  frames: number[][];           // [y][x] frame index (0 = empty, 1-47 = autotile)
}

/** Complete generated map ready for rendering. */
interface GeneratedMap {
  island: IslandData;
  layers: LayerData[];          // ordered bottom-to-top
}
```

All 2D arrays use `[y][x]` (row-major) indexing, consistent with standard tilemap conventions.

---

## 6. File Structure

```
apps/game/src/game/
  mapgen.ts                 // NEW — generateIsland(), fbm(), islandMask(),
                            //        classifyTerrain(), enforceWaterBorder()
  terrain-connections.ts    // NEW — LAYERS definition, computeAutotileFrames(),
                            //        buildGeneratedMap()
  autotile.ts               // EXISTING — getFrame(), neighbor constants (no changes)
  terrain.ts                // EXISTING — TERRAINS, TILESETS (no changes)
  constants.ts              // MODIFIED — add MAP_WIDTH, MAP_HEIGHT, generation params
  scenes/
    Game.ts                 // MODIFIED — replace terrain viewer with island renderer
```

### 6.1 Module Responsibilities

**`mapgen.ts`** — Pure data generation, no Phaser dependency:
- `generateIsland(width, height, seed?): IslandData` — main entry point
- `fbm(x, y, seed): number` — multi-octave simplex noise
- `islandMask(x, y, width, height): number` — square falloff
- `classifyTerrain(elevation: number): TerrainCellType` — threshold classification
- `enforceWaterBorder(terrain: TerrainCellType[][], width, height): void` — BFS in-place

**`terrain-connections.ts`** — Bridge between raw data and rendering:
- `LAYERS: TerrainLayer[]` — layer stack definition
- `computeAutotileFrames(terrain, layer, width, height): number[][]` — per-layer frame computation
- `buildGeneratedMap(island: IslandData): GeneratedMap` — compose all layers

**`constants.ts`** — Add generation constants:
```typescript
// Map generation
export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 64;

// Noise parameters
export const NOISE_OCTAVES = 5;
export const NOISE_LACUNARITY = 2.0;
export const NOISE_PERSISTENCE = 0.5;
export const NOISE_SCALE = 0.04;
export const ELEVATION_EXPONENT = 1.8;

// Island mask
export const MASK_BLEND = 0.7;

// Terrain thresholds
export const DEEP_WATER_THRESHOLD = 0.15;
export const WATER_THRESHOLD = 0.30;

// Water border
export const MIN_WATER_BORDER = 5;
```

---

## 7. Rendering Integration (Game.ts)

The Game scene `create()` method is replaced with island rendering:

```typescript
import { Scene } from 'phaser';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../constants';
import { generateIsland } from '../mapgen';
import { buildGeneratedMap } from '../terrain-connections';
import { SOLID_FRAME, EMPTY_FRAME } from '../autotile';
import { EventBus } from '../EventBus';

export class Game extends Scene {
  constructor() {
    super('Game');
  }

  create() {
    const seed = Date.now();
    const island = generateIsland(MAP_WIDTH, MAP_HEIGHT, seed);
    const mapData = buildGeneratedMap(island);

    // Create Phaser tilemap (blank, sized to island)
    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
    });

    // Add each layer's tileset and create the tilemap layer
    for (const layerData of mapData.layers) {
      const tileset = map.addTilesetImage(
        layerData.terrainKey,   // tileset name in map
        layerData.terrainKey,   // Phaser texture key (loaded in Preloader)
        TILE_SIZE,
        TILE_SIZE
      );

      const layer = map.createBlankLayer(layerData.name, tileset!);

      // Fill tiles from frame data
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const frame = layerData.frames[y][x];
          if (frame !== EMPTY_FRAME) {
            layer!.putTileAt(frame, x, y);
          }
        }
      }
    }

    // Camera setup for debug viewing
    const mapPixelW = MAP_WIDTH * TILE_SIZE;
    const mapPixelH = MAP_HEIGHT * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, mapPixelW, mapPixelH);
    this.cameras.main.centerOn(mapPixelW / 2, mapPixelH / 2);
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Enable drag-scroll for debug navigation
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });

    // Mouse wheel zoom
    this.input.on('wheel', (_pointer: unknown, _gx: unknown, _gy: unknown, _dx: unknown, dy: number) => {
      const cam = this.cameras.main;
      cam.zoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.25, 4);
    });

    EventBus.emit('current-scene-ready', this);
  }
}
```

**Key rendering details:**
- `map.addTilesetImage(name, key, tileW, tileH)` registers each spritesheet (already loaded by Preloader scene).
- `map.createBlankLayer(name, tileset)` creates a GPU-batched layer. Phaser renders all tiles in a layer in a single draw call.
- `putTileAt(frame, x, y)` sets the tile frame index. Cells left empty (not called with putTileAt or set to frame 0 via `removeTileAt`) are transparent.
- Layer creation order determines draw order (first created = bottom).

---

## 8. Dependency: simplex-noise

The `simplex-noise` package provides the 2D noise function.

```bash
npm install simplex-noise alea --workspace=apps/game
```

**Usage:**

```typescript
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';  // separate package, required for seeded PRNG

// Create a seeded noise function
const prng = alea(seed);
const noise2D = createNoise2D(prng);

// noise2D(x, y) returns [-1, 1]
```

If `alea` is not available as a separate import, a simple seeded PRNG can be implemented inline:

```typescript
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}
```

---

## 9. Complete Generation Pipeline

```
generateIsland(width, height, seed?)
  |
  |-- 1. Initialize seed (seed ?? Date.now())
  |-- 2. Create seeded noise function via createNoise2D(alea(seed))
  |-- 3. For each cell (x, y):
  |       a. Compute fbm(x, y) using seeded noise2D
  |       b. Compute islandMask(x, y, width, height)
  |       c. Blend: elevation = noise * (0.3 + 0.7 * mask)
  |       d. Clamp to [0, 1]
  |-- 4. For each cell: classifyTerrain(elevation) → terrain[][]
  |-- 5. enforceWaterBorder(terrain, width, height) — BFS, mutates in-place
  |-- 6. Return IslandData { width, height, seed, elevation, terrain }
  |
  v
buildGeneratedMap(island)
  |
  |-- For each layer in LAYERS:
  |     a. computeAutotileFrames(island.terrain, layer, width, height)
  |     b. Produce LayerData { name, terrainKey, frames }
  |-- Return GeneratedMap { island, layers }
  |
  v
Game.create()
  |
  |-- Create Phaser tilemap
  |-- For each LayerData: addTilesetImage, createBlankLayer, putTileAt per cell
  |-- Configure camera bounds, center, drag-scroll, zoom
```

---

## 10. Acceptance Criteria

1. **Island renders on startup:** Running `npx nx dev game` displays a procedurally generated 64x64 island in the Game scene.
2. **Organic shape:** The island has an irregular, natural-looking coastline (not a perfect circle or rectangle). Verified visually.
3. **Correct autotile transitions:** Grass tiles at the coastline display proper edge and corner frames from the `grass_water` tileset. No mismatched edges or floating terrain fragments.
4. **Minimum water border:** At least 5 tiles of shallow water surround every grass tile before deep water begins. Can be verified by inspecting the terrain grid.
5. **Deep water transitions:** Deep water fills the map perimeter with correct autotile transitions to shallow water using the `deep_water_water` tileset.
6. **Random seeds:** Each page refresh generates a visually different island layout.
7. **Deterministic seeds:** Calling `generateIsland(64, 64, 12345)` produces the same island every time.
8. **No visual artifacts:** No gaps between tiles, no transparent holes in the terrain, no incorrect frame selections at boundaries.
9. **Performance:** Map generation completes in under 100ms for a 64x64 grid. Rendering maintains 60fps during camera pan/zoom.

---

## 11. Future Considerations

These items are out of scope for the initial implementation but inform design decisions:

- **Additional terrain types:** Sand beaches, forest, rocky outcrops. The layer stack and threshold system extend naturally to more types.
- **Larger maps:** 128x128 or 256x256. The BFS and autotile algorithms are O(n) in cell count and should scale fine. Phaser tilemap layers handle large maps efficiently.
- **Biome variation:** Use separate noise channels for moisture/temperature to create biome regions.
- **Multiplayer sync:** The seed-based generation means the server only needs to transmit the seed; clients regenerate the same map deterministically.
- **Chunked loading:** For very large worlds, generate and render chunks on demand rather than the full map at once.
