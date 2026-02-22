import { FRAMES_PER_TERRAIN, EMPTY_FRAME } from '@nookstead/map-lib';
import type { MapEditorState, PlacedObject } from '@nookstead/map-lib';

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
  objectRenderData?: Map<string, ObjectRenderEntry>
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

  // Render each visible layer (supports both tile and object layers)
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    ctx.globalAlpha = layer.opacity;

    // Determine layer type: layers without a `type` field are treated as tile layers
    // for backward compatibility with maps saved before the discriminated union was added.
    const layerType = (layer as { type?: string }).type ?? 'tile';

    if (layerType === 'tile') {
      // TileLayer rendering — per-cell tileset lookup via material baseTilesetKey
      const TILESET_COLS = FRAMES_PER_TERRAIN / 4; // 12
      const TILE_PX = 16;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const frame = layer.frames[y][x];
          if (frame === EMPTY_FRAME) continue;

          // Look up the tileset for this specific cell's terrain
          const cellTerrain = state.grid[y]?.[x]?.terrain;
          const matInfo = cellTerrain ? state.materials.get(cellTerrain) : undefined;
          const tilesetKey = matInfo?.baseTilesetKey ?? layer.terrainKey;
          const img = tilesetImages.get(tilesetKey);
          if (!img) continue;

          const srcX = (frame % TILESET_COLS) * TILE_PX;
          const srcY = Math.floor(frame / TILESET_COLS) * TILE_PX;

          ctx.drawImage(
            img,
            srcX,
            srcY,
            TILE_PX,
            TILE_PX,
            x * tileSize,
            y * tileSize,
            tileSize,
            tileSize
          );
        }
      }
    } else if (layerType === 'object' && objectRenderData) {
      // ObjectLayer rendering: draw each placed object using its sprite data
      const objects = (layer as { objects?: PlacedObject[] }).objects;
      if (!objects) continue;

      for (const obj of objects) {
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
