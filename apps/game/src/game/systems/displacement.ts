/**
 * Displacement utility for relocating entities off non-walkable tiles.
 *
 * Pure function — no Phaser dependency.
 */

/**
 * Spiral search outward from (cx, cy) for the nearest walkable tile.
 *
 * Scans only the perimeter of each expanding ring so inner tiles
 * already checked at smaller radii are skipped.
 *
 * @param cx - Center tile X coordinate.
 * @param cy - Center tile Y coordinate.
 * @param walkable - Walkability grid (row-major [y][x]).
 * @param mapWidth - Map width in tiles.
 * @param mapHeight - Map height in tiles.
 * @param maxRadius - Maximum search radius in tiles (default 10).
 * @returns The nearest walkable tile coordinates, or null if none found.
 */
export function findNearestWalkable(
  cx: number,
  cy: number,
  walkable: boolean[][],
  mapWidth: number,
  mapHeight: number,
  maxRadius = 10,
): { tileX: number; tileY: number } | null {
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // perimeter only
        const tx = cx + dx;
        const ty = cy + dy;
        if (
          tx >= 0 &&
          tx < mapWidth &&
          ty >= 0 &&
          ty < mapHeight &&
          walkable[ty]?.[tx]
        ) {
          return { tileX: tx, tileY: ty };
        }
      }
    }
  }
  return null;
}
