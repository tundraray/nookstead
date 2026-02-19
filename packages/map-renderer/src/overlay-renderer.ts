import type { Scene } from 'phaser';
import type { ZoneData } from '@nookstead/map-lib';
import { ZONE_COLORS } from '@nookstead/map-lib';

/**
 * Render a walkability overlay: green for walkable, red for non-walkable tiles.
 */
export function renderWalkabilityOverlay(
  scene: Scene,
  walkable: boolean[][],
  tileSize: number,
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  const height = walkable.length;
  const width = walkable[0]?.length ?? 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = walkable[y][x] ? 0x00ff00 : 0xff0000;
      gfx.fillStyle(color, 0.3);
      gfx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  return gfx;
}

/**
 * Render zone overlays with colors from ZONE_COLORS.
 */
export function renderZoneOverlay(
  scene: Scene,
  zones: ZoneData[],
  tileSize: number,
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();

  for (const zone of zones) {
    const colorHex = ZONE_COLORS[zone.zoneType];
    const color = parseInt(colorHex.replace('#', ''), 16);

    if (zone.shape === 'rectangle' && zone.bounds) {
      gfx.fillStyle(color, 0.3);
      gfx.fillRect(
        zone.bounds.x * tileSize,
        zone.bounds.y * tileSize,
        zone.bounds.width * tileSize,
        zone.bounds.height * tileSize,
      );
      gfx.lineStyle(2, color, 0.8);
      gfx.strokeRect(
        zone.bounds.x * tileSize,
        zone.bounds.y * tileSize,
        zone.bounds.width * tileSize,
        zone.bounds.height * tileSize,
      );
    } else if (zone.shape === 'polygon' && zone.vertices && zone.vertices.length >= 3) {
      const points = zone.vertices.map((v) => ({
        x: v.x * tileSize,
        y: v.y * tileSize,
      }));

      gfx.fillStyle(color, 0.3);
      gfx.beginPath();
      gfx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        gfx.lineTo(points[i].x, points[i].y);
      }
      gfx.closePath();
      gfx.fillPath();

      gfx.lineStyle(2, color, 0.8);
      gfx.beginPath();
      gfx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        gfx.lineTo(points[i].x, points[i].y);
      }
      gfx.closePath();
      gfx.strokePath();
    }
  }

  return gfx;
}

/**
 * Remove an overlay graphics object from the scene.
 */
export function clearOverlay(overlay: Phaser.GameObjects.Graphics): void {
  overlay.clear();
  overlay.destroy();
}
