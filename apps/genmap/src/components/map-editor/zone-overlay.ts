import type { ZoneData } from '@nookstead/map-lib';
import { ZONE_COLORS } from '@nookstead/map-lib';
import type { Camera } from './canvas-renderer';

export interface ZoneOverlayParams {
  ctx: CanvasRenderingContext2D;
  zones: ZoneData[];
  selectedZoneId: string | null;
  tileSize: number;
  camera: Camera;
}

/** Convert hex color string to rgba with given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

/** Draw all zone overlays on the canvas. */
export function drawZoneOverlay({
  ctx,
  zones,
  selectedZoneId,
  tileSize,
  camera,
}: ZoneOverlayParams): void {
  ctx.save();

  for (const zone of zones) {
    const color = ZONE_COLORS[zone.zoneType] ?? '#888888';
    const isSelected = zone.id === selectedZoneId;

    if (zone.shape === 'rectangle' && zone.bounds) {
      const px = (zone.bounds.x * tileSize - camera.x) * camera.zoom;
      const py = (zone.bounds.y * tileSize - camera.y) * camera.zoom;
      const pw = zone.bounds.width * tileSize * camera.zoom;
      const ph = zone.bounds.height * tileSize * camera.zoom;

      // Fill
      ctx.fillStyle = hexToRgba(color, 0.3);
      ctx.fillRect(px, py, pw, ph);

      // Border (selected = full opacity + thicker, others = subtle)
      if (isSelected) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pw, ph);
      }

      // Label
      drawZoneLabel(ctx, zone.name, px + pw / 2, py + ph / 2);
    } else if (zone.shape === 'polygon' && zone.vertices && zone.vertices.length >= 3) {
      ctx.beginPath();
      const first = zone.vertices[0];
      const fx = (first.x * tileSize - camera.x) * camera.zoom;
      const fy = (first.y * tileSize - camera.y) * camera.zoom;
      ctx.moveTo(fx, fy);

      let sumX = fx;
      let sumY = fy;

      for (let i = 1; i < zone.vertices.length; i++) {
        const v = zone.vertices[i];
        const vx = (v.x * tileSize - camera.x) * camera.zoom;
        const vy = (v.y * tileSize - camera.y) * camera.zoom;
        ctx.lineTo(vx, vy);
        sumX += vx;
        sumY += vy;
      }
      ctx.closePath();

      // Fill
      ctx.fillStyle = hexToRgba(color, 0.3);
      ctx.fill();

      // Border
      if (isSelected) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label at centroid
      const cx = sumX / zone.vertices.length;
      const cy = sumY / zone.vertices.length;
      drawZoneLabel(ctx, zone.name, cx, cy);
    }
  }

  ctx.restore();
}

/** Draw a centered zone name label. */
function drawZoneLabel(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number
): void {
  ctx.save();
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(name, x + 1, y + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, x, y);
  ctx.restore();
}
