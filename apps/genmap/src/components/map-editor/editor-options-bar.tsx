'use client';

import { useEffect, type Dispatch } from 'react';
import {
  Undo2,
  Redo2,
  Minus,
  Plus,
  Grid3X3,
  Footprints,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type {
  MapEditorState,
  MapEditorAction,
  EditorTool,
} from '@nookstead/map-lib';
import type { Camera } from './canvas-renderer';
import type { ZoneType } from '@nookstead/map-lib';

/* ---------- constants ---------- */

const TOOL_LABELS: Record<EditorTool, string> = {
  brush: 'Brush',
  fill: 'Fill',
  rectangle: 'Rectangle',
  eraser: 'Eraser',
  'zone-rect': 'Zone Rect',
  'zone-poly': 'Zone Poly',
  'object-place': 'Object Place',
  fence: 'Fence',
  'fence-eraser': 'Fence Eraser',
};

const ZONE_TYPE_OPTIONS: { value: ZoneType; label: string }[] = [
  { value: 'crop_field', label: 'Crop Field' },
  { value: 'path', label: 'Path' },
  { value: 'water_feature', label: 'Water Feature' },
  { value: 'decoration', label: 'Decoration' },
  { value: 'spawn_point', label: 'Spawn Point' },
  { value: 'transition', label: 'Transition' },
  { value: 'npc_location', label: 'NPC Location' },
  { value: 'animal_pen', label: 'Animal Pen' },
  { value: 'building_footprint', label: 'Building Footprint' },
  { value: 'transport_point', label: 'Transport Point' },
  { value: 'lighting', label: 'Lighting' },
];

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8.0;
const ZOOM_STEP = 0.25;

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ---------- types ---------- */

export interface EditorOptionsBarProps {
  state: MapEditorState;
  dispatch: Dispatch<MapEditorAction>;
  save: () => void;
  camera: Camera;
  onCameraChange: (camera: Camera) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showWalkability: boolean;
  onToggleWalkability: () => void;
  /** Optional slot for additional tool-specific controls (e.g., fence mode selector). */
  toolControls?: React.ReactNode;
}

/* ---------- sub-components ---------- */

/** Vertical divider between toolbar sections. */
function Divider() {
  return <div className="h-4 w-px bg-border mx-1" />;
}

/* ---------- main component ---------- */

/**
 * Context-sensitive 32px options bar that replaces MapEditorToolbar.
 * Shows the active tool name, tool-specific controls, undo/redo, save,
 * zoom controls, and grid/walkability toggles.
 *
 * All keyboard shortcuts from the original toolbar are ported here.
 */
export function EditorOptionsBar({
  state,
  dispatch,
  save,
  camera,
  onCameraChange,
  showGrid,
  onToggleGrid,
  showWalkability,
  onToggleWalkability,
  toolControls,
}: EditorOptionsBarProps) {
  const isZoneTool =
    state.activeTool === 'zone-rect' || state.activeTool === 'zone-poly';
  const isBrushLikeTool =
    state.activeTool === 'brush' || state.activeTool === 'eraser';

  /* ---- zoom handlers ---- */

  const handleZoom = (newZoom: number) => {
    onCameraChange({
      ...camera,
      zoom: clamp(newZoom, MIN_ZOOM, MAX_ZOOM),
    });
  };

  const handleFit = () => {
    onCameraChange({ x: 0, y: 0, zoom: 1 });
  };

  /* ---- keyboard shortcuts ---- */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip when an input/textarea/select is focused
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Modifier-key shortcuts (Ctrl/Cmd)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          dispatch({ type: 'UNDO' });
          return;
        }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          dispatch({ type: 'REDO' });
          return;
        }
        if (e.key === 's') {
          e.preventDefault();
          save();
          return;
        }
        return;
      }

      // Skip other modifier combinations
      if (e.altKey) return;

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
        case 'z':
          dispatch({ type: 'SET_TOOL', tool: 'zone-rect' });
          break;
        case 'p':
          dispatch({ type: 'SET_TOOL', tool: 'zone-poly' });
          break;
        case 'g':
          onToggleGrid();
          break;
        case 'w':
          onToggleWalkability();
          break;
        case '[':
          dispatch({ type: 'ADJUST_BRUSH_SIZE', delta: -1 });
          break;
        case ']':
          dispatch({ type: 'ADJUST_BRUSH_SIZE', delta: 1 });
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, save, onToggleGrid, onToggleWalkability]);

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Editor options"
        aria-orientation="horizontal"
        className="h-8 flex items-center gap-1 px-2 border-b bg-card flex-shrink-0"
      >
        {/* ---- Left section: tool name + context-sensitive controls ---- */}
        <div
          className="flex items-center gap-1.5 overflow-hidden"
          style={{
            maxWidth: isZoneTool ? 280 : isBrushLikeTool ? 340 : toolControls ? 400 : 120,
            opacity: 1,
            transition: 'max-width 150ms ease, opacity 150ms ease',
          }}
        >
          <span className="text-[11px] font-medium whitespace-nowrap">
            {TOOL_LABELS[state.activeTool]}
          </span>

          {/* Tool-specific controls slot */}
          {toolControls}

          {/* Zone type selector (zone-rect / zone-poly only) */}
          {isZoneTool && (
            <select
              className="h-6 text-[11px] bg-background border border-border rounded px-1 py-0"
              aria-label="Zone type"
              defaultValue="spawn_point"
            >
              {ZONE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Brush size slider + shape toggle (brush / eraser only) */}
          {isBrushLikeTool && (
            <>
              <input
                type="range"
                min={1}
                max={15}
                value={state.brushSize}
                onChange={(e) =>
                  dispatch({ type: 'SET_BRUSH_SIZE', size: Number(e.target.value) })
                }
                className="h-3 w-20 accent-primary"
                aria-label="Brush size"
              />
              <span className="text-[11px] tabular-nums w-5 text-center">
                {state.brushSize}
              </span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-6 w-6', state.brushShape === 'circle' && 'bg-accent')}
                    onClick={() => dispatch({ type: 'SET_BRUSH_SHAPE', shape: 'circle' })}
                    aria-label="Circle brush"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Circle Brush</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-6 w-6', state.brushShape === 'square' && 'bg-accent')}
                    onClick={() => dispatch({ type: 'SET_BRUSH_SHAPE', shape: 'square' })}
                    aria-label="Square brush"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Square Brush</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        <Divider />

        {/* ---- Undo / Redo ---- */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={state.undoStack.length === 0}
                onClick={() => dispatch({ type: 'UNDO' })}
                aria-label="Undo"
              >
                <Undo2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={state.redoStack.length === 0}
                onClick={() => dispatch({ type: 'REDO' })}
                aria-label="Redo"
              >
                <Redo2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <Divider />

        {/* ---- Save ---- */}
        <div className="flex items-center gap-1">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              state.isDirty ? 'bg-amber-500' : 'bg-green-500'
            )}
            title={state.isDirty ? 'Unsaved changes' : 'Saved'}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-6 px-1.5 text-[11px]"
                onClick={save}
                disabled={state.isSaving}
              >
                {state.isSaving ? 'Saving...' : 'Save'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (Ctrl+S)</TooltipContent>
          </Tooltip>
        </div>

        <Divider />

        {/* ---- Zoom controls ---- */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleZoom(camera.zoom - ZOOM_STEP)}
                disabled={camera.zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >
                <Minus size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>

          <span className="text-[11px] tabular-nums w-10 text-center">
            {Math.round(camera.zoom * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleZoom(camera.zoom + ZOOM_STEP)}
                disabled={camera.zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                <Plus size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-6 px-1.5 text-[11px]"
                onClick={handleFit}
              >
                Fit
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset View</TooltipContent>
          </Tooltip>
        </div>

        <Divider />

        {/* ---- Grid & Walkability toggles ---- */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-6 w-6', showGrid && 'bg-accent')}
                onClick={onToggleGrid}
                aria-label="Toggle grid"
              >
                <Grid3X3 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Grid (G)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-6 w-6', showWalkability && 'bg-accent')}
                onClick={onToggleWalkability}
                aria-label="Toggle walkability"
              >
                <Footprints size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Walkability (W)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
