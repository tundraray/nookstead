'use client';

import { useState, useEffect, useRef, type Dispatch } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MapEditorState, MapEditorAction } from '@nookstead/map-lib';

interface MapPropertiesPanelProps {
  state: MapEditorState;
  dispatch: Dispatch<MapEditorAction>;
}

/** Format mapType for display (e.g., 'player_homestead' -> 'Player Homestead'). */
function formatMapType(mapType: string | null): string {
  if (!mapType) return 'None';
  return mapType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Resize confirmation dialog sub-component. */
function ResizeDialog({
  open,
  onOpenChange,
  currentWidth,
  currentHeight,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWidth: number;
  currentHeight: number;
  onConfirm: (newWidth: number, newHeight: number) => void;
}) {
  const [newWidth, setNewWidth] = useState(currentWidth);
  const [newHeight, setNewHeight] = useState(currentHeight);

  // Reset values when dialog opens
  useEffect(() => {
    if (open) {
      setNewWidth(currentWidth);
      setNewHeight(currentHeight);
    }
  }, [open, currentWidth, currentHeight]);

  function handleConfirm() {
    if (newWidth > 0 && newHeight > 0) {
      onConfirm(newWidth, newHeight);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resize Map</DialogTitle>
          <DialogDescription>
            Expanding the map adds new cells with default terrain. Shrinking
            will remove cells from the right and bottom edges.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resize-width">Width</Label>
              <Input
                id="resize-width"
                type="number"
                min={1}
                max={256}
                value={newWidth}
                onChange={(e) => setNewWidth(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resize-height">Height</Label>
              <Input
                id="resize-height"
                type="number"
                min={1}
                max={256}
                value={newHeight}
                onChange={(e) => setNewHeight(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Current: {currentWidth} x {currentHeight}
            {newWidth !== currentWidth || newHeight !== currentHeight
              ? ` → ${newWidth} x ${newHeight}`
              : ''}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Resize</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Map properties sidebar panel.
 * Displays name (editable), mapType (read-only badge), dimensions (read-only + resize),
 * and seed (editable). Dispatches SET_NAME, SET_SEED, and RESIZE_MAP actions.
 */
export function MapPropertiesPanel({
  state,
  dispatch,
}: MapPropertiesPanelProps) {
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localName, setLocalName] = useState(state.name);

  // Sync local name when state changes externally (e.g., LOAD_MAP)
  useEffect(() => {
    setLocalName(state.name);
  }, [state.name]);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function handleNameChange(value: string) {
    setLocalName(value);

    // Debounce dispatch by 300ms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      dispatch({ type: 'SET_NAME', name: value });
    }, 300);
  }

  function handleSeedChange(value: string) {
    const parsed = parseInt(value);
    if (!isNaN(parsed)) {
      dispatch({ type: 'SET_SEED', seed: parsed });
    }
  }

  function handleResize(newWidth: number, newHeight: number) {
    dispatch({ type: 'RESIZE_MAP', newWidth, newHeight });
  }

  return (
    <div className="space-y-3">
      {/* Map Name */}
      <div className="space-y-1.5">
        <Label htmlFor="map-name" className="text-xs">
          Map Name
          {state.isDirty && (
            <span className="text-amber-500 ml-1" title="Unsaved changes">
              *
            </span>
          )}
        </Label>
        <Input
          id="map-name"
          value={localName}
          onChange={(e) => handleNameChange(e.target.value)}
          className="h-8 text-sm"
          placeholder="Untitled map"
        />
      </div>

      {/* Map Type */}
      <div className="space-y-1.5">
        <Label className="text-xs">Type</Label>
        <div>
          <Badge variant="secondary" className="text-xs">
            {formatMapType(state.mapType)}
          </Badge>
        </div>
      </div>

      {/* Dimensions */}
      <div className="space-y-1.5">
        <Label className="text-xs">Dimensions</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {state.width} x {state.height}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setShowResizeDialog(true)}
          >
            Resize
          </Button>
        </div>
      </div>

      {/* Seed */}
      <div className="space-y-1.5">
        <Label htmlFor="map-seed" className="text-xs">
          Seed
        </Label>
        <Input
          id="map-seed"
          type="number"
          value={state.seed}
          onChange={(e) => handleSeedChange(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Metadata */}
      <div className="space-y-1.5">
        <Label className="text-xs">Metadata</Label>
        <MetadataEditor
          metadata={state.metadata}
          onChange={(metadata) =>
            dispatch({ type: 'SET_METADATA', metadata })
          }
        />
      </div>

      {/* Resize Dialog */}
      <ResizeDialog
        open={showResizeDialog}
        onOpenChange={setShowResizeDialog}
        currentWidth={state.width}
        currentHeight={state.height}
        onConfirm={handleResize}
      />
    </div>
  );
}

/** Key-value metadata editor. */
function MetadataEditor({
  metadata,
  onChange,
}: {
  metadata: Record<string, string>;
  onChange: (metadata: Record<string, string>) => void;
}) {
  const [newKey, setNewKey] = useState('');

  const entries = Object.entries(metadata);

  function handleAdd() {
    const key = newKey.trim();
    if (!key || key in metadata) return;
    onChange({ ...metadata, [key]: '' });
    setNewKey('');
  }

  function handleRemove(key: string) {
    const next = { ...metadata };
    delete next[key];
    onChange(next);
  }

  function handleValueChange(key: string, value: string) {
    onChange({ ...metadata, [key]: value });
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No metadata</p>
      )}
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground truncate min-w-0 flex-shrink-0 max-w-[60px]" title={key}>
            {key}
          </span>
          <Input
            value={value}
            onChange={(e) => handleValueChange(key, e.target.value)}
            className="h-6 text-xs flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => handleRemove(key)}
          >
            x
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="New key"
          className="h-6 text-xs flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={handleAdd}
          disabled={!newKey.trim() || newKey.trim() in metadata}
        >
          +
        </Button>
      </div>
    </div>
  );
}
