# ADR-001: Procedural Island Map Generation Architecture

## Status

Accepted

## Context

Nookstead requires procedural generation of island maps for the game world. The islands need to be:

1. **Reproducible** — The same seed should always generate the same island layout
2. **Varied** — Different seeds should produce visually distinct terrain patterns
3. **Performant** — Map generation must be fast enough for client-side execution
4. **Visually coherent** — Terrain should have smooth, natural-looking transitions

The technical requirements include:

- **Noise generation** for terrain heightmaps to create organic island shapes
- **Seeded PRNG** to ensure reproducibility across sessions and clients
- **Multi-layer rendering** to support terrain depth (water layers + ground)
- **GPU-efficient rendering** to maintain 60 FPS in Phaser.js

### Alternatives Considered

#### Noise Generation Libraries

1. **Hand-written Perlin noise**
   - ✅ Full control over implementation
   - ❌ Complex to implement correctly without artifacts
   - ❌ High maintenance burden
   - ❌ Requires deep understanding of noise algorithms

2. **simplex-noise library**
   - ✅ Well-maintained TypeScript-native package
   - ✅ Tree-shakeable, small bundle size (~3KB)
   - ✅ Provides `createNoise2D()` with pluggable PRNG
   - ✅ Widely used, battle-tested
   - ❌ External dependency

3. **open-simplex-noise**
   - ✅ Similar feature set
   - ❌ Less popular, smaller community
   - ❌ Larger bundle size
   - ❌ Less TypeScript support

#### PRNG Solutions

1. **Math.random()** with seed hashing
   - ❌ Not seedable
   - ❌ Implementation-dependent behavior
   - ❌ Poor quality for noise generation

2. **alea**
   - ✅ Tiny footprint (~500 bytes)
   - ✅ Fast execution
   - ✅ High-quality seeded random numbers
   - ✅ Recommended PRNG for simplex-noise
   - ❌ External dependency

3. **seedrandom**
   - ✅ Well-known package
   - ❌ Larger bundle size
   - ❌ Slower than alea

#### Rendering Architecture

1. **Individual Phaser.Image sprites**
   - ❌ Poor performance (thousands of draw calls)
   - ❌ No GPU batching
   - ❌ High memory overhead

2. **Single layer with manual tile selection**
   - ❌ Complex logic for terrain transitions
   - ❌ Difficult to maintain
   - ❌ Limited visual depth

3. **Multi-layer Phaser.Tilemaps with GMS autotiling**
   - ✅ GPU-batched rendering (single draw call per layer)
   - ✅ Reuses existing GMS autotile engine
   - ✅ Clean separation of terrain depths
   - ✅ Supports complex terrain transitions

## Decision

We will use **simplex-noise + alea** for procedural map generation and **multi-layer Phaser tilemap rendering** for visualization.

### Noise Generation

- **Library**: `simplex-noise` (npm package)
- **PRNG**: `alea` (npm package)
- **Usage**: `createNoise2D(alea(seed))` to create a seeded 2D noise function

### Map Rendering Architecture

Use **Phaser.Tilemaps.Tilemap** with three GPU-batched layers using a fill-layer approach:

1. **base** — Solid shallow water fill (`water_grass` / terrain-03, frame 1 on every cell). Provides uniform shallow water background.
2. **deep_water** — Deep water autotiled (`deep_water_water` / terrain-16). Only cells classified as `deep_water` are "present." The autotile engine computes transitions showing deep water foreground with shallow water background at edges.
3. **grass** — Grass autotiled (`grass_water` / terrain-15). Only cells classified as `grass` are "present." Shows grass foreground with water background at edges.

Each autotiled layer uses per-layer `isPresent` predicates: a cell's neighbors are "present" only if they share the same terrain type within that layer. The existing GMS autotile engine (`getFrame()`) computes correct tile variants independently per layer.

### Heightmap to Tile Conversion

Noise values are thresholded to determine tile placement:

```
elevation < 0.15 → deep_water
elevation < 0.30 → water
elevation >= 0.30 → grass
```

Post-classification, a BFS-based water border enforcement step ensures at least 5 tiles of shallow water surround every grass tile before deep water begins.

## Consequences

### Positive

1. **Small bundle impact** — Total added bundle size is ~3.5KB (simplex-noise + alea)
2. **TypeScript-native** — Full type safety and IntelliSense support
3. **Reproducible maps** — Same seed always generates identical islands
4. **High performance** — GPU batching keeps rendering at 60 FPS even with large maps
5. **Maintainable** — Clean separation of concerns, reuses existing autotile logic
6. **Extensible** — Easy to add more terrain layers (sand, dirt, etc.) in the future
7. **Visual quality** — Smooth, organic terrain with natural-looking transitions

### Negative

1. **External dependencies** — Adds two npm packages to maintain
2. **Learning curve** — Developers need to understand noise parameters (frequency, octaves, etc.)
3. **Limited noise types** — Simplex noise only; if we need Perlin or other noise types later, may need additional libraries

### Technical Debt

- If bundle size becomes critical, we may need to re-evaluate or implement custom noise
- PRNG quality should be monitored if we add more complex procedural features

### Migration Path

If we need to change noise libraries in the future:

1. The noise function interface is abstracted behind `createNoise2D()`
2. Swapping libraries only requires changing the import and initialization
3. Seed handling remains unchanged

## References

- [simplex-noise npm package](https://www.npmjs.com/package/simplex-noise)
- [alea npm package](https://www.npmjs.com/package/alea)
- [Phaser 3 Tilemap Documentation](https://photonstorm.github.io/phaser3-docs/Phaser.Tilemaps.Tilemap.html)
- Nookstead GDD v3 (Section 3.3 - Map Generation)

## Date

2026-02-14
