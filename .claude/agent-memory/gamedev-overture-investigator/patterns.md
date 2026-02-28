# Nookstead Map Editor - Domain Mismatch Pattern

## The Four String Domains
The map editor has four semantically distinct string domains that are frequently confused:

| Domain | Example | Used In |
|--------|---------|---------|
| Material Key | "grass", "deep_water" | cell.terrain, state.activeMaterialKey, MaterialInfo.key |
| Tileset Key | "terrain-01", "terrain-03" | layer.terrainKey, tilesetImages Map key, TilesetInfo.key |
| Tileset Name | "Dirt Light Grass", "water_grass" | TilesetInfo.name (DB display name, formatted) |
| Material UUID | "a1b2c3d4-..." | DB materials.id, DB tilesets.fromMaterialId/toMaterialId |

## TerrainCellType Union (Fifth Domain)
- Generated file: packages/shared/src/types/terrain-cell-type.generated.ts
- Contains a MIX of tileset names AND some material keys
- e.g., 'dirt_light_grass' (tileset name), 'grass' (material key), 'water_grass' (tileset name)
- This union was generated from old hardcoded terrain definitions before DB migration

## checkTerrainPresence Mismatch
- Located in: packages/map-lib/src/core/neighbor-mask.ts
- Compares cell.terrain (Material Key) against tileset.name (Tileset Name)
- These NEVER match in production data
- Test fixtures use matching values (tileset name = material key), masking the bug

## baseTilesetKey Population
- Located in: apps/genmap/src/app/(editor)/maps/[id]/page.tsx
- Only populates when fromMaterialId === toMaterialId (self-referencing tileset)
- No such tilesets exist in the seed data
- Result: all palette swatches show color fallback

## buildTransitionMap UUID Mismatch
- Located in: packages/map-lib/src/core/material-resolver.ts
- Uses TilesetInfo.fromMaterialId (UUID) as key in materials map (keyed by material key)
- materials.has(uuid) always returns false
- Produces empty TransitionMap
- Not called in production paint flow (only in tests)
