import { FRAMES_PER_TERRAIN, EMPTY_FRAME, stampCells } from '@nookstead/map-lib';
import type {
  MapEditorState,
  BrushShape,
  InteractionLayer,
} from '@nookstead/map-lib';
import type { CellTrigger } from '@nookstead/shared';

/** Colors for interaction trigger type overlays in the editor. */
const TRIGGER_OVERLAY_COLORS: Record<CellTrigger['type'], string> = {
  warp: '#AB47BC',
  interact: '#42A5F5',
  event: '#FFA726',
  sound: '#66BB6A',
  damage: '#EF5350',
};

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

/** Brush preview configuration for multi-cell cursor. */
export interface BrushPreview {
  brushSize: number;
  brushShape: BrushShape;
}

/** Render data for a single sprite frame layer within a game object. */
export interface ObjectRenderLayer {
  image: HTMLImageElement;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  /** Pixel offset within the object's local space. */
  xOffset: number;
  /** Pixel offset within the object's local space. */
  yOffset: number;
}

/** Render data for a game object (may contain multiple layers). */
export interface ObjectRenderEntry {
  layers: ObjectRenderLayer[];
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
  brushPreview?: BrushPreview
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

  // Render each visible layer (supports tile, object, and interaction layers)
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    ctx.globalAlpha = layer.opacity;

    if (layer.type === 'tile') {
      // TileLayer rendering — per-cell tileset lookup via material baseTilesetKey
      const TILESET_COLS = FRAMES_PER_TERRAIN / 4; // 12
      const TILE_PX = 16;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const frame = layer.frames[y][x];
          if (frame === EMPTY_FRAME) continue;

          // Look up the tileset for this specific cell: per-cell key → baseTilesetKey → layer fallback
          const cellTerrain = state.grid[y]?.[x]?.terrain;
          const matInfo = cellTerrain ? state.materials.get(cellTerrain) : undefined;
          const tilesetKey = layer.tilesetKeys?.[y]?.[x] || matInfo?.baseTilesetKey || layer.terrainKey;
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
    } else if (layer.type === 'object' && objectRenderData) {
      // ObjectLayer rendering: draw each placed object using its sprite data
      if (!layer.objects) continue;

      for (const obj of layer.objects) {
        const entry = objectRenderData.get(obj.objectId);
        if (!entry || entry.layers.length === 0) continue;

        for (const rl of entry.layers) {
          if (!rl.image.complete) continue;
          ctx.drawImage(
            rl.image,
            rl.frameX,
            rl.frameY,
            rl.frameW,
            rl.frameH,
            obj.gridX * tileSize + rl.xOffset,
            obj.gridY * tileSize + rl.yOffset,
            rl.frameW,
            rl.frameH
          );
        }
      }
    } else if (layer.type === 'interaction') {
      // Interaction layer rendering (ADR-0017):
      // Colored semi-transparent squares on tiles with triggers.
      const interactionLayer = layer as InteractionLayer;
      ctx.save();
      for (const [key, triggers] of interactionLayer.triggers) {
        const [xStr, yStr] = key.split(',');
        const tileX = parseInt(xStr, 10);
        const tileY = parseInt(yStr, 10);
        if (tileX < startX || tileX >= endX || tileY < startY || tileY >= endY)
          continue;

        const canvasX = tileX * tileSize;
        const canvasY = tileY * tileSize;

        // Render a colored overlay per trigger type
        for (let i = 0; i < triggers.length; i++) {
          const trigger = triggers[i];
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = TRIGGER_OVERLAY_COLORS[trigger.type] ?? '#888';
          if (triggers.length === 1) {
            // Single trigger: fill entire tile
            ctx.fillRect(canvasX, canvasY, tileSize, tileSize);
          } else {
            // Multiple triggers: split tile horizontally
            const w = tileSize / triggers.length;
            ctx.fillRect(canvasX + i * w, canvasY, w, tileSize);
          }
        }
      }
      ctx.restore();
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

  // Cursor tile highlight (multi-cell for brush/eraser with brushPreview)
  if (
    cursorTile &&
    cursorTile.x >= 0 &&
    cursorTile.x < state.width &&
    cursorTile.y >= 0 &&
    cursorTile.y < state.height
  ) {
    if (brushPreview && brushPreview.brushSize > 1) {
      const cells = stampCells(
        cursorTile.x,
        cursorTile.y,
        brushPreview.brushSize,
        brushPreview.brushShape,
        state.width,
        state.height,
      );
      const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (const cell of cells) {
        ctx.fillRect(cell.x * tileSize, cell.y * tileSize, tileSize, tileSize);
      }

      // Draw boundary edges only (edges not shared with adjacent stamp cells)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (const cell of cells) {
        const px = cell.x * tileSize;
        const py = cell.y * tileSize;
        // Top edge
        if (!cellSet.has(`${cell.x},${cell.y - 1}`)) {
          ctx.moveTo(px, py);
          ctx.lineTo(px + tileSize, py);
        }
        // Bottom edge
        if (!cellSet.has(`${cell.x},${cell.y + 1}`)) {
          ctx.moveTo(px, py + tileSize);
          ctx.lineTo(px + tileSize, py + tileSize);
        }
        // Left edge
        if (!cellSet.has(`${cell.x - 1},${cell.y}`)) {
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + tileSize);
        }
        // Right edge
        if (!cellSet.has(`${cell.x + 1},${cell.y}`)) {
          ctx.moveTo(px + tileSize, py);
          ctx.lineTo(px + tileSize, py + tileSize);
        }
      }
      ctx.stroke();
    } else {
      // Single-cell highlight (default for fill, rectangle, size=1, etc.)
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
  if (!entry || entry.layers.length === 0) return;

  const screenX = (ghostGridX * tileSize - camera.x) * camera.zoom;
  const screenY = (ghostGridY * tileSize - camera.y) * camera.zoom;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.5;
  try {
    for (const rl of entry.layers) {
      if (!rl.image.complete) continue;
      ctx.drawImage(
        rl.image,
        rl.frameX,
        rl.frameY,
        rl.frameW,
        rl.frameH,
        screenX + rl.xOffset * camera.zoom,
        screenY + rl.yOffset * camera.zoom,
        rl.frameW * camera.zoom,
        rl.frameH * camera.zoom
      );
    }
  } finally {
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
}
