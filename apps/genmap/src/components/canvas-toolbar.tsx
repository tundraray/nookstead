'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type EditorMode = 'layers' | 'zones';
export type SnapMode = 'snap' | 'free';

const GRID_PRESETS = [8, 16, 32, 64] as const;

interface CanvasToolbarProps {
  canvasWidth: number;
  canvasHeight: number;
  onCanvasWidthChange: (w: number) => void;
  onCanvasHeightChange: (h: number) => void;
  onFit: () => void;
  hasLayers?: boolean;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  snapMode: SnapMode;
  onSnapModeChange: (mode: SnapMode) => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
}

export function CanvasToolbar({
  canvasWidth,
  canvasHeight,
  onCanvasWidthChange,
  onCanvasHeightChange,
  onFit,
  hasLayers = true,
  gridSize,
  onGridSizeChange,
  showGrid,
  onShowGridChange,
  snapMode,
  onSnapModeChange,
  editorMode,
  onEditorModeChange,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-2 text-xs">
      {/* Canvas Size */}
      <div className="flex items-center gap-1" title="Canvas width and height in pixels">
        <Label className="text-xs text-muted-foreground">Size:</Label>
        <Input
          type="number"
          value={canvasWidth}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 64 && v <= 2048) onCanvasWidthChange(v);
          }}
          className="w-16 h-7 text-xs"
          min={64}
          max={2048}
          step={gridSize}
          title="Canvas width (px)"
        />
        <span className="text-muted-foreground">x</span>
        <Input
          type="number"
          value={canvasHeight}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 64 && v <= 2048) onCanvasHeightChange(v);
          }}
          className="w-16 h-7 text-xs"
          min={64}
          max={2048}
          step={gridSize}
          title="Canvas height (px)"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={onFit}
          disabled={!hasLayers}
          title="Fit canvas to content — adjusts size to fit all layers with padding"
        >
          Fit
        </Button>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Grid Presets */}
      <div className="flex items-center gap-1" title="Grid cell size presets">
        <Label className="text-xs text-muted-foreground">Grid:</Label>
        {GRID_PRESETS.map((size) => (
          <Button
            key={size}
            variant={gridSize === size ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2 min-w-8"
            onClick={() => onGridSizeChange(size)}
            title={`Set grid to ${size}x${size} pixels`}
          >
            {size}
          </Button>
        ))}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Grid Toggle */}
      <Button
        variant={showGrid ? 'default' : 'outline'}
        size="sm"
        className="h-7 text-xs px-2"
        onClick={() => onShowGridChange(!showGrid)}
        title={showGrid ? 'Hide grid lines' : 'Show grid lines on canvas'}
      >
        {showGrid ? 'Grid ON' : 'Grid OFF'}
      </Button>

      {/* Snap Toggle */}
      <Button
        variant={snapMode === 'snap' ? 'default' : 'outline'}
        size="sm"
        className="h-7 text-xs px-2"
        onClick={() => onSnapModeChange(snapMode === 'snap' ? 'free' : 'snap')}
        title={
          snapMode === 'snap'
            ? 'Snap mode — layers snap to grid positions. Click to switch to free mode.'
            : 'Free mode — layers can be placed at any position. Click to enable snap to grid.'
        }
      >
        {snapMode === 'snap' ? 'Snap' : 'Free'}
      </Button>

      <div className="w-px h-5 bg-border" />

      {/* Editor Mode */}
      <div className="flex items-center gap-1" title="Switch between layer editing and collision zone editing">
        <Button
          variant={editorMode === 'layers' ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => onEditorModeChange('layers')}
          title="Layer mode — add, select, and move sprite layers"
        >
          Layers
        </Button>
        <Button
          variant={editorMode === 'zones' ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => onEditorModeChange('zones')}
          title="Zone mode — draw and edit collision/walkability zones"
        >
          Zones
        </Button>
      </div>
    </div>
  );
}
