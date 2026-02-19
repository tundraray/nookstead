import type { MapEditorState } from '@/hooks/map-editor-types';

/** Camera state for viewport positioning and zoom. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Canvas rendering configuration. */
export interface CanvasConfig {
  tileSize: number;
  showGrid: boolean;
}

/** Rectangle preview for the rectangle fill tool. */
export interface PreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Core canvas rendering function.
 * Renders the terrain grid using tileset sprite sheets loaded as HTMLImageElement.
 * Implements viewport culling to only render visible tiles.
 */
export function renderMapCanvas(
  ctx: CanvasRenderingContext2D,
  state: MapEditorState,
  tilesetImages: Map<string, HTMLImageElement>,
  camera: Camera,
  config: CanvasConfig,
  cursorTile: { x: number; y: number } | null,
  previewRect: PreviewRect | null
): void {
  const { tileSize } = config;
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const { zoom } = camera;

  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw dark background for out-of-bounds area
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  // Disable image smoothing for crisp pixel art
  ctx.imageSmoothingEnabled = false;

  // Calculate visible tile range for viewport culling
  const startX = Math.max(0, Math.floor(camera.x / tileSize));
  const startY = Math.max(0, Math.floor(camera.y / tileSize));
  const endX = Math.min(
    state.width,
    Math.ceil((camera.x + canvasWidth / zoom) / tileSize)
  );
  const endY = Math.min(
    state.height,
    Math.ceil((camera.y + canvasHeight / zoom) / tileSize)
  );

  // Draw map background (slightly lighter than out-of-bounds)
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, state.width * tileSize, state.height * tileSize);

  // Render each visible layer
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    ctx.globalAlpha = layer.opacity;
    const img = tilesetImages.get(layer.terrainKey);
    if (!img) continue;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const frame = layer.frames[y][x];
        if (frame === 0) continue; // EMPTY_FRAME, skip

        // Calculate source position in tileset (12 cols, 16x16 frames)
        const srcX = (frame % 12) * 16;
        const srcY = Math.floor(frame / 12) * 16;

        ctx.drawImage(
          img,
          srcX,
          srcY,
          16,
          16,
          x * tileSize,
          y * tileSize,
          tileSize,
          tileSize
        );
      }
    }
  }

  ctx.globalAlpha = 1.0;

  // Grid overlay
  if (config.showGrid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1 / zoom;

    for (let x = startX; x <= endX; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tileSize, startY * tileSize);
      ctx.lineTo(x * tileSize, endY * tileSize);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y++) {
      ctx.beginPath();
      ctx.moveTo(startX * tileSize, y * tileSize);
      ctx.lineTo(endX * tileSize, y * tileSize);
      ctx.stroke();
    }
  }

  // Preview rectangle overlay (for rectangle tool)
  if (previewRect) {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.fillRect(
      previewRect.x * tileSize,
      previewRect.y * tileSize,
      previewRect.width * tileSize,
      previewRect.height * tileSize
    );
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(
      previewRect.x * tileSize,
      previewRect.y * tileSize,
      previewRect.width * tileSize,
      previewRect.height * tileSize
    );
  }

  // Cursor tile highlight
  if (
    cursorTile &&
    cursorTile.x >= 0 &&
    cursorTile.x < state.width &&
    cursorTile.y >= 0 &&
    cursorTile.y < state.height
  ) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(
      cursorTile.x * tileSize,
      cursorTile.y * tileSize,
      tileSize,
      tileSize
    );
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(
      cursorTile.x * tileSize,
      cursorTile.y * tileSize,
      tileSize,
      tileSize
    );
  }

  ctx.restore();
}
