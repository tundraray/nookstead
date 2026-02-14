# Procedural Island/Map Generation for 2D Tile-Based Games

## Research Document for Nookstead

---

## 1. Noise-Based Terrain Generation

### 1.1 Perlin Noise vs Simplex Noise

Both produce coherent pseudo-random values given spatial coordinates and a seed.

- **Perlin Noise** — square grid, gradient interpolation. Simple but has axis-aligned artifacts.
- **Simplex Noise** — triangle grid, fewer multiplications, fewer artifacts, better scaling.

For 2D tile-based games, Simplex is preferred.

### 1.2 Multi-Octave Noise (Fractal Brownian Motion)

Layer multiple octaves at increasing frequencies and decreasing amplitudes:

```typescript
elevation = (1.0 * noise(1*nx, 1*ny)
           + 0.5 * noise(2*nx, 2*ny)
           + 0.25 * noise(4*nx, 4*ny)) / 1.75
```

Parameters:
- **Octaves**: 3-6 typical for terrain
- **Lacunarity**: frequency multiplier per octave (commonly 2.0)
- **Persistence**: amplitude multiplier per octave (commonly 0.5)

### 1.3 Elevation Redistribution

Apply power curve for dramatic terrain:
```typescript
elevation = Math.pow(elevation, exponent);
// 1.0 = unchanged, 2.0-3.0 = flat lowlands + steep peaks
```

---

## 2. Island Shape Generation

### 2.1 Radial Gradient Masking

Multiply noise heightmap by distance-based falloff forcing edges below sea level.

**Square-based falloff** (avoids perfectly circular islands):
```typescript
function squareMask(nx: number, ny: number): number {
  return (1 - Math.pow(2 * nx - 1, 2)) * (1 - Math.pow(2 * ny - 1, 2));
}
```

**Blend noise with distance** for irregular coastlines:
```typescript
const distance = 1 - squareMask(nx, ny);
elevation = lerp(noiseElevation, 1 - distance, 0.3);
```

### 2.2 Cellular Automata for Irregular Shapes

Useful for organic-looking land masses:

```typescript
function cellularAutomata(width, height, fillPercent, iterations, birthThreshold, deathThreshold) {
  // 1. Random fill at fillPercent
  // 2. For each iteration:
  //    - Count 8-neighbors
  //    - Dead cell with >= birthThreshold neighbors → alive
  //    - Alive cell with < deathThreshold neighbors → dead
  // 3. Result: organic island shapes
}
```

---

## 3. Tile Connectivity & Autotiling

### 3.1 System Comparison

| System | Tiles | Basis | Complexity |
|---|---|---|---|
| 4-bit Cardinal | 16 | Edge neighbors only | Simple |
| 8-bit Blob (GMS) | 47+1 | All 8 neighbors | Full coverage |
| Wang Tiles | 16 | Edge/corner colors | Moderate |

### 3.2 GMS 47-Tile System (Already Implemented)

The Nookstead codebase uses 8-bit blob autotiling in `autotile.ts`:
- 8 neighbor flags: N, NE, E, SE, S, SW, W, NW
- Split into 4-bit edges + 4-bit corners (corners only count when both adjacent edges present)
- Key = (edges << 4) | corners → frame index 0-47
- 48 frames per terrain spritesheet (12 cols × 4 rows)

---

## 4. Water-to-Land Transitions

### 4.1 Elevation Threshold Zones

```typescript
function classifyTerrain(elevation: number): string {
  if (elevation < 0.20) return 'deep_water';
  if (elevation < 0.30) return 'shallow_water';
  if (elevation < 0.35) return 'shore';
  if (elevation < 0.65) return 'grass';
  return 'forest';
}
```

### 4.2 Minimum Border Width Enforcement

**Distance field approach** (BFS from water boundary):
```typescript
// 1. BFS flood fill from all water tiles
// 2. Each land tile gets distance-to-water
// 3. distance 1-5 = shallow_water transition zone
// 4. distance 6+ = deep_water starts beyond
```

**Morphological erosion/dilation**:
```typescript
// For each pass (up to minWidth):
//   Find grass cells adjacent to water
//   Convert them to transition terrain
```

### 4.3 Nookstead Tileset Mapping

- `deep_water_water` (terrain-16): deep-to-shallow water
- `water_grass` (terrain-03): water surrounded by grass (water is foreground)
- `grass_water` (terrain-15): grass surrounded by water (grass is foreground, inverse of 03)
- `light_sand_water` (terrain-08): sand-water boundary
- `light_sand_grass` (terrain-07): sand-grass boundary

---

## 5. Layered Generation Pipeline

### 5.1 Recommended Pass Order

```
Pass 1: Base Elevation    (noise heightmap + island mask)
Pass 2: Terrain Classify  (elevation thresholds → terrain types)
Pass 3: Border Enforce    (minimum water border width ≥5 tiles)
Pass 4: Build Layers      (separate terrain types into rendering layers)
Pass 5: Autotile          (compute bitmasks per layer using autotile.ts)
Pass 6: Features          (paths, decorations — future)
```

### 5.2 Multi-Layer Tilemap Structure (Phaser.js)

```typescript
const LAYERS = [
  'deep_water',  // base layer (always filled)
  'water',       // shallow water autotiled over deep
  'ground',      // grass/land autotiled over water
  'ground2',     // paths, sand overlays (future)
  'features',    // trees, rocks (future)
];
```

Each layer uses the autotile system independently.

---

## 6. How Games Handle This

### Stardew Valley
Hand-crafted maps in Tiled editor. Multiple tile layers + data layers for collision.

### Terraria
103-pass procedural generation: Perlin noise surface → cave carving → biome placement → ore scattering → structure generation → smoothing.

### Dwarf Fortress
Heightmap → erosion simulation → climate simulation → vegetation → history simulation. Most sophisticated procedural world gen in games.

---

## 7. Implementation Notes for Nookstead

### Noise Library
```bash
npm install simplex-noise alea
```
```typescript
import { createNoise2D } from 'simplex-noise';
import Alea from 'alea';
const noise2D = createNoise2D(Alea(seed));
```

### Phaser Tilemap from Procedural Data
```typescript
const map = scene.make.tilemap({ tileWidth: 48, tileHeight: 48, width, height });
const tileset = map.addTilesetImage(key, key, 48, 48);
const layer = map.createBlankLayer('ground', tileset);
layer.putTileAt(frameIndex, x, y);
```

### Performance
- For 64×64 maps, generation is fast enough to run synchronously
- For larger maps (256+), use Web Workers
- Phaser handles 3-5 tilemap layers efficiently

---

## Sources

- [Red Blob Games: Making maps with noise](https://www.redblobgames.com/maps/terrain-from-noise/)
- [Red Blob Games: Polygonal Map Generation](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/)
- [Diamond-square algorithm (Wikipedia)](https://en.wikipedia.org/wiki/Diamond-square_algorithm)
- [Classification of Tilesets (BorisTheBrave)](https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/)
- [How to Use Tile Bitmasking (Envato Tuts+)](https://code.tutsplus.com/how-to-use-tile-bitmasking-to-auto-tile-your-level-layouts--cms-25673t)
- [Procedural Generation with Cellular Automata](https://bronsonzgeb.com/index.php/2022/01/30/procedural-generation-with-cellular-automata/)
- [Terraria World Generation Wiki](https://terraria.wiki.gg/wiki/World_generation)
- [Dwarf Fortress World Generation Wiki](https://dwarffortresswiki.org/index.php/World_generation)
