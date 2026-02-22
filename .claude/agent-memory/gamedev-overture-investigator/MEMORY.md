# Investigator Agent Memory

## Project Architecture
- Nx monorepo: apps/genmap (Next.js editor), packages/map-lib (pure algorithms), packages/db (Drizzle + PostgreSQL)
- map-lib uses zero-build pattern (exports TS source directly, no dist/)
- Autotile system: computeNeighborMaskByPriority OR computeNeighborMaskByMaterial -> getFrame
- Canvas rendering: per-cell baseTilesetKey lookup via materials.get(terrain) -> tilesetImages.get(key) -> draws frames
- Old system (checkTerrainPresence -> computeNeighborMask) still exported but NOT used in production pipeline

## Key Findings (2026-02-22)
- **Design-014 rename COMPLETE**: activeTerrainKey->activeMaterialKey, SET_TERRAIN->SET_MATERIAL, setTerrain->setMaterial all done. Zero old references remain.
- **resolvePaint simplified correctly**: No layer creation, returns grid+affectedCells+warnings. Tests pass (114/114).
- **resolvePaint is DEAD CODE in production**: Tools bypass it, create CellDelta directly -> PaintCommand -> applyDeltas.
- **Pipeline IS wired end-to-end**: Palette->SET_MATERIAL->activeMaterialKey->tools->CellDelta->PaintCommand->applyDeltas->recomputeAutotileLayers->renderer. All connections present.
- **buildMapEditorData resolves UUIDs**: New map-editor-data.ts correctly resolves fromMaterialId UUIDs to material keys via materialIdToKey map.
- **baseTilesetKey assignment risk**: buildMapEditorData picks FIRST tileset with matching fromMaterialKey, which could be a transition tileset instead of standalone. Depends on DB iteration order.
- **TerrainCellType union still mixed**: Contains both material keys ('grass') and tileset names ('water_grass'). `as Cell['terrain']` casts bypass type safety in multiple locations.
- **Old functions still exported**: checkTerrainPresence, computeNeighborMask exported from map-lib and imported in autotile-utils.ts shim. Not used in production autotile pipeline.

## Previous Findings (2026-02-21) - Partially Superseded
- checkTerrainPresence semantic mismatch still exists but is no longer in the production autotile path
- buildTransitionMap now uses material keys (not UUIDs) after buildMapEditorData resolves them
- state.tilesets and state.materials now populated via SET_TILESETS/SET_MATERIALS before LOAD_MAP

## File Reference
- [patterns.md](patterns.md) - Detailed patterns and domain mismatch analysis
