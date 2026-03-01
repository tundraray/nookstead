import type { Cell, CollisionZoneDef } from '@nookstead/shared';
import type { MaterialInfo } from '../types/material-types';

/**
 * Recompute the walkability grid from terrain data.
 *
 * For each cell, looks up walkability from the provided materials map.
 * Terrains not found in the map default to walkable (true).
 *
 * Returns a new `boolean[][]` array (immutable -- never mutates inputs).
 *
 * @param grid - The 2D cell grid (indexed as grid[y][x]).
 * @param width - Grid width in cells.
 * @param height - Grid height in cells.
 * @param materials - Map from terrain name to material info for walkability lookup.
 * @returns A 2D boolean array where `true` means walkable.
 */
export function recomputeWalkability(
  grid: Cell[][],
  width: number,
  height: number,
  materials: ReadonlyMap<string, MaterialInfo>,
): boolean[][] {
  const walkable: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(materials.get(grid[y][x].terrain)?.walkable ?? true);
    }
    walkable.push(row);
  }
  return walkable;
}

/**
 * Apply object collision zones to a walkability grid.
 *
 * Mutates the `walkable` grid in place. Two passes are performed:
 *   1. Collision zones (`type: 'collision'`) mark overlapping cells as non-walkable (false).
 *   2. Walkable zones (`type: 'walkable'`) mark overlapping cells as walkable (true),
 *      overriding both terrain and collision zones.
 *
 * Objects whose `objectId` is not found in `objectDefinitions` are skipped.
 * All pixel-to-tile conversions are clamped to valid grid bounds.
 *
 * @param walkable - Mutable 2D boolean grid (indexed as walkable[y][x]).
 * @param placedObjects - Array of placed objects with objectId and grid position.
 * @param objectDefinitions - Map from objectId to its collision zone definitions.
 * @param tileSize - Tile size in pixels.
 */
export function applyObjectCollisionZones(
  walkable: boolean[][],
  placedObjects: Array<{ objectId: string; gridX: number; gridY: number }>,
  objectDefinitions: Map<
    string,
    { collisionZones: CollisionZoneDef[] }
  >,
  tileSize: number,
): void {
  const height = walkable.length;
  if (height === 0) return;
  const width = walkable[0].length;
  if (width === 0) return;

  // First pass: collision zones (mark cells as non-walkable)
  for (const obj of placedObjects) {
    const def = objectDefinitions.get(obj.objectId);
    if (!def) continue;

    for (const zone of def.collisionZones) {
      if (zone.type !== 'collision') continue;

      const pixelStartX = obj.gridX * tileSize + zone.x;
      const pixelStartY = obj.gridY * tileSize + zone.y;
      const pixelEndX = pixelStartX + zone.width;
      const pixelEndY = pixelStartY + zone.height;

      const tileStartX = Math.max(0, Math.floor(pixelStartX / tileSize));
      const tileStartY = Math.max(0, Math.floor(pixelStartY / tileSize));
      const tileEndX = Math.min(width, Math.ceil(pixelEndX / tileSize));
      const tileEndY = Math.min(height, Math.ceil(pixelEndY / tileSize));

      for (let y = tileStartY; y < tileEndY; y++) {
        for (let x = tileStartX; x < tileEndX; x++) {
          walkable[y][x] = false;
        }
      }
    }
  }

  // Second pass: walkable zones (override to walkable)
  for (const obj of placedObjects) {
    const def = objectDefinitions.get(obj.objectId);
    if (!def) continue;

    for (const zone of def.collisionZones) {
      if (zone.type !== 'walkable') continue;

      const pixelStartX = obj.gridX * tileSize + zone.x;
      const pixelStartY = obj.gridY * tileSize + zone.y;
      const pixelEndX = pixelStartX + zone.width;
      const pixelEndY = pixelStartY + zone.height;

      const tileStartX = Math.max(0, Math.floor(pixelStartX / tileSize));
      const tileStartY = Math.max(0, Math.floor(pixelStartY / tileSize));
      const tileEndX = Math.min(width, Math.ceil(pixelEndX / tileSize));
      const tileEndY = Math.min(height, Math.ceil(pixelEndY / tileSize));

      for (let y = tileStartY; y < tileEndY; y++) {
        for (let x = tileStartX; x < tileEndX; x++) {
          walkable[y][x] = true;
        }
      }
    }
  }
}
