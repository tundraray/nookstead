'use client';

import { useEffect, useRef, useState, type Dispatch } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';
import type { Camera } from './canvas-renderer';

interface MapEditorToolbarProps {
  state: MapEditorState;
  dispatch: Dispatch<MapEditorAction>;
  save: () => Promise<void>;
  camera: Camera;
  onCameraChange: (camera: Camera) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const TOOLS = [
  { key: 'brush' as const, label: 'Brush', shortcut: 'B' },
  { key: 'fill' as const, label: 'Fill', shortcut: 'F' },
  { key: 'rectangle' as const, label: 'Rect', shortcut: 'R' },
  { key: 'eraser' as const, label: 'Eraser', shortcut: 'E' },
] as const;

/**
 * Toolbar component for the map editor.
 * Provides tool selection, undo/redo, save, zoom controls, and grid toggle.
 */
export function MapEditorToolbar({
  state,
  dispatch,
  save,
  camera,
  onCameraChange,
  showGrid,
  onToggleGrid,
}: MapEditorToolbarProps) {
  // Track "Saved" momentary label state
  const [showSavedLabel, setShowSavedLabel] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show "Saved" label briefly after a successful save
  const wasSavingRef = useRef(false);
  useEffect(() => {
    if (wasSavingRef.current && !state.isSaving && !state.isDirty) {
      setShowSavedLabel(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setShowSavedLabel(false);
      }, 2000);
    }
    wasSavingRef.current = state.isSaving;
  }, [state.isSaving, state.isDirty]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Keyboard shortcuts for tool selection (B, F, R, E)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip when an input element is focused
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Skip if modifier keys are held
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      switch (key) {
        case 'b':
          dispatch({ type: 'SET_TOOL', tool: 'brush' });
          break;
        case 'f':
          dispatch({ type: 'SET_TOOL', tool: 'fill' });
          break;
        case 'r':
          dispatch({ type: 'SET_TOOL', tool: 'rectangle' });
          break;
        case 'e':
          dispatch({ type: 'SET_TOOL', tool: 'eraser' });
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const handleZoomOut = () => {
    onCameraChange({
      ...camera,
      zoom: clamp(camera.zoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM),
    });
  };

  const handleZoomIn = () => {
    onCameraChange({
      ...camera,
      zoom: clamp(camera.zoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM),
    });
  };

  const handleFitToView = () => {
    onCameraChange({ x: 0, y: 0, zoom: 1 });
  };

  // Determine save button label
  let saveLabel = 'Save';
  if (state.isSaving) {
    saveLabel = 'Saving...';
  } else if (showSavedLabel) {
    saveLabel = 'Saved';
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 flex-wrap mb-2 text-xs">
        {/* Tool selection buttons */}
        <div className="flex items-center gap-0.5">
          {TOOLS.map((tool) => (
            <Tooltip key={tool.key}>
              <TooltipTrigger asChild>
                <Button
                  variant={
                    state.activeTool === tool.key ? 'secondary' : 'ghost'
                  }
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() =>
                    dispatch({ type: 'SET_TOOL', tool: tool.key })
                  }
                >
                  {tool.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {tool.label} ({tool.shortcut})
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                disabled={state.undoStack.length === 0}
                onClick={() => dispatch({ type: 'UNDO' })}
              >
                Undo
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                disabled={state.redoStack.length === 0}
                onClick={() => dispatch({ type: 'REDO' })}
              >
                Redo
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Save button with indicator */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2 gap-1.5"
                disabled={state.isSaving}
                onClick={() => {
                  save();
                }}
              >
                {state.isSaving && (
                  <span className="inline-block size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {saveLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (Ctrl+S)</TooltipContent>
          </Tooltip>
          {/* Save status indicator dot */}
          {!state.isDirty && state.lastSavedAt ? (
            <span
              className="size-2 rounded-full bg-green-500"
              title={`Saved at ${new Date(state.lastSavedAt).toLocaleTimeString()}`}
            />
          ) : state.isDirty ? (
            <span
              className="size-2 rounded-full bg-amber-500"
              title="Unsaved changes"
            />
          ) : null}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-1.5"
                onClick={handleZoomOut}
                disabled={camera.zoom <= MIN_ZOOM}
              >
                -
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>
          <span className="w-10 text-center text-xs tabular-nums">
            {Math.round(camera.zoom * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-1.5"
                onClick={handleZoomIn}
                disabled={camera.zoom >= MAX_ZOOM}
              >
                +
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={handleFitToView}
              >
                Fit
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset View</TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Grid toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showGrid ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={onToggleGrid}
            >
              Grid
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Grid (G)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
