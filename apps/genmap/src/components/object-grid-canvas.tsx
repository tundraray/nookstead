'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CanvasBackground } from '@/lib/canvas-utils';
import type { CollisionZone } from '@/hooks/use-object-editor';

/**
 * A single frame layer in the object composition canvas.
 */
export interface FrameLayer {
  frameId: string;
  spriteId: string;
  spriteUrl: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  xOffset: number;
  yOffset: number;
  layerOrder: number;
}

export type EditorMode = 'layers' | 'zones';
export type SnapMode = 'snap' | 'free';

interface ObjectGridCanvasProps {
  layers: FrameLayer[];
  activeFrame: {
    frameId: string;
    spriteId: string;
    spriteUrl: string;
    frameX: number;
    frameY: number;
    frameW: number;
    frameH: number;
  } | null;
  selectedLayerIndex: number | null;
  onLayerAdd: (
    frameData: Omit<FrameLayer, 'xOffset' | 'yOffset' | 'layerOrder'>
  ) => void;
  onLayerUpdate: (
    index: number,
    updates: Partial<Pick<FrameLayer, 'xOffset' | 'yOffset' | 'layerOrder'>>
  ) => void;
  onLayerSelect: (index: number | null) => void;
  canvasWidth?: number;
  canvasHeight?: number;
  background?: CanvasBackground;
  className?: string;
  // Grid & Snap
  showGrid?: boolean;
  gridSize?: number;
  snapMode?: SnapMode;
  // Editor mode
  editorMode?: EditorMode;
  // Collision zones
  collisionZones?: CollisionZone[];
  selectedZoneIndex?: number | null;
  onZoneAdd?: (zone: Omit<CollisionZone, 'id'>) => void;
  onZoneUpdate?: (index: number, updates: Partial<CollisionZone>) => void;
  onZoneSelect?: (index: number | null) => void;
}

const DEFAULT_CANVAS_SIZE = 256;
const CHECKERBOARD_CELL = 16;
const SELECTION_COLOR = '#00aaff';
const SELECTION_LINE_WIDTH = 2;
const GRID_COLOR = 'rgba(128, 128, 128, 0.25)';
const COLLISION_COLOR = 'rgba(239, 68, 68, 0.3)';
const COLLISION_STROKE = 'rgba(239, 68, 68, 0.8)';
const WALKABLE_COLOR = 'rgba(34, 197, 94, 0.3)';
const WALKABLE_STROKE = 'rgba(34, 197, 94, 0.8)';
const ZONE_SELECTION_COLOR = '#facc15';
const RESIZE_HANDLE_SIZE = 8;
const MIN_ZONE_SIZE = 8;

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DragState {
  layerIndex: number;
  startMouseX: number;
  startMouseY: number;
  startLayerX: number;
  startLayerY: number;
}

interface ZoneDragState {
  zoneIndex: number;
  startMouseX: number;
  startMouseY: number;
  startZoneX: number;
  startZoneY: number;
}

interface ZoneResizeState {
  zoneIndex: number;
  handle: ResizeHandle;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

interface ZoneDrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

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

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize: number
): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = gridSize; x < width; x += gridSize) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = gridSize; y < height; y += gridSize) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();
}

function clientToCanvasCoords(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = logicalWidth / rect.width;
  const scaleY = logicalHeight / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  return { x, y };
}

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function getLayerAtPoint(x: number, y: number, layers: FrameLayer[]): number | null {
  const sorted = layers
    .map((l, i) => ({ l, i }))
    .sort((a, b) => b.l.layerOrder - a.l.layerOrder);
  for (const { l, i } of sorted) {
    if (x >= l.xOffset && x < l.xOffset + l.frameW && y >= l.yOffset && y < l.yOffset + l.frameH) {
      return i;
    }
  }
  return null;
}

function getZoneAtPoint(x: number, y: number, zones: CollisionZone[]): number | null {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (x >= z.x && x < z.x + z.width && y >= z.y && y < z.y + z.height) {
      return i;
    }
  }
  return null;
}

function getResizeHandlePositions(zone: CollisionZone): { handle: ResizeHandle; cx: number; cy: number }[] {
  const { x, y, width: w, height: h } = zone;
  const hs = RESIZE_HANDLE_SIZE / 2;
  const raw: { handle: ResizeHandle; cx: number; cy: number }[] = [
    { handle: 'nw', cx: x, cy: y },
    { handle: 'n', cx: x + w / 2, cy: y },
    { handle: 'ne', cx: x + w, cy: y },
    { handle: 'e', cx: x + w, cy: y + h / 2 },
    { handle: 'se', cx: x + w, cy: y + h },
    { handle: 's', cx: x + w / 2, cy: y + h },
    { handle: 'sw', cx: x, cy: y + h },
    { handle: 'w', cx: x, cy: y + h / 2 },
  ];
  return raw.map((r) => ({ handle: r.handle, cx: r.cx - hs, cy: r.cy - hs }));
}

function getResizeHandleAtPoint(
  px: number, py: number, zone: CollisionZone
): ResizeHandle | null {
  const handles = getResizeHandlePositions(zone);
  for (const { handle, cx, cy } of handles) {
    if (px >= cx && px <= cx + RESIZE_HANDLE_SIZE && py >= cy && py <= cy + RESIZE_HANDLE_SIZE) {
      return handle;
    }
  }
  return null;
}

function applyResize(
  handle: ResizeHandle,
  dx: number, dy: number,
  startX: number, startY: number, startW: number, startH: number,
  snap: boolean, gs: number
): { x: number; y: number; width: number; height: number } {
  let nx = startX, ny = startY, nw = startW, nh = startH;

  if (handle.includes('w')) { nx = startX + dx; nw = startW - dx; }
  if (handle.includes('e')) { nw = startW + dx; }
  if (handle.includes('n')) { ny = startY + dy; nh = startH - dy; }
  if (handle.includes('s')) { nh = startH + dy; }

  if (snap) {
    nx = snapToGrid(nx, gs);
    ny = snapToGrid(ny, gs);
    nw = Math.max(MIN_ZONE_SIZE, snapToGrid(nw, gs));
    nh = Math.max(MIN_ZONE_SIZE, snapToGrid(nh, gs));
  }

  // Enforce minimum size
  if (nw < MIN_ZONE_SIZE) { if (handle.includes('w')) nx = startX + startW - MIN_ZONE_SIZE; nw = MIN_ZONE_SIZE; }
  if (nh < MIN_ZONE_SIZE) { if (handle.includes('n')) ny = startY + startH - MIN_ZONE_SIZE; nh = MIN_ZONE_SIZE; }

  return { x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) };
}

export function ObjectGridCanvas({
  layers,
  activeFrame,
  selectedLayerIndex,
  onLayerAdd,
  onLayerUpdate,
  onLayerSelect,
  canvasWidth,
  canvasHeight,
  background,
  className,
  showGrid = false,
  gridSize = 16,
  snapMode = 'free',
  editorMode = 'layers',
  collisionZones = [],
  selectedZoneIndex = null,
  onZoneAdd,
  onZoneUpdate,
  onZoneSelect,
}: ObjectGridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [dirty, setDirty] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [zoneDragState, setZoneDragState] = useState<ZoneDragState | null>(null);
  const [zoneResizeState, setZoneResizeState] = useState<ZoneResizeState | null>(null);
  const [zoneDrawState, setZoneDrawState] = useState<ZoneDrawState | null>(null);
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);

  const logicalWidth = canvasWidth ?? DEFAULT_CANVAS_SIZE;
  const logicalHeight = canvasHeight ?? DEFAULT_CANVAS_SIZE;
  const MIN_DRAG_DISTANCE = 2;

  // Load and cache sprite images
  useEffect(() => {
    const uniqueSprites = new Map(layers.map((l) => [l.spriteId, l.spriteUrl]));
    if (activeFrame) {
      uniqueSprites.set(activeFrame.spriteId, activeFrame.spriteUrl);
    }
    let loadedAny = false;
    for (const [spriteId, url] of uniqueSprites) {
      if (!imageCache.current.has(spriteId)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageCache.current.set(spriteId, img);
          setDirty((d) => d + 1);
        };
        img.src = url;
        loadedAny = true;
      }
    }
    if (!loadedAny && uniqueSprites.size > 0) {
      setDirty((d) => d + 1);
    }
  }, [layers, activeFrame]);

  // Main render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    canvas.width = logicalWidth;
    canvas.height = logicalHeight;
    ctx.imageSmoothingEnabled = false;

    // 1. Background
    if (background && background.type === 'solid') {
      ctx.fillStyle = background.color;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    } else {
      drawCheckerboard(ctx, logicalWidth, logicalHeight, CHECKERBOARD_CELL);
    }

    // 2. Grid
    if (showGrid) {
      drawGrid(ctx, logicalWidth, logicalHeight, gridSize);
    }

    // 3. Frame layers
    const sortedLayers = [...layers]
      .map((l, i) => ({ l, i }))
      .sort((a, b) => a.l.layerOrder - b.l.layerOrder);

    const layerOpacity = editorMode === 'zones' ? 0.4 : 1.0;
    ctx.globalAlpha = layerOpacity;

    for (const { l } of sortedLayers) {
      const img = imageCache.current.get(l.spriteId);
      if (img) {
        ctx.drawImage(
          img,
          l.frameX, l.frameY, l.frameW, l.frameH,
          l.xOffset, l.yOffset, l.frameW, l.frameH
        );
      }
    }

    ctx.globalAlpha = 1.0;

    // 4. Collision zones overlay
    for (let i = 0; i < collisionZones.length; i++) {
      const zone = collisionZones[i];
      const isCollision = zone.type === 'collision';
      ctx.fillStyle = isCollision ? COLLISION_COLOR : WALKABLE_COLOR;
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      ctx.strokeStyle = isCollision ? COLLISION_STROKE : WALKABLE_STROKE;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(zone.x + 0.5, zone.y + 0.5, zone.width - 1, zone.height - 1);

      // Zone label
      if (zone.width > 20 && zone.height > 12) {
        ctx.fillStyle = isCollision ? COLLISION_STROKE : WALKABLE_STROKE;
        ctx.font = '10px monospace';
        ctx.fillText(
          zone.label.slice(0, Math.floor(zone.width / 6)),
          zone.x + 2,
          zone.y + 10
        );
      }
    }

    // Zone being drawn
    if (zoneDrawState) {
      const x = Math.min(zoneDrawState.startX, zoneDrawState.currentX);
      const y = Math.min(zoneDrawState.startY, zoneDrawState.currentY);
      const w = Math.abs(zoneDrawState.currentX - zoneDrawState.startX);
      const h = Math.abs(zoneDrawState.currentY - zoneDrawState.startY);
      ctx.fillStyle = COLLISION_COLOR;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = COLLISION_STROKE;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    // 5. Selection highlight
    if (editorMode === 'layers' && selectedLayerIndex !== null && selectedLayerIndex >= 0) {
      const layer = layers[selectedLayerIndex];
      if (layer) {
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = SELECTION_LINE_WIDTH;
        ctx.setLineDash([]);
        ctx.strokeRect(
          layer.xOffset + SELECTION_LINE_WIDTH / 2,
          layer.yOffset + SELECTION_LINE_WIDTH / 2,
          layer.frameW - SELECTION_LINE_WIDTH,
          layer.frameH - SELECTION_LINE_WIDTH
        );
      }
    }

    if (editorMode === 'zones' && selectedZoneIndex !== null && selectedZoneIndex >= 0) {
      const zone = collisionZones[selectedZoneIndex];
      if (zone) {
        ctx.strokeStyle = ZONE_SELECTION_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(zone.x - 1, zone.y - 1, zone.width + 2, zone.height + 2);
        ctx.setLineDash([]);

        // Resize handles
        const handles = getResizeHandlePositions(zone);
        for (const { cx, cy } of handles) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(cx, cy, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
          ctx.strokeStyle = ZONE_SELECTION_COLOR;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx, cy, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
        }
      }
    }
  }, [
    logicalWidth, logicalHeight, layers, selectedLayerIndex, background, dirty,
    showGrid, gridSize, editorMode, collisionZones, selectedZoneIndex, zoneDrawState,
  ]);

  // Render loop
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      render();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [render]);

  // --- Layer mode handlers ---

  function handleLayerPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = clientToCanvasCoords(e, canvas, logicalWidth, logicalHeight);
    const layerIndex = getLayerAtPoint(x, y, layers);

    if (layerIndex !== null) {
      isDraggingRef.current = true;
      dragMovedRef.current = false;
      setDragState({
        layerIndex,
        startMouseX: x,
        startMouseY: y,
        startLayerX: layers[layerIndex].xOffset,
        startLayerY: layers[layerIndex].yOffset,
      });
      onLayerSelect(layerIndex);
      canvas.setPointerCapture(e.pointerId);
    } else {
      isDraggingRef.current = false;
      dragMovedRef.current = false;
      setDragState(null);
    }
  }

  function handleLayerPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !isDraggingRef.current || !dragState) return;
    const { x, y } = clientToCanvasCoords(e, canvas, logicalWidth, logicalHeight);
    const dx = x - dragState.startMouseX;
    const dy = y - dragState.startMouseY;

    if (!dragMovedRef.current && (Math.abs(dx) >= MIN_DRAG_DISTANCE || Math.abs(dy) >= MIN_DRAG_DISTANCE)) {
      dragMovedRef.current = true;
    }

    if (dragMovedRef.current) {
      let newX = Math.round(dragState.startLayerX + dx);
      let newY = Math.round(dragState.startLayerY + dy);
      if (snapMode === 'snap') {
        newX = snapToGrid(newX, gridSize);
        newY = snapToGrid(newY, gridSize);
      }
      onLayerUpdate(dragState.layerIndex, { xOffset: newX, yOffset: newY });
    }
  }

  function handleLayerPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.releasePointerCapture(e.pointerId);

    if (isDraggingRef.current && dragMovedRef.current) {
      isDraggingRef.current = false;
      dragMovedRef.current = false;
      setDragState(null);
      return;
    }

    isDraggingRef.current = false;
    dragMovedRef.current = false;
    setDragState(null);

    const { x, y } = clientToCanvasCoords(e, canvas, logicalWidth, logicalHeight);
    const layerIndex = getLayerAtPoint(x, y, layers);

    if (layerIndex !== null) return;

    if (activeFrame) {
      onLayerAdd({
        frameId: activeFrame.frameId,
        spriteId: activeFrame.spriteId,
        spriteUrl: activeFrame.spriteUrl,
        frameX: activeFrame.frameX,
        frameY: activeFrame.frameY,
        frameW: activeFrame.frameW,
        frameH: activeFrame.frameH,
      });
    } else {
      onLayerSelect(null);
    }
  }

  // --- Zone mode handlers ---

  function handleZonePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = clientToCanvasCoords(e, canvas, logicalWidth, logicalHeight);

    // Check resize handles on selected zone first
    if (selectedZoneIndex !== null && selectedZoneIndex >= 0) {
      const selectedZone = collisionZones[selectedZoneIndex];
      if (selectedZone) {
        const handle = getResizeHandleAtPoint(x, y, selectedZone);
        if (handle) {
          isDraggingRef.current = true;
          dragMovedRef.current = false;
          setZoneResizeState({
            zoneIndex: selectedZoneIndex,
            handle,
            startMouseX: x,
            startMouseY: y,
            startX: selectedZone.x,
            startY: selectedZone.y,
            startW: selectedZone.width,
            startH: selectedZone.height,
          });
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    const zoneIndex = getZoneAtPoint(x, y, collisionZones);

    if (zoneIndex !== null) {
      // Start dragging existing zone
      isDraggingRef.current = true;
      dragMovedRef.current = false;
      const zone = collisionZones[zoneIndex];
      setZoneDragState({
        zoneIndex,
        startMouseX: x,
        startMouseY: y,
        startZoneX: zone.x,
        startZoneY: zone.y,
      });
      onZoneSelect?.(zoneIndex);
      canvas.setPointerCapture(e.pointerId);
    } else {
      // Start drawing new zone
      isDraggingRef.current = true;
      dragMovedRef.current = false;
      let sx = Math.round(x);
      let sy = Math.round(y);
      if (snapMode === 'snap') {
        sx = snapToGrid(sx, gridSize);
        sy = snapToGrid(sy, gridSize);
      }
      setZoneDrawState({ startX: sx, startY: sy, currentX: sx, currentY: sy });
      onZoneSelect?.(null);
      canvas.setPointerCapture(e.pointerId);
    }
  }

  function handleZonePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !isDraggingRef.current) return;
    const { x, y } = clientToCanvasCoords(e, canvas, logicalWidth, logicalHeight);

    if (zoneResizeState) {
      const dx = x - zoneResizeState.startMouseX;
      const dy = y - zoneResizeState.startMouseY;
      dragMovedRef.current = true;
      const result = applyResize(
        zoneResizeState.handle, dx, dy,
        zoneResizeState.startX, zoneResizeState.startY,
        zoneResizeState.startW, zoneResizeState.startH,
        snapMode === 'snap', gridSize
      );
      onZoneUpdate?.(zoneResizeState.zoneIndex, result);
    } else if (zoneDragState) {
      const dx = x - zoneDragState.startMouseX;
      const dy = y - zoneDragState.startMouseY;
      if (!dragMovedRef.current && (Math.abs(dx) >= MIN_DRAG_DISTANCE || Math.abs(dy) >= MIN_DRAG_DISTANCE)) {
        dragMovedRef.current = true;
      }
      if (dragMovedRef.current) {
        let newX = Math.round(zoneDragState.startZoneX + dx);
        let newY = Math.round(zoneDragState.startZoneY + dy);
        if (snapMode === 'snap') {
          newX = snapToGrid(newX, gridSize);
          newY = snapToGrid(newY, gridSize);
        }
        onZoneUpdate?.(zoneDragState.zoneIndex, { x: newX, y: newY });
      }
    } else if (zoneDrawState) {
      dragMovedRef.current = true;
      let cx = Math.round(x);
      let cy = Math.round(y);
      if (snapMode === 'snap') {
        cx = snapToGrid(cx, gridSize);
        cy = snapToGrid(cy, gridSize);
      }
      setZoneDrawState((prev) => (prev ? { ...prev, currentX: cx, currentY: cy } : null));
    }
  }

  function handleZonePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.releasePointerCapture(e.pointerId);

    if (zoneResizeState) {
      isDraggingRef.current = false;
      dragMovedRef.current = false;
      setZoneResizeState(null);
      return;
    }

    if (zoneDragState) {
      isDraggingRef.current = false;
      dragMovedRef.current = false;
      setZoneDragState(null);
      return;
    }

    if (zoneDrawState && dragMovedRef.current) {
      const x = Math.min(zoneDrawState.startX, zoneDrawState.currentX);
      const y = Math.min(zoneDrawState.startY, zoneDrawState.currentY);
      const w = Math.abs(zoneDrawState.currentX - zoneDrawState.startX);
      const h = Math.abs(zoneDrawState.currentY - zoneDrawState.startY);

      if (w >= 4 && h >= 4) {
        onZoneAdd?.({
          label: `Zone ${collisionZones.length + 1}`,
          type: 'collision',
          shape: 'rectangle',
          x,
          y,
          width: w,
          height: h,
        });
      }
    }

    isDraggingRef.current = false;
    dragMovedRef.current = false;
    setZoneDrawState(null);
    setZoneDragState(null);
    setZoneResizeState(null);
  }

  // --- Dispatch based on editor mode ---

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (editorMode === 'zones') {
      handleZonePointerDown(e);
    } else {
      handleLayerPointerDown(e);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (editorMode === 'zones') {
      handleZonePointerMove(e);
    } else {
      handleLayerPointerMove(e);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (editorMode === 'zones') {
      handleZonePointerUp(e);
    } else {
      handleLayerPointerUp(e);
    }
  }

  const cursor = editorMode === 'zones' ? 'crosshair' : activeFrame ? 'crosshair' : 'default';

  return (
    <div className={`overflow-auto border rounded-lg inline-block ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        className="max-w-full"
        style={{
          cursor,
          imageRendering: 'pixelated',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
