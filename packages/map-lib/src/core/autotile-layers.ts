import type { Cell } from '@nookstead/shared';
import { N, NE, E, SE, S, SW, W, NW, getFrame, EMPTY_FRAME, SOLID_FRAME } from './autotile';
import { NEIGHBOR_OFFSETS, computeNeighborMaskByMaterial, computeTransitionMask } from './neighbor-mask';
import type { EditorLayer } from '../types/editor-types';
import type { MaterialInfo, TilesetInfo } from '../types/material-types';

// --- Debug logging ---
const DEBUG_AUTOTILE = typeof window !== 'undefined';

const DIR_NAMES: Array<[number, string]> = [
  [N, 'N'], [NE, 'NE'], [E, 'E'], [SE, 'SE'],
  [S, 'S'], [SW, 'SW'], [W, 'W'], [NW, 'NW'],
];

function maskToStr(m: number): string {
  const dirs = DIR_NAMES.filter(([bit]) => (m & bit) !== 0).map(([, name]) => name);
  return dirs.length === 8 ? `ALL(255)` : dirs.length === 0 ? `NONE(0)` : `${dirs.join('|')}(${m})`;
}

function neighborMapStr(grid: Cell[][], x: number, y: number, w: number, h: number): string {
  const parts: string[] = [];
  for (const [dx, dy, bit] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    const dirName = DIR_NAMES.find(([b]) => b === bit)?.[1] ?? '?';
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
      parts.push(`${dirName}=OOB`);
    } else {
      parts.push(`${dirName}=${grid[ny][nx].terrain || '(empty)'}`);
    }
  }
  return parts.join(', ');
}

/**
 * Build a lookup map from material pair to tileset key.
 * Key format: "fromMaterial:toMaterial" → tileset key.
 */
function buildTilesetPairMap(
  tilesets: ReadonlyArray<TilesetInfo>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const ts of tilesets) {
    if (ts.fromMaterialKey && ts.toMaterialKey) {
      const fwd = `${ts.fromMaterialKey}:${ts.toMaterialKey}`;
      if (!map.has(fwd)) map.set(fwd, ts.key);
    }
  }
  return map;
}

/**
 * Find the most common non-same-material neighbor around a cell.
 * Used to determine which tileset to use for the transition.
 */
function findDominantNeighbor(
  grid: Cell[][],
  x: number,
  y: number,
  width: number,
  height: number,
  cellTerrain: string,
): string | undefined {
  const counts = new Map<string, number>();

  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

    const neighborTerrain = grid[ny][nx].terrain;
    if (!neighborTerrain || neighborTerrain === cellTerrain) continue;

    counts.set(neighborTerrain, (counts.get(neighborTerrain) ?? 0) + 1);
  }

  let best: string | undefined;
  let bestCount = 0;
  for (const [mat, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = mat;
    }
  }

  return best;
}

/**
 * Find a tileset via an intermediate material when no direct pair exists.
 *
 * If there is no tileset for `cellMaterial:neighborMaterial`, look for an
 * intermediate material B such that `cellMaterial:B` exists AND either
 * `B:neighborMaterial` or `neighborMaterial:B` exists. Returns the tileset
 * key for `cellMaterial:B`.
 *
 * Example: deep_water next to grass with no `deep_water:grass` tileset.
 * If `deep_water:water` and `water:grass` both exist, returns the key for
 * `deep_water:water`. The grass side will similarly resolve to `water:grass`,
 * so the seam renders water from both sides — a visually clean transition.
 */
function findIndirectTileset(
  cellMaterial: string,
  neighborMaterial: string,
  tilesets: ReadonlyArray<TilesetInfo>,
  pairMap: ReadonlyMap<string, string>,
): { key: string; reverse: boolean } | undefined {
  for (const ts of tilesets) {
    if (!ts.fromMaterialKey || !ts.toMaterialKey) continue;

    // Path 1: ts starts from cellMaterial
    if (ts.fromMaterialKey === cellMaterial) {
      const intermediate = ts.toMaterialKey;
      if (
        pairMap.has(`${intermediate}:${neighborMaterial}`) ||
        pairMap.has(`${neighborMaterial}:${intermediate}`)
      ) {
        return { key: ts.key, reverse: false };
      }
    }

    // Path 2: ts ends in cellMaterial (reverse transition)
    if (ts.toMaterialKey === cellMaterial) {
      const intermediate = ts.fromMaterialKey;
      if (
        pairMap.has(`${intermediate}:${neighborMaterial}`) ||
        pairMap.has(`${neighborMaterial}:${intermediate}`)
      ) {
        return { key: ts.key, reverse: true };
      }
    }
  }
  return undefined;
}

/**
 * Recompute autotile frames and per-cell tileset keys for affected cells
 * after a paint operation.
 *
 * For each affected cell, recalculates the cell and its 8 neighbors.
 * Uses a Set to deduplicate cells when multiple affected cells share neighbors.
 *
 * Mask computation uses direct material string comparison — a neighbor
 * "matches" when it has the same material. The tileset for each cell is
 * determined by the pair (cellMaterial, dominantNeighborMaterial).
 *
 * Returns a new layers array with updated frames and tilesetKeys.
 *
 * @param grid - The 2D cell grid (indexed as grid[y][x]).
 * @param layers - Current editor layers with autotile frame data.
 * @param affectedCells - Coordinates of cells whose terrain changed.
 * @param materials - Material lookup map (used for baseTilesetKey fallback).
 * @param paintedCells - Optional set of "x,y" keys for cells that were directly
 *   painted. Used by the skip optimization to identify same-material neighbors.
 *   (Note: the "Solid Block Rule" that forced painted cells to SOLID_FRAME is
 *   currently disabled — all cells compute their mask normally.)
 * @param tilesets - Tileset descriptors for pair-based tileset lookup (optional).
 * @returns A new layers array with updated frame indices and tileset keys.
 */
export function recomputeAutotileLayers(
  grid: Cell[][],
  layers: EditorLayer[],
  affectedCells: ReadonlyArray<{ x: number; y: number }>,
  materials: ReadonlyMap<string, MaterialInfo> = new Map(),
  paintedCells?: ReadonlySet<string>,
  tilesets?: ReadonlyArray<TilesetInfo>,
): EditorLayer[] {
  if (affectedCells.length === 0) return layers;

  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return layers;

  const pairMap = tilesets && tilesets.length > 0
    ? buildTilesetPairMap(tilesets)
    : new Map<string, string>();

  // Collect the set of all cells that need recalculation
  // (affected cells + their 8 neighbors = up to 9 cells per affected cell)
  const recalcSet = new Set<string>();

  for (const { x, y } of affectedCells) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          recalcSet.add(`${nx},${ny}`);
        }
      }
    }
  }

  // Determine the material being painted (from the first affected cell).
  // Used to skip same-material neighbors that don't need recalculation.
  const paintedMaterialKey = paintedCells && affectedCells.length > 0
    ? grid[affectedCells[0].y][affectedCells[0].x].terrain
    : null;

  // Update frames and tilesetKeys for each layer for each cell in the recalc set
  return layers.map((layer) => {
    // Skip object layers (they have no frames array)
    if (!layer.frames) return layer;

    const newFrames = layer.frames.map((row) => [...row]);
    const newTilesetKeys = layer.tilesetKeys
      ? layer.tilesetKeys.map((row) => [...row])
      : newFrames.map((row) => row.map(() => ''));

    for (const key of recalcSet) {
      const [xStr, yStr] = key.split(',');
      const cx = parseInt(xStr, 10);
      const cy = parseInt(yStr, 10);

      const cellTerrain = grid[cy][cx].terrain;

      if (!cellTerrain) {
        newFrames[cy][cx] = EMPTY_FRAME;
        newTilesetKeys[cy][cx] = '';
        continue;
      }

      const mat = materials.get(cellTerrain);
      const baseTsKey = mat?.baseTilesetKey ?? '';

      // Skip neighbors with the same material as what was painted —
      // they already have correct frames and don't need recalculation.
      // Only skip when: (a) we know the painted material, (b) the cell
      // was NOT directly painted, (c) it has the same material,
      // (d) it already has SOLID_FRAME, AND (e) tilesetKey already
      // matches baseTsKey. Condition (e) prevents preserving stale
      // pair keys — a cell can reach SOLID_FRAME via reverse pair
      // (~0 & 0xFF = 255) with a transition tilesetKey; if neighbors
      // later change, it must be recalculated to get baseTsKey.
      // When paintedCells is null (e.g. undo), recalculate everything.
      if (
        paintedMaterialKey &&
        !paintedCells!.has(key) &&
        cellTerrain === paintedMaterialKey &&
        newFrames[cy][cx] === SOLID_FRAME &&
        newTilesetKeys[cy][cx] === baseTsKey
      ) {
        continue;
      }

      // Solid Block Rule disabled — painted cells compute mask normally.
      // if (paintedCells?.has(key)) {
      //   newFrames[cy][cx] = SOLID_FRAME;
      //   newTilesetKeys[cy][cx] = baseTsKey;
      //   continue;
      // }

      // Mask: neighbor matches when it has the same material
      const mask = computeNeighborMaskByMaterial(
        grid, cx, cy, width, height, cellTerrain,
      );

      // Tileset + frame: find the pair (cellMaterial, dominantNeighbor)
      if (mask === 255) {
        // SOLID: all neighbors are same material — use base tileset
        newTilesetKeys[cy][cx] = baseTsKey;
        newFrames[cy][cx] = getFrame(mask);
      } else {
        const target = findDominantNeighbor(
          grid, cx, cy, width, height, cellTerrain,
        );
        if (target) {
          // Target-specific mask: bit=0 only where neighbor IS target.
          // Other foreign materials get bit=1 (no transition on that side).
          // When only one foreign material exists, tMask === mask.
          const tMask = computeTransitionMask(
            grid, cx, cy, width, height, target,
          );

          const fwdKey = `${cellTerrain}:${target}`;
          const revKey = `${target}:${cellTerrain}`;

          // --- Debug: collect foreign neighbor counts ---
          let debugResolve = '';
          if (DEBUG_AUTOTILE) {
            const foreignCounts = new Map<string, number>();
            for (const [dx, dy] of NEIGHBOR_OFFSETS) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const nt = grid[ny][nx].terrain;
              if (nt && nt !== cellTerrain) {
                foreignCounts.set(nt, (foreignCounts.get(nt) ?? 0) + 1);
              }
            }
            const foreignStr = [...foreignCounts.entries()]
              .map(([m, c]) => `${m}(${c})`)
              .join(', ');
            const multiForeign = foreignCounts.size > 1;

            console.log(
              `[autotile] (${cx},${cy}) mat=${cellTerrain} | ` +
              `neighbors: ${neighborMapStr(grid, cx, cy, width, height)}\n` +
              `  foreign: [${foreignStr}]${multiForeign ? ' *** MULTI-FOREIGN ***' : ''}\n` +
              `  target=${target} | mask=${maskToStr(mask)} | tMask=${maskToStr(tMask)}` +
              (mask !== tMask ? ` *** DIFFERS ***` : '') +
              `\n  fwdKey="${fwdKey}" revKey="${revKey}"`,
            );
          }

          if (pairMap.has(fwdKey)) {
            newTilesetKeys[cy][cx] = pairMap.get(fwdKey)!;
            newFrames[cy][cx] = getFrame(tMask);
            if (DEBUG_AUTOTILE) {
              debugResolve = `FWD pair → ts="${pairMap.get(fwdKey)}" frame=${getFrame(tMask)}`;
            }
          } else if (pairMap.has(revKey)) {
            newTilesetKeys[cy][cx] = pairMap.get(revKey)!;
            newFrames[cy][cx] = getFrame((~tMask) & 0xFF);
            if (DEBUG_AUTOTILE) {
              debugResolve = `REV pair → ts="${pairMap.get(revKey)}" invMask=${maskToStr((~tMask) & 0xFF)} frame=${getFrame((~tMask) & 0xFF)}`;
            }
          } else {
            const indirect = tilesets
              ? findIndirectTileset(cellTerrain, target, tilesets, pairMap)
              : undefined;
            if (indirect) {
              newTilesetKeys[cy][cx] = indirect.key;
              newFrames[cy][cx] = indirect.reverse ? getFrame((~tMask) & 0xFF) : getFrame(tMask);
              if (DEBUG_AUTOTILE) {
                debugResolve = `INDIRECT ${indirect.reverse ? '(rev)' : '(fwd)'} → ts="${indirect.key}" frame=${indirect.reverse ? getFrame((~tMask) & 0xFF) : getFrame(tMask)}`;
              }
            } else {
              newTilesetKeys[cy][cx] = baseTsKey;
              newFrames[cy][cx] = getFrame(tMask);
              if (DEBUG_AUTOTILE) {
                debugResolve = `FALLBACK → baseTsKey="${baseTsKey}" frame=${getFrame(tMask)}`;
              }
            }
          }

          if (DEBUG_AUTOTILE) {
            console.log(`  resolve: ${debugResolve}\n`);
          }
        } else {
          newTilesetKeys[cy][cx] = baseTsKey;
          newFrames[cy][cx] = getFrame(mask);
          if (DEBUG_AUTOTILE) {
            console.log(
              `[autotile] (${cx},${cy}) mat=${cellTerrain} | no dominant neighbor | ` +
              `mask=${maskToStr(mask)} → baseTsKey="${baseTsKey}" frame=${getFrame(mask)}\n`,
            );
          }
        }
      }
    }

    return { ...layer, frames: newFrames, tilesetKeys: newTilesetKeys };
  });
}
