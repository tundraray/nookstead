'use client';

import { useState, useRef, useCallback, type Dispatch } from 'react';
import {
  EyeIcon,
  EyeOffIcon,
  Grid3X3Icon,
  GripVerticalIcon,
  PackageIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  MapEditorState,
  MapEditorAction,
  EditorLayer,
  ObjectLayer,
} from '@/hooks/map-editor-types';

interface LayerPanelProps {
  state: MapEditorState;
  dispatch: Dispatch<MapEditorAction>;
}

/** Check if a layer has any data (painted frames for TileLayer, objects for ObjectLayer). */
function layerHasData(layer: EditorLayer): boolean {
  const layerType = (layer as unknown as { type: string }).type;
  if (layerType === 'object') {
    const objLayer = layer as unknown as ObjectLayer;
    return objLayer.objects.length > 0;
  }
  // TileLayer: check for non-zero frame data
  for (const row of layer.frames) {
    for (const frame of row) {
      if (frame !== 0) return true;
    }
  }
  return false;
}

/** Get the layer type, defaulting to 'tile' for backward compatibility. */
function getLayerType(layer: EditorLayer): 'tile' | 'object' {
  return ((layer as unknown as { type: string }).type as 'tile' | 'object') ?? 'tile';
}

/**
 * Layer management panel component.
 *
 * Displays layers in a vertical list (top of list = highest render order,
 * bottom of list = lowest render order). Provides controls for visibility,
 * opacity, add, remove, reorder (drag-and-drop via pointer events), and
 * active layer selection.
 */
export function LayerPanel({ state, dispatch }: LayerPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [newLayerName, setNewLayerName] = useState('');
  const [newTerrainKey, setNewTerrainKey] = useState('');
  const [newLayerType, setNewLayerType] = useState<'tile' | 'object'>('tile');

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Display layers in reverse order (top of list = highest index = top render layer)
  const displayOrder = [...state.layers].map((_, i) => i).reverse();

  const handleAddLayer = useCallback(() => {
    const trimmedName = newLayerName.trim();
    if (!trimmedName) return;

    if (newLayerType === 'object') {
      dispatch({ type: 'ADD_OBJECT_LAYER', name: trimmedName });
    } else {
      const trimmedKey = newTerrainKey.trim();
      if (!trimmedKey) return;
      dispatch({ type: 'ADD_LAYER', name: trimmedName, terrainKey: trimmedKey });
    }

    setNewLayerName('');
    setNewTerrainKey('');
    setNewLayerType('tile');
    setAddDialogOpen(false);
  }, [newLayerName, newTerrainKey, newLayerType, dispatch]);

  const handleRemoveClick = useCallback(
    (index: number) => {
      const layer = state.layers[index];
      if (layer && layerHasData(layer)) {
        setRemoveIndex(index);
        setRemoveDialogOpen(true);
      } else {
        dispatch({ type: 'REMOVE_LAYER', index });
      }
    },
    [state.layers, dispatch]
  );

  const handleConfirmRemove = useCallback(() => {
    if (removeIndex !== null) {
      dispatch({ type: 'REMOVE_LAYER', index: removeIndex });
    }
    setRemoveDialogOpen(false);
    setRemoveIndex(null);
  }, [removeIndex, dispatch]);

  // Drag-and-drop handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, layerIndex: number) => {
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      setDragIndex(layerIndex);
      setHoverIndex(layerIndex);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragIndex === null) return;

      // Compute which layer index the pointer is hovering over
      // by checking y position against item rects
      const listEl = listRef.current;
      if (!listEl) return;

      let closestIndex = dragIndex;
      let closestDistance = Infinity;

      for (const [idx, el] of itemRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const distance = Math.abs(e.clientY - centerY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = idx;
        }
      }

      setHoverIndex(closestIndex);
    },
    [dragIndex]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      target.releasePointerCapture(e.pointerId);

      if (dragIndex !== null && hoverIndex !== null && hoverIndex !== dragIndex) {
        dispatch({
          type: 'REORDER_LAYERS',
          fromIndex: dragIndex,
          toIndex: hoverIndex,
        });
      }

      setDragIndex(null);
      setHoverIndex(null);
    },
    [dragIndex, hoverIndex, dispatch]
  );

  const setItemRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      if (el) {
        itemRefs.current.set(index, el);
      } else {
        itemRefs.current.delete(index);
      }
    },
    []
  );

  return (
    <div className="space-y-2">
      <div ref={listRef} className="space-y-1">
        {displayOrder.map((layerIndex) => {
          const layer = state.layers[layerIndex];
          const isActive = state.activeLayerIndex === layerIndex;
          const isDragging = dragIndex === layerIndex;
          const isDropTarget =
            dragIndex !== null &&
            hoverIndex === layerIndex &&
            hoverIndex !== dragIndex;

          return (
            <div
              key={layer.id}
              ref={setItemRef(layerIndex)}
              className={[
                'flex items-center gap-1 p-1.5 rounded text-xs transition-colors',
                isActive ? 'bg-accent' : 'hover:bg-muted/50',
                isDragging ? 'opacity-50' : '',
                isDropTarget ? 'ring-1 ring-primary' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', index: layerIndex })}
            >
              {/* Drag handle */}
              <div
                className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handlePointerDown(e, layerIndex);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <GripVerticalIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>

              {/* Layer type icon */}
              <div className="flex-shrink-0">
                {getLayerType(layer) === 'object' ? (
                  <PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Grid3X3Icon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>

              {/* Layer name and metadata */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() =>
                  dispatch({ type: 'SET_ACTIVE_LAYER', index: layerIndex })
                }
              >
                <div className="truncate font-medium">{layer.name}</div>
                <div className="text-muted-foreground truncate text-[10px]">
                  {getLayerType(layer) === 'object'
                    ? `${(layer as unknown as ObjectLayer).objects.length} object${(layer as unknown as ObjectLayer).objects.length !== 1 ? 's' : ''}`
                    : layer.terrainKey}
                </div>
              </div>

              {/* Visibility toggle */}
              <button
                type="button"
                className="flex-shrink-0 p-0.5 hover:bg-muted rounded"
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({
                    type: 'TOGGLE_LAYER_VISIBILITY',
                    index: layerIndex,
                  });
                }}
              >
                {layer.visible ? (
                  <EyeIcon className="h-3.5 w-3.5" />
                ) : (
                  <EyeOffIcon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {/* Remove button */}
              <button
                type="button"
                className="flex-shrink-0 p-0.5 hover:bg-destructive/20 rounded"
                title="Remove layer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveClick(layerIndex);
                }}
              >
                <Trash2Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Opacity slider and terrain key -- only for TileLayer */}
      {state.layers[state.activeLayerIndex] &&
        getLayerType(state.layers[state.activeLayerIndex]) === 'tile' && (
          <div className="pt-1 border-t">
            <Label className="text-xs text-muted-foreground">
              Opacity:{' '}
              {Math.round(state.layers[state.activeLayerIndex].opacity * 100)}%
            </Label>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(
                state.layers[state.activeLayerIndex].opacity * 100
              )}
              onChange={(e) =>
                dispatch({
                  type: 'SET_LAYER_OPACITY',
                  index: state.activeLayerIndex,
                  opacity: Number(e.target.value) / 100,
                })
              }
              className="w-full h-1.5 accent-primary"
            />
          </div>
        )}

      {/* Add layer button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => setAddDialogOpen(true)}
      >
        <PlusIcon className="h-3.5 w-3.5 mr-1" />
        Add Layer
      </Button>

      {/* Add layer dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Layer</DialogTitle>
            <DialogDescription>
              Create a new layer for the map.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Layer type selector */}
            <div className="space-y-1.5">
              <Label className="text-sm">Layer Type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors',
                    newLayerType === 'tile'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted',
                  ].join(' ')}
                  onClick={() => setNewLayerType('tile')}
                >
                  <Grid3X3Icon className="h-3.5 w-3.5" />
                  Tile Layer
                </button>
                <button
                  type="button"
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors',
                    newLayerType === 'object'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted',
                  ].join(' ')}
                  onClick={() => setNewLayerType('object')}
                >
                  <PackageIcon className="h-3.5 w-3.5" />
                  Object Layer
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="layer-name" className="text-sm">
                Layer Name
              </Label>
              <Input
                id="layer-name"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                placeholder={
                  newLayerType === 'object' ? 'e.g. decorations' : 'e.g. roads'
                }
                autoFocus
              />
            </div>

            {/* Terrain key -- only for tile layers */}
            {newLayerType === 'tile' && (
              <div className="space-y-1.5">
                <Label htmlFor="terrain-key" className="text-sm">
                  Terrain Key
                </Label>
                <Input
                  id="terrain-key"
                  value={newTerrainKey}
                  onChange={(e) => setNewTerrainKey(e.target.value)}
                  placeholder="e.g. terrain-25"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddLayer}
              disabled={
                !newLayerName.trim() ||
                (newLayerType === 'tile' && !newTerrainKey.trim())
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Layer</DialogTitle>
            <DialogDescription>
              {removeIndex !== null &&
              getLayerType(state.layers[removeIndex]) === 'object'
                ? 'This layer has placed objects. Removing it will delete all object data for this layer. This cannot be undone.'
                : 'This layer has painted cells. Removing it will delete all terrain data for this layer. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRemoveDialogOpen(false);
                setRemoveIndex(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmRemove}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
