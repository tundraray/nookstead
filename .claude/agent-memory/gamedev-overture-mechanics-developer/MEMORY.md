# Mechanics Developer Agent Memory

## Project Architecture

- Nx monorepo, pnpm workspaces, TypeScript strict mode
- Shared types: `packages/shared/src/types/map.ts`
- Map engine: `packages/map-lib/src/core/` (autotile, terrain, terrain-properties)
- DB schemas: `packages/db/src/schema/` (Drizzle ORM, PostgreSQL)
- Game client: `apps/game/` (Next.js + Phaser 3)
- Map editor: `apps/genmap/` (Next.js, HTML Canvas rendering)
- Tile size: 16x16, Frame size: 16x16

## Autotile System (Blob-47)

- 8-neighbor bitmask: N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128
- Diagonal gating: diagonals only count when both adjacent cardinals present
- 48 frames per terrain (12 cols x 4 rows), frame 0 = empty, frame 1 = solid, frame 47 = isolated
- Terrain tilesets: 192x64 PNG
- `getFrame(neighbors)` -> frame index (0-47)

## Fence System (ADR-0010, design-012)

- 4-cardinal bitmask: N=1, E=2, S=4, W=8 (compact, no diagonals)
- 16 connection states, bitmask IS the frame index (offset +1 for empty sentinel)
- Virtual tileset: 4 cols x 5 rows (64x80), generated from atlas frames at load time
- Gate frames: 4 variants (vertical/horizontal x open/closed) at indices 17-20
- Gate placement constraint: only on NS (bitmask=5) or EW (bitmask=10) corridors
- Each fence layer = single fence type (like terrain layers)
- DB table: `fence_types` with JSONB frame_mapping and gate_frame_mapping
- Rendering: RenderTexture stamping (same as terrain)
- See: `docs/design/design-012-fence-system.md`

## Rendering Pipeline

- Game.ts: RenderTexture stamping (terrain layers, then fence layers)
- canvas-renderer.ts: HTML Canvas drawImage with viewport culling
- Layer order: terrain -> fences -> sprites
- Terrain tileset srcRect: `srcX = (frame % 12) * 16, srcY = floor(frame / 12) * 16`
- Fence tileset srcRect: `srcX = ((frame-1) % 4) * 16, srcY = floor((frame-1) / 4) * 16`

## DB Patterns

- UUID primary keys, timezone-aware timestamps
- JSONB for flexible data (frame mappings, collision zones, metadata)
- Materials table: walkable, speedModifier, swimRequired, damaging
- Atlas frames: individual frame coords within sprite atlas images
- Tilesets: S3 storage, from_material/to_material FKs

## Project

- [Economy system plan](./project_economy_system.md) - Plan for coins/economy, first gameplay system. 2026-03-14.
