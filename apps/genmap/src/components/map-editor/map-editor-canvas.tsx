'use client';

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type Dispatch,
} from 'react';
import type {
  MapEditorState,
  MapEditorAction,
  PlacedObject,
  ZoneBounds,
  ZoneVertex,
  TileCoord as TilePos,
} from '@nookstead/map-lib';
import {
  computeRectBounds,
  clampBounds,
  isSimplePolygon,
  toZoneVertices,
} from '@nookstead/map-lib';
import {
  renderMapCanvas,
  drawGhostPreview,
  type Camera,
  type CanvasConfig,
  type PreviewRect,
  type ObjectRenderEntry,
  type BrushPreview,
} from './canvas-renderer';
import { createBrushTool } from './tools/brush-tool';
import { createFillTool } from './tools/fill-tool';
import { createRectangleTool } from './tools/rectangle-tool';
import { createEraserTool } from './tools/eraser-tool';
import { createFenceTool, type FencePlacementMode } from './tools/fence-tool';
import { createFenceEraserTool } from './tools/fence-eraser-tool';
import { drawZoneOverlay } from './zone-overlay';

const TILE_SIZE = 16;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/** Handlers returned by each tool factory. */
export interface ToolHandlers {
  onMouseDown: (tile: { x: number; y: number }) => void;
  onMouseMove: (tile: { x: number; y: number }) => void;
  onMouseUp: (tile: { x: number; y: number }) => void;
}

interface MapEditorCanvasProps {
  state: MapEditorState;
  dispatch: Dispatch<MapEditorAction>;
  tilesetImages: Map<string, HTMLImageElement>;
  /** Controlled camera state. If provided, the component uses this instead of internal state. */
  camera?: Camera;
  /** Callback when camera changes. Required when camera prop is provided. */
  onCameraChange?: (camera: Camera) => void;
  /** Controlled grid visibility. If provided, the component uses this instead of internal state. */
  showGrid?: boolean;
  /** Callback when grid toggle is requested. Required when showGrid prop is provided. */
  onToggleGrid?: () => void;
  /** Called when zone-rect drawing completes. Provides clamped bounds. */
  onZoneRectComplete?: (bounds: ZoneBounds) => void;
  /** Called when zone-poly drawing completes. Provides validated vertices. */
  onZonePolyComplete?: (vertices: ZoneVertex[]) => void;
  /** Zones to render as overlay. */
  zones?: import('@nookstead/map-lib').ZoneData[];
  /** Currently selected zone ID for highlighted border. */
  selectedZoneId?: string | null;
  /** Whether zone overlay is visible. */
  zoneVisibility?: boolean;
  /** Whether walkability overlay is visible. */
  showWalkability?: boolean;
  /** Called on mouse move with tile coordinates, or null when mouse leaves canvas. */
  onCursorMove?: (position: { x: number; y: number } | null) => void;
  /** Placed objects to render on the canvas. */
  placedObjects?: PlacedObject[];
  /** Called when an object is placed on the canvas in object-place mode. */
  onObjectPlace?: (gridX: number, gridY: number) => void;
  /** Render data for placed objects keyed by objectId. */
  objectRenderData?: Map<string, ObjectRenderEntry>;
  /** Currently selected object ID for ghost preview in object-place mode. */
  selectedObjectId?: string | null;
  /** Fence placement mode (single, rectangle, line). */
  fencePlacementMode?: FencePlacementMode;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Main HTML5 Canvas 2D editor component.
 * Renders map layers with viewport culling, handles mouse events for camera
 * pan/zoom and tool interactions, dispatches paint commands to the reducer.
 */
export function MapEditorCanvas({
  state,
  dispatch,
  tilesetImages,
  camera: controlledCamera,
  onCameraChange,
  showGrid: controlledShowGrid,
  onToggleGrid,
  onZoneRectComplete,
  onZonePolyComplete,
  zones: zonesProp,
  selectedZoneId,
  zoneVisibility,
  showWalkability,
  onCursorMove,
  placedObjects,
  onObjectPlace,
  objectRenderData,
  selectedObjectId,
  fencePlacementMode,
}: MapEditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Camera state (internal fallback when not controlled)
  const [internalCamera, setInternalCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const camera = controlledCamera ?? internalCamera;

  // Ref to always have the latest camera for functional updaters in controlled mode
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const setCamera = useCallback(
    (updater: Camera | ((prev: Camera) => Camera)) => {
      if (onCameraChange) {
        const newCam = typeof updater === 'function' ? updater(cameraRef.current) : updater;
        onCameraChange(newCam);
      } else {
        setInternalCamera(updater);
      }
    },
    [onCameraChange]
  );

  // UI state (internal fallback when not controlled)
  const [cursorTile, setCursorTile] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [internalShowGrid, setInternalShowGrid] = useState(true);
  const showGrid = controlledShowGrid ?? internalShowGrid;
  const [previewRect, setPreviewRect] = useState<PreviewRect | null>(null);

  // Container size tracked via ResizeObserver
  const [containerSize, setContainerSize] = useState<{
    w: number;
    h: number;
  }>({ w: 0, h: 0 });

  // Panning refs (avoid re-renders during pan drag)
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    cameraX: number;
    cameraY: number;
  }>({ clientX: 0, clientY: 0, cameraX: 0, cameraY: 0 });

  // Tool drawing refs
  const isDrawingRef = useRef(false);

  // Shift key tracking for gate toggle
  const isShiftRef = useRef(false);

  // Zone drawing refs
  const zoneRectStartRef = useRef<TilePos | null>(null);
  const zoneRectPreviewRef = useRef<ZoneBounds | null>(null);
  const polyVerticesRef = useRef<TilePos[]>([]);
  const polyCursorRef = useRef<TilePos | null>(null);
  const isClosingPolyRef = useRef(false);

  // Track container size with ResizeObserver
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

  // Expose showGrid toggle
  const toggleGrid = useCallback(() => {
    if (onToggleGrid) {
      onToggleGrid();
    } else {
      setInternalShowGrid((prev) => !prev);
    }
  }, [onToggleGrid]);

  // Convert pixel coordinates to tile coordinates
  const pixelToTile = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: -1, y: -1 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;
      const worldX = canvasX / camera.zoom + camera.x;
      const worldY = canvasY / camera.zoom + camera.y;
      return {
        x: Math.floor(worldX / TILE_SIZE),
        y: Math.floor(worldY / TILE_SIZE),
      };
    },
    [camera]
  );

  // Create tool handlers based on active tool
  const toolHandlers = useMemo((): ToolHandlers => {
    const noop = () => { /* no-op for tools handled elsewhere */ };
    const noopHandlers: ToolHandlers = {
      onMouseDown: noop,
      onMouseMove: noop,
      onMouseUp: noop,
    };

    switch (state.activeTool) {
      case 'brush':
        return createBrushTool(state, dispatch, state.brushSize, state.brushShape);
      case 'fill':
        return createFillTool(state, dispatch);
      case 'rectangle':
        return createRectangleTool(state, dispatch, setPreviewRect);
      case 'eraser':
        return createEraserTool(state, dispatch, state.brushSize, state.brushShape);
      case 'zone-rect':
        return {
          onMouseDown: (tile) => {
            zoneRectStartRef.current = tile;
            zoneRectPreviewRef.current = null;
          },
          onMouseMove: (tile) => {
            if (zoneRectStartRef.current) {
              zoneRectPreviewRef.current = computeRectBounds(
                zoneRectStartRef.current,
                tile
              );
            }
          },
          onMouseUp: (tile) => {
            if (zoneRectStartRef.current) {
              const bounds = clampBounds(
                computeRectBounds(zoneRectStartRef.current, tile),
                state.width,
                state.height
              );
              zoneRectStartRef.current = null;
              zoneRectPreviewRef.current = null;
              onZoneRectComplete?.(bounds);
            }
          },
        };
      case 'zone-poly':
        return noopHandlers;
      case 'object-place':
        // Object placement handled by onObjectPlace callback in handlePointerDown
        return noopHandlers;
      case 'fence':
        return createFenceTool(
          state,
          dispatch,
          fencePlacementMode ?? 'single',
          setPreviewRect,
          () => isShiftRef.current
        );
      case 'fence-eraser':
        return createFenceEraserTool(state, dispatch);
    }
  }, [state.activeTool, state.activeMaterialKey, state.activeLayerIndex, state.activeFenceTypeKey, fencePlacementMode, dispatch, state, onZoneRectComplete]);

  // Clear previews when tool changes
  useEffect(() => {
    setPreviewRect(null);
    zoneRectStartRef.current = null;
    zoneRectPreviewRef.current = null;
    polyVerticesRef.current = [];
    polyCursorRef.current = null;
  }, [state.activeTool]);

  // Canvas rendering config
  const config: CanvasConfig = useMemo(
    () => ({
      tileSize: TILE_SIZE,
      showGrid,
      showWalkability: showWalkability ?? false,
    }),
    [showGrid, showWalkability]
  );

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || containerSize.w === 0 || containerSize.h === 0)
      return;

    // Sync canvas buffer size to container
    if (canvas.width !== containerSize.w || canvas.height !== containerSize.h) {
      canvas.width = containerSize.w;
      canvas.height = containerSize.h;
    }

    const isBrushLike = state.activeTool === 'brush' || state.activeTool === 'eraser';
    const brushPreview: BrushPreview | undefined =
      isBrushLike ? { brushSize: state.brushSize, brushShape: state.brushShape } : undefined;

    renderMapCanvas(
      ctx,
      state,
      tilesetImages,
      camera,
      config,
      cursorTile,
      previewRect,
      objectRenderData,
      brushPreview
    );

    // Ghost preview: render selected object at cursor grid-snapped position
    if (
      state.activeTool === 'object-place' &&
      selectedObjectId &&
      objectRenderData &&
      cursorTile
    ) {
      drawGhostPreview(
        ctx,
        objectRenderData,
        selectedObjectId,
        cursorTile.x,
        cursorTile.y,
        TILE_SIZE,
        camera
      );
    }

    // Zone visibility overlay (existing zones)
    if (zoneVisibility && zonesProp && zonesProp.length > 0) {
      drawZoneOverlay({
        ctx,
        zones: zonesProp,
        selectedZoneId: selectedZoneId ?? null,
        tileSize: TILE_SIZE,
        camera,
      });
    }

    // Zone-rect preview overlay
    const zrp = zoneRectPreviewRef.current;
    if (state.activeTool === 'zone-rect' && zrp) {
      ctx.save();
      ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
      ctx.lineWidth = 1;
      const px = (zrp.x * TILE_SIZE - camera.x) * camera.zoom;
      const py = (zrp.y * TILE_SIZE - camera.y) * camera.zoom;
      const pw = zrp.width * TILE_SIZE * camera.zoom;
      const ph = zrp.height * TILE_SIZE * camera.zoom;
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeRect(px, py, pw, ph);
      ctx.restore();
    }

    // Zone-poly preview overlay
    const pv = polyVerticesRef.current;
    if (state.activeTool === 'zone-poly' && pv.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(233, 30, 99, 0.3)';
      ctx.strokeStyle = 'rgba(233, 30, 99, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const firstX = (pv[0].x * TILE_SIZE - camera.x) * camera.zoom;
      const firstY = (pv[0].y * TILE_SIZE - camera.y) * camera.zoom;
      ctx.moveTo(firstX, firstY);
      for (let i = 1; i < pv.length; i++) {
        const vx = (pv[i].x * TILE_SIZE - camera.x) * camera.zoom;
        const vy = (pv[i].y * TILE_SIZE - camera.y) * camera.zoom;
        ctx.lineTo(vx, vy);
      }
      // Line to cursor
      const cursor = polyCursorRef.current;
      if (cursor) {
        const cx = (cursor.x * TILE_SIZE - camera.x) * camera.zoom;
        const cy = (cursor.y * TILE_SIZE - camera.y) * camera.zoom;
        ctx.lineTo(cx, cy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, [state, tilesetImages, camera, config, cursorTile, previewRect, containerSize, zoneVisibility, zonesProp, selectedZoneId, objectRenderData, selectedObjectId]);

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

  // Mouse event handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Right-click or middle-click: start panning
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          cameraX: camera.x,
          cameraY: camera.y,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Left-click: tool interaction
      if (e.button === 0) {
        const tile = pixelToTile(e.clientX, e.clientY);

        // Object-place mode: place object at grid position instead of painting
        if (state.activeTool === 'object-place') {
          onObjectPlace?.(tile.x, tile.y);
          return;
        }

        // Zone-poly: click adds vertex, double-click closes
        if (state.activeTool === 'zone-poly') {
          if (isClosingPolyRef.current) return;
          if (e.detail >= 2) {
            // Double-click: close polygon
            isClosingPolyRef.current = true;
            const verts = polyVerticesRef.current;
            if (verts.length < 3) {
              polyVerticesRef.current = [];
              polyCursorRef.current = null;
              isClosingPolyRef.current = false;
            } else if (!isSimplePolygon(verts)) {
              polyVerticesRef.current = [];
              polyCursorRef.current = null;
              isClosingPolyRef.current = false;
            } else {
              const vertices = toZoneVertices(verts);
              polyVerticesRef.current = [];
              polyCursorRef.current = null;
              isClosingPolyRef.current = false;
              onZonePolyComplete?.(vertices);
            }
          } else {
            polyVerticesRef.current = [...polyVerticesRef.current, tile];
          }
          return;
        }

        isDrawingRef.current = true;
        toolHandlers.onMouseDown(tile);
        canvas.setPointerCapture(e.pointerId);
      }
    },
    [camera, pixelToTile, toolHandlers, onObjectPlace]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Panning
      if (isPanningRef.current) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const dx = (e.clientX - panStartRef.current.clientX) * scaleX;
        const dy = (e.clientY - panStartRef.current.clientY) * scaleY;
        setCamera((prev) => ({
          ...prev,
          x: panStartRef.current.cameraX - dx / prev.zoom,
          y: panStartRef.current.cameraY - dy / prev.zoom,
        }));
        return;
      }

      const tile = pixelToTile(e.clientX, e.clientY);
      setCursorTile(tile);

      // Report tile coordinates to parent via callback
      if (onCursorMove) {
        if (!isNaN(tile.x) && !isNaN(tile.y)) {
          onCursorMove({ x: tile.x, y: tile.y });
        } else {
          onCursorMove(null);
        }
      }

      // Zone-poly: update cursor for preview line
      if (state.activeTool === 'zone-poly' && polyVerticesRef.current.length > 0) {
        polyCursorRef.current = tile;
      }

      // Tool drag
      if (isDrawingRef.current) {
        toolHandlers.onMouseMove(tile);
      }
    },
    [pixelToTile, toolHandlers, onCursorMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.releasePointerCapture(e.pointerId);

      if (isPanningRef.current) {
        isPanningRef.current = false;
        return;
      }

      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        const tile = pixelToTile(e.clientX, e.clientY);
        toolHandlers.onMouseUp(tile);
      }
    },
    [pixelToTile, toolHandlers]
  );

  const handlePointerLeave = useCallback(() => {
    setCursorTile(null);
    if (onCursorMove) onCursorMove(null);
  }, [onCursorMove]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
    },
    []
  );

  // Wheel zoom handler -- zoom toward cursor position
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseCanvasX = (e.clientX - rect.left) * scaleX;
      const mouseCanvasY = (e.clientY - rect.top) * scaleY;

      setCamera((prev) => {
        const direction = e.deltaY > 0 ? -1 : 1;
        const newZoom = clamp(prev.zoom + direction * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
        if (newZoom === prev.zoom) return prev;

        // Zoom toward cursor: keep world point under cursor at same screen position
        const worldX = mouseCanvasX / prev.zoom + prev.x;
        const worldY = mouseCanvasY / prev.zoom + prev.y;
        const newCameraX = worldX - mouseCanvasX / newZoom;
        const newCameraY = worldY - mouseCanvasY / newZoom;

        return { x: newCameraX, y: newCameraY, zoom: newZoom };
      });
    },
    []
  );

  // Attach wheel handler with passive: false
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Keyboard handler for grid toggle + zone polygon close/cancel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'g' || e.key === 'G') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          toggleGrid();
        }
      }

      // Zone polygon: Enter = close, Escape = cancel
      if (state.activeTool === 'zone-poly') {
        if (e.key === 'Enter') {
          const verts = polyVerticesRef.current;
          if (verts.length >= 3 && isSimplePolygon(verts)) {
            const vertices = toZoneVertices(verts);
            polyVerticesRef.current = [];
            polyCursorRef.current = null;
            onZonePolyComplete?.(vertices);
          } else {
            polyVerticesRef.current = [];
            polyCursorRef.current = null;
          }
        } else if (e.key === 'Escape') {
          polyVerticesRef.current = [];
          polyCursorRef.current = null;
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleGrid, state.activeTool, onZonePolyComplete]);

  // Track shift key state for fence gate toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Shift') isShiftRef.current = true;
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift') isShiftRef.current = false;
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full overflow-hidden rounded-lg border relative"
      tabIndex={0}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: isPanningRef.current ? 'grabbing' : 'crosshair',
          imageRendering: 'pixelated',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
      />
      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 bg-background/80 text-xs px-2 py-1 rounded border">
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
}
