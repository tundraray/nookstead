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
- **CRITICAL BUG: tilesetKeys never initialized on production layers**: createDefaultLayer() and normalizeLayer() in use-map-editor.ts create layers WITHOUT tilesetKeys array. RetileEngine.writeToLayers() only writes if tilesetKeys?.[y] exists. Result: engine's per-cell tileset selection is discarded. Renderer falls back to baseTilesetKey from MaterialInfo.
- **Test-vs-production data gap**: All test files (retile-engine.spec.ts, .integration.spec.ts, routing-commands.spec.ts) create layers WITH tilesetKeys. Production layers never have it. Design doc line 297 says "New system always populates tilesetKeys" but this was not implemented in the editor hooks.

## Key Findings (2026-02-23)
- **tilesetKeys NOW initialized in production**: createDefaultLayer and normalizeLayer both create tilesetKeys via createEmptyTilesetKeys. Previous finding about missing tilesetKeys is SUPERSEDED.
- **Asymmetric transition tilesets**: Reference data has deep_water->water but NOT water->deep_water. This is by design per design-015 Worked Example 3.
- **FG-only mask issue**: computeNeighborMaskByMaterial uses exact string matching. Water surrounded by deep_water gets mask=0 (isolated) or partial mask (corridor). This is documented as "Invariant 2" but causes visual problems when painting water directly on deep_water.
- **Design doc acknowledges limitation**: Line 1681 of design-015: "Ideally water should show deep_water at its W edge, but without a water_deep-water tileset, the system degrades gracefully to grass."
- **Most integration tests are TODO stubs**: retile-engine.spec.ts, retile-engine.integration.spec.ts, routing-pipeline.integration.spec.ts, cell-tileset-selector.spec.ts all have TODO test bodies. Only routing-commands.spec.ts has real tests.
- **Extra args passed to computeCellFrame**: retile-engine.ts passes bg and routingTable to computeCellFrame which only accepts 6 params. Extra args silently ignored at JS runtime. TypeScript typecheck passes (extra args not an error in TS).

## Previous Findings (2026-02-21) - Partially Superseded
- checkTerrainPresence semantic mismatch still exists but is no longer in the production autotile path
- buildTransitionMap now uses material keys (not UUIDs) after buildMapEditorData resolves them
- state.tilesets and state.materials now populated via SET_TILESETS/SET_MATERIALS before LOAD_MAP

## Key Findings (2026-03-02) - Movement Sync Investigation
- **Multiplayer architecture**: apps/server (Colyseus) + apps/game (Phaser) + packages/shared (types/constants)
- **Movement flow**: InputController -> WalkState -> calculateMovement() -> setPosition() + room.send(MOVE, {dx,dy}) -> World.movePlayer() -> ChunkPlayer schema -> Colyseus patch -> onChange -> reconcile()
- **PATCH_RATE_MS=100ms**, CORRECTION_THRESHOLD=8px, INTERPOLATION_SPEED=0.2 (per-frame, NOT delta-time-based)
- **Displacement-reconciliation fight**: Newly added displacement (b176290) snaps to walkable, reconcile() snaps back to authoritative (possibly non-walkable). No server notification from displacement.
- **Frame-dependent reconciliation**: Player.preUpdate uses `position += delta * 0.2` (per-frame). PlayerSprite uses `t = elapsed/100` (time-based). Inconsistent approaches.
- **No input queueing**: Server processes MOVE immediately, no fixedTick pattern. Client sends 60 msgs/sec.
- **No server walkability**: TODO comment in ChunkRoom.ts. Server trusts client dx/dy blindly.
- **MAX_SPEED defined but unused**: Never imported by server code.
- **POSITION_UPDATE message unused**: Defined but never sent or handled.
- **Arcade Physics conflict**: physics.add.existing(player) + collider registered, but movement uses setPosition().
- **No animState on ChunkPlayer**: Remote player animation derived client-side from position comparison (unreliable).

## File Reference
- [patterns.md](patterns.md) - Detailed patterns and domain mismatch analysis
- [movement-sync.md](movement-sync.md) - Detailed movement synchronization investigation notes
