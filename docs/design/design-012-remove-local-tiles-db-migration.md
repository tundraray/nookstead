# Design-012: Remove Local Tiles & Map Generator — Full DB Migration

## Overview

Remove all hardcoded terrain definitions (`terrain.ts`, `terrain-properties.ts`) and the procedural map generator (`generation/`) from `map-lib`, rewiring all consumers to use the existing database-driven tileset and material services. After this migration, terrain data flows exclusively from PostgreSQL.

**Related Documents:**
- **Design-011:** `design-011-tileset-management.md` — Created the DB services (already implemented)
- **ADR-0009:** `ADR-0009-tileset-management-architecture.md` — Architecture decisions

## Implementation Status

**Status:** IMPLEMENTED
**Commit:** `02f625b` on `feature/genmap-editor-and-db-services`
**Date:** 2026-02-21

All 12 implementation steps completed successfully. Full monorepo verification passed (lint, test, build, typecheck — 8 projects, 264 tests, 0 errors).

## User Decisions

| Decision | Choice |
|----------|--------|
| New player map provisioning | Random editor map from DB by map type |
| TerrainCellType strategy | Keep union, auto-generate from DB via codegen script |
| Tileset metadata delivery to game client | Dedicated API endpoint in `apps/game` |
| Migration approach | Big bang (single branch) |
| Commit strategy | Per-task (ask user before implementation) |

## Scope

### Files to DELETE (21 files)

**map-lib deprecated modules:**
- `packages/map-lib/src/core/terrain.ts`
- `packages/map-lib/src/core/terrain-properties.ts`

**map-lib generation pipeline:**
- `packages/map-lib/src/generation/index.ts`
- `packages/map-lib/src/generation/map-generator.ts`
- `packages/map-lib/src/generation/passes/island-pass.ts`
- `packages/map-lib/src/generation/passes/connectivity-pass.ts`
- `packages/map-lib/src/generation/passes/water-border-pass.ts`
- `packages/map-lib/src/generation/passes/autotile-pass.ts`

**server dead-code re-exports:**
- `apps/server/src/mapgen/index.ts`
- `apps/server/src/mapgen/index.spec.ts`
- `apps/server/src/mapgen/autotile.ts`
- `apps/server/src/mapgen/terrain-properties.ts`
- `apps/server/src/mapgen/types.ts`
- `apps/server/src/mapgen/passes/island-pass.ts`
- `apps/server/src/mapgen/passes/connectivity-pass.ts`
- `apps/server/src/mapgen/passes/water-border-pass.ts`
- `apps/server/src/mapgen/passes/autotile-pass.ts`

**game client re-export shims:**
- `apps/game/src/game/terrain.ts`
- `apps/game/src/game/terrain-properties.ts`
- `apps/game/src/game/autotile.ts`
- `apps/game/src/game/mapgen/types.ts`

### Files to MODIFY (10 files)

| File | Change |
|------|--------|
| `packages/map-lib/src/index.ts` | Remove terrain, terrain-properties, generation exports |
| `packages/shared/src/types/map.ts` | Replace hardcoded TerrainCellType union with auto-generated version; remove GenerationPass, LayerPass (generation-only types) |
| `packages/shared/src/constants.ts` | Remove noise/generation constants (NOISE_*, ELEVATION_*, DEEP_WATER_THRESHOLD, WATER_THRESHOLD, MIN_WATER_BORDER) |
| `packages/shared/src/index.ts` | Remove noise constant exports, remove GenerationPass/LayerPass type exports |
| `apps/game/src/game/scenes/Preloader.ts` | Fetch tileset metadata from API instead of TERRAINS array |
| `apps/game/src/game/systems/movement.ts` | Replace getSurfaceProperties with in-memory material cache |
| `apps/server/src/rooms/ChunkRoom.ts` | Replace createMapGenerator with random DB map lookup |
| `apps/genmap/src/hooks/autotile-utils.ts` | Replace TERRAINS.find and isWalkable with DB-backed lookups |
| `apps/server/src/rooms/ChunkRoom.spec.ts` | Update tests for new DB-based map provisioning |
| `apps/genmap/src/hooks/map-editor-types.ts` | May need type updates if EditorLayer references change |

**Additional files modified during implementation** (not in original scope):

| File | Change |
|------|--------|
| `apps/genmap/src/hooks/use-map-editor.ts` | Added `SET_TILESETS` / `SET_MATERIALS` reducer actions + initial state to thread tileset/material data through `MapEditorState` |
| `apps/game/src/game/constants.ts` | Removed duplicated noise/generation constants (`NOISE_*`, `ELEVATION_*`, etc.) that were also defined in `shared/constants.ts` |
| `apps/game/specs/systems/movement.spec.ts` | Added `material-cache` mock, fixed import path for movement module |
| `apps/genmap/specs/index.spec.tsx` | Fixed import path to route group layout, added `next/navigation` mock |

### Files to CREATE (5 files)

| File | Purpose |
|------|---------|
| `apps/game/src/app/api/tilesets/route.ts` | API endpoint returning tileset metadata + S3 URLs for game client |
| `apps/game/src/app/api/materials/route.ts` | API endpoint returning material properties for game client |
| `apps/game/src/game/services/material-cache.ts` | In-memory material properties lookup for movement system |
| `scripts/generate-terrain-types.ts` | Codegen script: reads materials from DB, generates TerrainCellType union |
| `packages/shared/src/types/terrain-cell-type.generated.ts` | Auto-generated TerrainCellType union (output of codegen) |

### Explicitly NOT changing

- `packages/map-lib/src/core/autotile.ts` — Pure math, no terrain refs
- `packages/map-lib/src/types/` — MapType, zone types, template types
- `packages/map-renderer/` — Uses LayerData.terrainKey (unchanged)
- `packages/db/src/services/` — Already complete, no modifications needed
- `packages/db/src/seeds/` — Has inline data copies, no import dependency on map-lib
- `apps/genmap/src/components/map-editor/terrain-palette.tsx` — Already uses DB API
- `apps/genmap/src/hooks/use-tileset-images.ts` — Already uses DB/S3

## Design

### 1. Tileset Metadata API for Game Client

**New file: `apps/game/src/app/api/tilesets/route.ts`**

```typescript
import { getDb, listTilesets } from '@nookstead/db';
import { NextResponse } from 'next/server';

// Returns tileset metadata needed by Phaser Preloader:
// [{ key: 'terrain-03', s3Url: 'https://...', name: 'water_grass' }, ...]
export async function GET() {
  const db = getDb();
  const tilesets = await listTilesets(db);
  // listTilesets returns full Tileset records with key, name, s3Url
  const metadata = tilesets.map(t => ({
    key: t.key,
    name: t.name,
    s3Url: t.s3Url,
  }));
  return NextResponse.json(metadata);
}
```

**Updated Preloader.ts flow:**
```
1. Preloader.preload() loads character spritesheets (local paths, sync — Phaser preload is synchronous)
2. Preloader.create() fetches tileset metadata and material cache in parallel:
   - const [tilesetRes, _] = await Promise.all([
       fetch('/api/tilesets'),
       loadMaterialCache()      // material-cache.ts fetch + populate
     ])
3. For each tileset: this.load.spritesheet(key, s3Url, { frameWidth: 16, frameHeight: 16 })
4. this.load.start() — manually triggers Phaser loader (since we are in create(), not preload())
5. this.load.on('complete', () => this.scene.start('Game')) — manual completion listener
```

Note: Phaser's `preload()` is synchronous and does not support async/await. All async data fetching happens in `create()`, with a manual `this.load.start()` and completion listener to bridge back into the Phaser loader lifecycle. `this.load.spritesheet()` accepts URLs (including cross-origin S3 URLs) natively.

### 2. Material Cache for Movement System

**New file: `apps/game/src/game/services/material-cache.ts`**

```typescript
interface MaterialProperties {
  walkable: boolean;
  speedModifier: number;
  swimRequired: boolean;
  damaging: boolean;
}

// In-memory lookup, loaded once at game start
let cache: Map<string, MaterialProperties> | null = null;

export async function loadMaterialCache(): Promise<void> {
  const res = await fetch('/api/materials');
  const materials: Array<{ key: string; walkable: boolean; speedModifier: number; swimRequired: boolean; damaging: boolean }> = await res.json();
  cache = new Map(materials.map(m => [m.key, {
    walkable: m.walkable,
    speedModifier: m.speedModifier,
    swimRequired: m.swimRequired,
    damaging: m.damaging,
  }]));
}

export function getMaterialProperties(terrainKey: string): MaterialProperties {
  return cache?.get(terrainKey) ?? { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false };
}
```

Also need: `apps/game/src/app/api/materials/route.ts` — returns all material properties.

**Updated movement.ts:**
```typescript
// Before: import { getSurfaceProperties } from '@nookstead/map-lib';
// After:  import { getMaterialProperties } from '../services/material-cache';

export function getTerrainSpeedModifier(x, y, grid, tileSize): number {
  const tileX = pixelToTile(x, tileSize);
  const tileY = pixelToTile(y, tileSize);
  const terrain = grid[tileY][tileX].terrain;
  return getMaterialProperties(terrain).speedModifier;
}
```

Performance: Same O(1) Map lookup as before. `cache` is loaded once during the Loading scene.

Note: Cache is load-once — material property changes in DB require a page refresh to take effect. Acceptable for game client since material properties rarely change at runtime.

**Architectural note:** Adding `@nookstead/db` as a dependency to `apps/game` is intentional for server-side Next.js API routes. The DB is only accessed server-side, never in the browser bundle.

### 3. New Player Map Provisioning (Random DB Map)

**Updated ChunkRoom.onJoin (lines 143-176):**

```typescript
// Before: createMapGenerator(CHUNK_SIZE, CHUNK_SIZE).generate(seed)
// After: random editor map from DB

import { listEditorMaps } from '@nookstead/db';

// In the "no saved map" branch:
const editorMaps = await listEditorMaps(db, { mapType: 'player_homestead' });
if (editorMaps.length === 0) {
  client.send(ServerMessage.ERROR, { message: 'No template maps available' });
  return;
}
const template = editorMaps[Math.floor(Math.random() * editorMaps.length)];
const mapData = {
  seed: template.seed ?? Math.floor(Math.random() * 0x7fffffff),
  width: template.width,
  height: template.height,
  grid: template.grid,
  layers: template.layers,
  walkable: template.walkable,
};
// Save as this player's map
await saveMap(db, { userId, ...mapData });
```

### 4. TerrainCellType Codegen

**New file: `scripts/generate-terrain-types.ts`**

Reads all material keys from the DB and generates a TypeScript union type:

```typescript
import { createDrizzleClient, closeDrizzleClient } from '@nookstead/db';
import { listMaterials } from '@nookstead/db';
import fs from 'fs';
import path from 'path';

async function main() {
  const db = createDrizzleClient(process.env.DATABASE_URL!);
  try {
    const materials = await listMaterials(db);
    const keys = materials.map(m => `'${m.key}'`);

    const content = `// AUTO-GENERATED — do not edit manually.
// Run: pnpm generate:terrain-types
export type TerrainCellType = ${keys.join(' | ')};
`;
    const outputPath = path.resolve(__dirname, '../packages/shared/src/types/terrain-cell-type.generated.ts');
    fs.writeFileSync(outputPath, content);
    console.log(`Generated TerrainCellType with ${keys.length} materials`);
  } finally {
    await closeDrizzleClient(db);
  }
}
main();
```

Run via `npx tsx scripts/generate-terrain-types.ts` (tsx is not a direct dependency, so `npx` is required).

Then `packages/shared/src/types/map.ts` needs both an import (for local use in the `Cell` interface) and a re-export:
```typescript
import type { TerrainCellType } from './terrain-cell-type.generated';
export type { TerrainCellType } from './terrain-cell-type.generated';
```

Note: Both lines are required because `TerrainCellType` is used locally in the `Cell` interface definition within `map.ts`, and must also be exported for downstream consumers.

### 5. Genmap autotile-utils Migration

**Current:** `checkTerrainPresence(terrain, terrainKey)` uses `TERRAINS.find(t => t.key === terrainKey)` to get tileset name, then compares with cell terrain.

**Problem:** This maps tileset key → tileset name → cell terrain. After DB migration, tileset name should match the cell terrain (material key).

**Solution:** The genmap editor already loads tilesets from the API via `useTilesets()` hook. Pass the tilesets and materials through the full call chain using dedicated exported interfaces and readonly collection types:

```typescript
// Exported interfaces for type safety across the call chain:
export interface TilesetInfo {
  key: string;
  name: string;
}

export interface MaterialInfo {
  walkable: boolean;
}

// New signatures (cascade):
export function checkTerrainPresence(
  terrain: string,
  terrainKey: string,
  tilesets: ReadonlyArray<TilesetInfo>
): boolean {
  const entry = tilesets.find(t => t.key === terrainKey);
  if (!entry) return false;
  return terrain === entry.name;
}

export function computeNeighborMask(
  grid: Cell[][], x: number, y: number,
  width: number, height: number,
  terrainKey: string,
  tilesets: ReadonlyArray<TilesetInfo>  // NEW param
): number { /* passes tilesets to checkTerrainPresence */ }

export function recomputeAutotileLayers(
  grid: Cell[][],
  layers: EditorLayer[],
  affectedCells: Array<{ x: number; y: number }>,
  tilesets: ReadonlyArray<TilesetInfo>  // NEW param
): EditorLayer[] { /* passes tilesets to checkTerrainPresence and computeNeighborMask */ }
```

All callers of `computeNeighborMask` and `recomputeAutotileLayers` in the map-editor hooks must pass the `tilesets` array (available from `useTilesets()` hook).

**State threading via MapEditorState:** The `use-map-editor.ts` reducer was extended with `SET_TILESETS` and `SET_MATERIALS` actions to store tileset and material data in the editor state, making them available to all autotile and walkability functions without prop drilling through every component.

**For `isWalkable`:** Replace with material data lookup:
```typescript
export function recomputeWalkability(
  grid: Cell[][],
  width: number,
  height: number,
  materials: ReadonlyMap<string, MaterialInfo>  // NEW param
): boolean[][] {
  // Use materials.get(cell.terrain)?.walkable ?? true
}
```

Callers pass a `ReadonlyMap<string, MaterialInfo>` built from the materials API response.

### 6. map-lib/index.ts Cleanup

Remove lines 14-30 (terrain + generation exports). Keep:
- Lines 1-12: shared type re-exports + autotile engine exports
- Lines 32-42: map types, zone types, template types

### 7. shared/constants.ts Cleanup

Remove lines 86-100:
```
NOISE_OCTAVES, NOISE_LACUNARITY, NOISE_PERSISTENCE, NOISE_SCALE,
ELEVATION_EXPONENT, DEEP_WATER_THRESHOLD, WATER_THRESHOLD, MIN_WATER_BORDER
```

### 8. shared/index.ts Cleanup

Remove noise constant exports from line 36-44:
```
NOISE_OCTAVES, NOISE_LACUNARITY, NOISE_PERSISTENCE, NOISE_SCALE,
ELEVATION_EXPONENT, DEEP_WATER_THRESHOLD, WATER_THRESHOLD, MIN_WATER_BORDER
```

Remove `GenerationPass`, `LayerPass` type exports.

## Data Flow (After Migration)

```
                   ┌─────────────────────┐
                   │    PostgreSQL DB     │
                   │  materials, tilesets │
                   └─────┬───────┬───────┘
                         │       │
              ┌──────────┘       └──────────┐
              ▼                             ▼
    ┌─────────────────┐          ┌──────────────────┐
    │  apps/game API  │          │  apps/server     │
    │ GET /api/tilesets│          │  ChunkRoom       │
    │ GET /api/materials│         │  (random DB map) │
    └────────┬────────┘          └──────────────────┘
             │
    ┌────────▼────────┐
    │  Phaser Client  │
    │  Preloader      │─── loads spritesheets from S3 URLs
    │  movement.ts    │─── material cache (in-memory)
    │  Game.ts        │─── renders layers (unchanged)
    └─────────────────┘
```

## Implementation Order

1. **Create API endpoints** (`/api/tilesets`, `/api/materials` in apps/game)
2. **Create material-cache service** (in-memory lookup)
3. **Create codegen script** + run to produce `terrain-cell-type.generated.ts`
4. **Update shared/types/map.ts** to import generated TerrainCellType
5. **Migrate Preloader.ts** (fetch from API → load spritesheets from S3)
6. **Migrate movement.ts** (use material cache)
7. **Migrate ChunkRoom.ts + ChunkRoom.spec.ts** (random DB map, update tests together)
8. **Migrate autotile-utils.ts** (pass tilesets array, use material lookup, update callers)
9. **Delete deprecated files** (terrain.ts, terrain-properties.ts, generation/, mapgen/, game shims)
10. **Update map-lib/index.ts** (remove deprecated exports)
11. **Update shared/constants.ts + shared/index.ts** (remove generation constants/exports)
12. **Verify build** (`pnpm nx run-many -t lint test build typecheck`)

Note: Steps 9-11 must be done atomically (single commit) to avoid intermediate build breakage.

## Risks and Mitigation

| Risk | Mitigation |
|------|-----------|
| S3 CORS for Phaser spritesheet loading | Ensure S3/R2 bucket has CORS headers for game domain |
| No editor maps in DB for new players | Check during ChunkRoom.onJoin; return clear error |
| Async fetch in Preloader may fail | Add error handling + retry in Loading scene |
| Generated TerrainCellType out of sync | Add npm script `generate:terrain-types`; document in README |
| Movement regression from material cache miss | Default to `speedModifier: 1.0` for unknown terrains |
