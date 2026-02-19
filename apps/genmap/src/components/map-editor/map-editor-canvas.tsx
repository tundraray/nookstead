'use client';

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type Dispatch,
} from 'react';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';
import {
  renderMapCanvas,
  type Camera,
  type CanvasConfig,
  type PreviewRect,
} from './canvas-renderer';
import { createBrushTool } from './tools/brush-tool';
import { createFillTool } from './tools/fill-tool';
import { createRectangleTool } from './tools/rectangle-tool';
import { createEraserTool } from './tools/eraser-tool';

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
    switch (state.activeTool) {
      case 'brush':
        return createBrushTool(state, dispatch);
      case 'fill':
        return createFillTool(state, dispatch);
      case 'rectangle':
        return createRectangleTool(state, dispatch, setPreviewRect);
      case 'eraser':
        return createEraserTool(state, dispatch);
    }
  }, [state.activeTool, state.activeTerrainKey, state.activeLayerIndex, dispatch, state]);

  // Clear preview rect when tool changes
  useEffect(() => {
    setPreviewRect(null);
  }, [state.activeTool]);

  // Canvas rendering config
  const config: CanvasConfig = useMemo(
    () => ({
      tileSize: TILE_SIZE,
      showGrid,
    }),
    [showGrid]
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

    renderMapCanvas(
      ctx,
      state,
      tilesetImages,
      camera,
      config,
      cursorTile,
      previewRect
    );
  }, [state, tilesetImages, camera, config, cursorTile, previewRect, containerSize]);

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
        isDrawingRef.current = true;
        const tile = pixelToTile(e.clientX, e.clientY);
        toolHandlers.onMouseDown(tile);
        canvas.setPointerCapture(e.pointerId);
      }
    },
    [camera, pixelToTile, toolHandlers]
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

      // Tool drag
      if (isDrawingRef.current) {
        toolHandlers.onMouseMove(tile);
      }
    },
    [pixelToTile, toolHandlers]
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
  }, []);

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

  // Keyboard handler for grid toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'g' || e.key === 'G') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          toggleGrid();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleGrid]);

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
