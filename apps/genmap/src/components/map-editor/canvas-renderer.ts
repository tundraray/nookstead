import type { MapEditorState, FenceLayer } from '@/hooks/map-editor-types';

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
  showWalkability: boolean;
}

/** Rectangle preview for the rectangle fill tool. */
export interface PreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Map of fence type keys to their generated virtual tileset images.
 * Each fence type has a single tileset image (4-column layout, 16x16 frames).
 * Keys are fenceTypeKey values (e.g., "wooden_fence").
 */
export interface FenceTilesetMap {
  [fenceTypeKey: string]: HTMLCanvasElement | HTMLImageElement;
}

/** Render data for a single game object sprite frame. */
export interface ObjectRenderEntry {
  image: HTMLImageElement;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
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
  previewRect: PreviewRect | null,
  objectRenderData?: Map<string, ObjectRenderEntry>,
  fenceTilesets?: FenceTilesetMap
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

  // Render each visible layer (supports tile, object, and fence layers)
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    ctx.globalAlpha = layer.opacity;

    if (layer.type === 'tile') {
      // TileLayer rendering
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
    } else if (layer.type === 'object' && objectRenderData) {
      // ObjectLayer rendering: draw each placed object using its sprite data
      if (!layer.objects) continue;

      for (const obj of layer.objects) {
        const entry = objectRenderData.get(obj.objectId);
        if (!entry || !entry.image.complete) continue;

        ctx.drawImage(
          entry.image,
          entry.frameX,
          entry.frameY,
          entry.frameW,
          entry.frameH,
          obj.gridX * tileSize,
          obj.gridY * tileSize,
          entry.frameW,
          entry.frameH
        );
      }
    } else if (layer.type === 'fence' && fenceTilesets) {
      // Fence layer rendering (Design Doc Section 4.4):
      // Renders above terrain layers, below object layers (layer ordering in
      // state.layers determines relative order among mixed layer types).
      const fenceLayer = layer as FenceLayer;
      const tilesetImage = fenceTilesets[fenceLayer.fenceTypeKey];
      if (!tilesetImage) continue; // tileset not yet generated

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const frame = fenceLayer.frames[y][x];
          if (frame === 0) continue; // FENCE_EMPTY_FRAME: skip empty cells

          // Source rectangle formula (Design Doc Section 1.2 / 6.4):
          // idx = frameIndex - 1 (0-based into image, frame 0 = empty sentinel)
          const idx = frame - 1;
          const srcX = (idx % 4) * 16;
          const srcY = Math.floor(idx / 4) * 16;

          ctx.drawImage(
            tilesetImage,
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

  // Walkability overlay
  if (config.showWalkability && state.walkable) {
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const walkable = state.walkable[y]?.[x];
        ctx.fillStyle = walkable
          ? 'rgba(76, 175, 80, 0.25)'
          : 'rgba(244, 67, 54, 0.25)';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
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

/**
 * Draw a semi-transparent ghost preview of the selected object at the cursor's
 * grid-snapped position. Called between renderMapCanvas and zone overlays so the
 * ghost appears above terrain/objects but below zone overlays.
 *
 * Uses screen coordinates (called after ctx.restore in the render pipeline).
 */
export function drawGhostPreview(
  ctx: CanvasRenderingContext2D,
  objectRenderData: Map<string, ObjectRenderEntry>,
  ghostObjectId: string,
  ghostGridX: number,
  ghostGridY: number,
  tileSize: number,
  camera: Camera
): void {
  const entry = objectRenderData.get(ghostObjectId);
  if (!entry || !entry.image.complete) return;

  const screenX = (ghostGridX * tileSize - camera.x) * camera.zoom;
  const screenY = (ghostGridY * tileSize - camera.y) * camera.zoom;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.5;
  try {
    ctx.drawImage(
      entry.image,
      entry.frameX,
      entry.frameY,
      entry.frameW,
      entry.frameH,
      screenX,
      screenY,
      entry.frameW * camera.zoom,
      entry.frameH * camera.zoom
    );
  } finally {
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
}
