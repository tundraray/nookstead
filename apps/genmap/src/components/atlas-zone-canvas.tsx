'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CanvasBackground } from '@/lib/canvas-utils';

/**
 * A rectangular zone on a sprite image, defined in sprite pixel coordinates.
 */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  filename: string;
  color?: string;
}

interface AtlasZoneCanvasProps {
  imageUrl: string;
  zones: Zone[];
  selectedZoneIndex?: number;
  onZoneCreate?: (rect: { x: number; y: number; w: number; h: number }) => void;
  onZoneClick?: (index: number) => void;
  background?: CanvasBackground;
  className?: string;
  /** Tile width for grid-snapped selection. When set, drawing snaps to tile boundaries. */
  tileWidth?: number;
  /** Tile height for grid-snapped selection. When set, drawing snaps to tile boundaries. */
  tileHeight?: number;
  /** Current zoom level (controlled). Defaults to 1. */
  zoom?: number;
  /** Callback when zoom changes (for controlled mode). */
  onZoomChange?: (zoom: number) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;
const ZOOM_STEP = 0.1;

/**
 * Fixed palette of distinct colors for zone overlays.
 * Each zone gets a color based on its index modulo the palette length.
 */
const ZONE_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#84cc16', // Lime
] as const;

/**
 * Drag state for tracking rectangle creation.
 */
interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/**
 * Determine which zone the point falls inside.
 * When multiple zones overlap, select the one with the smallest area.
 * If areas tie, select the most recently created zone (highest index).
 * Returns the zone index or -1 if no zone contains the point.
 */
function getZoneAtPoint(
  x: number,
  y: number,
  zones: Zone[]
): number {
  const matching = zones
    .map((z, i) => ({ z, i }))
    .filter(({ z }) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);

  if (matching.length === 0) return -1;

  matching.sort((a, b) => {
    const areaA = a.z.w * a.z.h;
    const areaB = b.z.w * b.z.h;
    if (areaA !== areaB) return areaA - areaB;
    return b.i - a.i;
  });

  return matching[0].i;
}

/**
 * Parse a hex color string to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * Convert a pointer event's client coordinates to sprite pixel coordinates.
 * panOffset is in canvas-buffer pixels; zoom is the current scale factor.
 */
function clientToSpriteCoords(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  _spriteWidth: number,
  _spriteHeight: number,
  zoom: number,
  panOffset: { x: number; y: number }
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;
  const x = (canvasX - panOffset.x) / zoom;
  const y = (canvasY - panOffset.y) / zoom;
  return { x, y };
}

/**
 * Snap a coordinate down to the nearest tile boundary.
 */
function snapToTile(value: number, tileSize: number): number {
  return Math.floor(value / tileSize) * tileSize;
}

/**
 * Snap a coordinate up to the nearest tile boundary.
 */
function snapToTileCeil(value: number, tileSize: number): number {
  return Math.ceil(value / tileSize) * tileSize;
}

/**
 * Normalize a drag state into a rectangle with positive width/height.
 * If tileWidth/tileHeight are provided, snaps to tile boundaries.
 */
function dragToRect(
  drag: DragState,
  tileWidth?: number,
  tileHeight?: number
): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let x = Math.min(drag.startX, drag.currentX);
  let y = Math.min(drag.startY, drag.currentY);
  let x2 = Math.max(drag.startX, drag.currentX);
  let y2 = Math.max(drag.startY, drag.currentY);

  if (tileWidth && tileWidth > 0) {
    x = snapToTile(x, tileWidth);
    x2 = snapToTileCeil(x2, tileWidth);
  }
  if (tileHeight && tileHeight > 0) {
    y = snapToTile(y, tileHeight);
    y2 = snapToTileCeil(y2, tileHeight);
  }

  return { x, y, w: x2 - x, h: y2 - y };
}

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated.
 */
function truncateLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '\u2026';
}

/**
 * Draw a checkerboard background pattern on the canvas.
 */
function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number
): void {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#e0e0e0' : '#c0c0c0';
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Canvas component for drawing free-form rectangular zones on sprite images.
 *
 * Renders the sprite image with colored zone overlays and supports:
 * - Click and drag to create new rectangular zones
 * - Click on existing zones to select them
 * - Hover highlights on zones
 * - Escape to cancel active drag
 * - Mouse wheel zoom (zoom toward cursor position)
 * - Middle-click drag or Space+drag to pan
 * - Double-click to reset zoom to 1x
 */
export function AtlasZoneCanvas({
  imageUrl,
  zones,
  selectedZoneIndex,
  onZoneCreate,
  onZoneClick,
  background,
  className,
  tileWidth,
  tileHeight,
  zoom: controlledZoom,
  onZoomChange,
}: AtlasZoneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoveredZoneIndex, setHoveredZoneIndex] = useState<number>(-1);
  const isDraggingRef = useRef(false);
  const dragStartedRef = useRef(false);

  // Container size tracked via ResizeObserver
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Zoom and pan state (panOffset is in canvas-buffer pixels)
  const [internalZoom, setInternalZoom] = useState(1);
  const zoom = controlledZoom ?? internalZoom;
  const setZoom = useCallback(
    (nextZoom: number | ((prev: number) => number)) => {
      const resolved =
        typeof nextZoom === 'function' ? nextZoom(controlledZoom ?? internalZoom) : nextZoom;
      const clamped = clamp(resolved, MIN_ZOOM, MAX_ZOOM);
      if (onZoomChange) {
        onZoomChange(clamped);
      } else {
        setInternalZoom(clamped);
      }
    },
    [controlledZoom, internalZoom, onZoomChange]
  );

  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });
  const spaceHeldRef = useRef(false);

  // Minimum drag distance in sprite pixels before it counts as a drag (vs click)
  const MIN_DRAG_DISTANCE = 2;

  // Track wrapper container size
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: Math.round(entry.contentRect.width),
          h: Math.round(entry.contentRect.height),
        });
      }
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Load sprite image when imageUrl changes
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLoadedImage(img);
      setImageError(null);
    };
    img.onerror = () => {
      setImageError('Failed to load sprite image');
      setLoadedImage(null);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Main render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !loadedImage || containerSize.w === 0 || containerSize.h === 0) return;

    const imgW = loadedImage.naturalWidth;
    const imgH = loadedImage.naturalHeight;

    // Canvas buffer matches the container size (fixed viewport)
    if (canvas.width !== containerSize.w || canvas.height !== containerSize.h) {
      canvas.width = containerSize.w;
      canvas.height = containerSize.h;
    }
    ctx.imageSmoothingEnabled = false;

    // Clear entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom + pan transform (panOffset in buffer pixels)
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Layer 1: Background
    if (background) {
      if (background.type === 'checkerboard') {
        drawCheckerboard(ctx, imgW, imgH, 16);
      } else {
        ctx.fillStyle = background.color;
        ctx.fillRect(0, 0, imgW, imgH);
      }
    }

    // Layer 2: Sprite image
    ctx.drawImage(loadedImage, 0, 0, imgW, imgH);

    // Layer 2.5: Tile grid lines
    if (tileWidth && tileWidth > 0 && tileHeight && tileHeight > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1 / zoom; // Keep grid lines 1 CSS pixel wide
      ctx.setLineDash([]);

      // Vertical lines
      for (let x = tileWidth; x < imgW; x += tileWidth) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5 / zoom, 0);
        ctx.lineTo(x + 0.5 / zoom, imgH);
        ctx.stroke();
      }
      // Horizontal lines
      for (let y = tileHeight; y < imgH; y += tileHeight) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5 / zoom);
        ctx.lineTo(imgW, y + 0.5 / zoom);
        ctx.stroke();
      }
    }

    // Layer 3: Existing zone overlays
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const isSelected = i === selectedZoneIndex;
      const isHovered = i === hoveredZoneIndex;
      const colorHex = zone.color ?? ZONE_COLORS[i % ZONE_COLORS.length];
      const { r, g, b } = hexToRgb(colorHex);

      // Semi-transparent fill
      const fillAlpha = isSelected ? 0.35 : 0.2;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha})`;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

      // Stroke border - scale lineWidth inversely so border stays consistent on screen
      const strokeAlpha = isSelected || isHovered ? 1.0 : 0.7;
      const lineWidth = (isSelected ? 3 : isHovered ? 2 : 1) / zoom;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${strokeAlpha})`;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([]);
      ctx.strokeRect(
        zone.x + lineWidth / 2,
        zone.y + lineWidth / 2,
        zone.w - lineWidth,
        zone.h - lineWidth
      );

      // Filename label - scale font inversely so text stays readable
      const label = truncateLabel(zone.filename, 20);
      const fontSize = Math.max(10, Math.min(14, zone.w / 8)) / zoom;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textBaseline = 'top';

      // Label background for readability
      const textMetrics = ctx.measureText(label);
      const textPadding = 2 / zoom;
      const textX = zone.x + 3 / zoom;
      const textY = zone.y + 3 / zoom;
      const textBgW = textMetrics.width + textPadding * 2;
      const textBgH = fontSize + textPadding * 2;

      // Only draw label if zone is wide enough
      if (zone.w > 20 && zone.h > 16) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(textX - textPadding, textY - textPadding, textBgW, textBgH);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, textX, textY);
      }
    }

    // Layer 4: Active drag rectangle
    if (drag) {
      const rect = dragToRect(drag, tileWidth, tileHeight);
      if (rect.w > 0 && rect.h > 0) {
        const lw = 2 / zoom;
        // Dashed outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = lw;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.strokeRect(rect.x + lw / 2, rect.y + lw / 2, rect.w - lw, rect.h - lw);

        // Inner contrasting dashed line for visibility on light backgrounds
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.lineDashOffset = 5 / zoom;
        ctx.strokeRect(rect.x + lw / 2, rect.y + lw / 2, rect.w - lw, rect.h - lw);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // Semi-transparent fill
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
    }

    // Layer 5: Hover highlight (if not dragging and hovering a zone)
    if (hoveredZoneIndex >= 0 && !drag) {
      const zone = zones[hoveredZoneIndex];
      if (zone && hoveredZoneIndex !== selectedZoneIndex) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      }
    }

    ctx.restore();
  }, [loadedImage, zones, selectedZoneIndex, hoveredZoneIndex, drag, background, tileWidth, tileHeight, zoom, panOffset, containerSize]);

  // requestAnimationFrame render loop
  useEffect(() => {
    let frameId: number;

    const loop = () => {
      render();
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [render]);

  // Keyboard handler: Escape to cancel drag, Space for pan mode
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isDraggingRef.current) {
        isDraggingRef.current = false;
        dragStartedRef.current = false;
        setDrag(null);
      }
      if (e.key === ' ' || e.code === 'Space') {
        // Only capture space when canvas wrapper is focused or has a child focused
        if (
          wrapperRef.current &&
          (wrapperRef.current.contains(document.activeElement) ||
            document.activeElement === document.body)
        ) {
          e.preventDefault();
          spaceHeldRef.current = true;
        }
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === ' ' || e.code === 'Space') {
        spaceHeldRef.current = false;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Wheel zoom handler — zoom toward cursor position
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || !loadedImage) return;

      const rect = canvas.getBoundingClientRect();
      // Mouse position in canvas-buffer coords
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      // Calculate new zoom
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const factor = 1 + delta;
      const newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);

      if (newZoom === zoom) return;

      // Zoom toward cursor: keep sprite point under cursor at same screen position.
      // screenPos = spritePos * zoom + panOffset  =>  spritePos = (screenPos - panOffset) / zoom
      // After: screenPos = spritePos * newZoom + newPanOffset
      // => newPanOffset = screenPos - spritePos * newZoom
      //                 = screenPos - (screenPos - panOffset) / zoom * newZoom
      //                 = screenPos * (1 - newZoom/zoom) + panOffset * newZoom/zoom
      const zoomRatio = newZoom / zoom;
      const newPanX = mouseX - (mouseX - panOffset.x) * zoomRatio;
      const newPanY = mouseY - (mouseY - panOffset.y) * zoomRatio;

      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    },
    [zoom, panOffset, loadedImage, setZoom]
  );

  // Attach wheel handler with passive: false
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    // Middle-click or Space+click for panning
    if (e.button === 1 || (e.button === 0 && spaceHeldRef.current)) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panOffset.x,
        panY: panOffset.y,
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    const { x, y } = clientToSpriteCoords(
      e,
      canvas,
      loadedImage.naturalWidth,
      loadedImage.naturalHeight,
      zoom,
      panOffset
    );

    // Check if clicking on an existing zone
    const zoneIdx = getZoneAtPoint(x, y, zones);

    if (zoneIdx >= 0) {
      // Clicking on existing zone - fire callback
      onZoneClick?.(zoneIdx);
      return;
    }

    // Start drag for new zone creation
    isDraggingRef.current = true;
    dragStartedRef.current = false;
    setDrag({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });

    canvas.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    // Handle panning (panOffset in buffer pixels, so convert CSS delta)
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      setPanOffset({
        x: panStartRef.current.panX + dx * scaleX,
        y: panStartRef.current.panY + dy * scaleY,
      });
      return;
    }

    const { x, y } = clientToSpriteCoords(
      e,
      canvas,
      loadedImage.naturalWidth,
      loadedImage.naturalHeight,
      zoom,
      panOffset
    );

    if (isDraggingRef.current) {
      // Check if moved far enough to count as a drag
      setDrag((prev) => {
        if (!prev) return prev;
        const dx = Math.abs(x - prev.startX);
        const dy = Math.abs(y - prev.startY);
        if (dx >= MIN_DRAG_DISTANCE || dy >= MIN_DRAG_DISTANCE) {
          dragStartedRef.current = true;
        }
        return { ...prev, currentX: x, currentY: y };
      });
    } else {
      // Update hover state
      const zoneIdx = getZoneAtPoint(x, y, zones);
      setHoveredZoneIndex(zoneIdx);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    canvas.releasePointerCapture(e.pointerId);

    // End panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;

    if (drag && dragStartedRef.current) {
      const rect = dragToRect(drag, tileWidth, tileHeight);

      // Clamp to sprite bounds
      const clampedX = Math.max(0, Math.round(rect.x));
      const clampedY = Math.max(0, Math.round(rect.y));
      const clampedW = Math.min(
        Math.round(rect.w),
        loadedImage.naturalWidth - clampedX
      );
      const clampedH = Math.min(
        Math.round(rect.h),
        loadedImage.naturalHeight - clampedY
      );

      if (clampedW > 0 && clampedH > 0) {
        onZoneCreate?.({
          x: clampedX,
          y: clampedY,
          w: clampedW,
          h: clampedH,
        });
      }
    }

    dragStartedRef.current = false;
    setDrag(null);
  }

  function handlePointerLeave() {
    setHoveredZoneIndex(-1);
  }

  // Double-click to reset zoom and pan
  function handleDoubleClick() {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }

  // Determine cursor style
  const getCursor = (): string => {
    if (isPanningRef.current || spaceHeldRef.current) return 'grabbing';
    return 'crosshair';
  };

  // Compute container height: image natural height capped at 70vh
  const containerHeight = loadedImage
    ? `min(${loadedImage.naturalHeight}px, 70vh)`
    : '200px';

  return (
    <div
      ref={wrapperRef}
      className={`overflow-hidden border rounded-lg relative ${className ?? ''}`}
      style={{ height: containerHeight }}
      tabIndex={0}
    >
      {imageError && <p className="text-destructive p-4">{imageError}</p>}
      {!loadedImage && !imageError && <p className="p-4">Loading image...</p>}
      {loadedImage && (
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor: getCursor(),
            imageRendering: 'pixelated',
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onDoubleClick={handleDoubleClick}
        />
      )}
    </div>
  );
}
