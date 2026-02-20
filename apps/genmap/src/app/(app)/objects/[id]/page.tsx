'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AtlasFramePicker,
} from '@/components/atlas-frame-picker';
import {
  ObjectGridCanvas,
  type FrameLayer,
} from '@/components/object-grid-canvas';
import {
  ObjectPreview,
} from '@/components/object-preview';
import { Breadcrumb } from '@/components/breadcrumb';
import { CanvasBackgroundSelector } from '@/components/canvas-background-selector';
import { CanvasToolbar, type EditorMode, type SnapMode } from '@/components/canvas-toolbar';
import { CollisionZonePanel } from '@/components/collision-zone-panel';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useCanvasBackground } from '@/hooks/use-canvas-background';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useObjectEditor, type CollisionZone } from '@/hooks/use-object-editor';
import { toast } from 'sonner';

interface AtlasFrame {
  id: string;
  spriteId: string;
  filename: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
}

interface GameObjectLayer {
  frameId: string;
  spriteId: string;
  xOffset: number;
  yOffset: number;
  layerOrder: number;
}

export default function ObjectEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const editor = useObjectEditor();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Canvas settings (persisted to localStorage)
  const [canvasWidth, setCanvasWidth] = useState(256);
  const [canvasHeight, setCanvasHeight] = useState(256);
  const [gridSize, setGridSizeState] = useState(16);
  const [showGrid, setShowGridState] = useState(true);
  const [snapMode, setSnapModeState] = useState<SnapMode>('free');
  const [editorMode, setEditorMode] = useState<EditorMode>('layers');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('objectEditor:gridSettings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.gridSize) setGridSizeState(s.gridSize);
        if (s.showGrid !== undefined) setShowGridState(s.showGrid);
        if (s.snapMode) setSnapModeState(s.snapMode);
      }
    } catch { /* ignore */ }
  }, []);

  const setGridSize = useCallback((v: number) => {
    setGridSizeState(v);
    try { const s = JSON.parse(localStorage.getItem('objectEditor:gridSettings') || '{}'); localStorage.setItem('objectEditor:gridSettings', JSON.stringify({ ...s, gridSize: v })); } catch { /* ignore */ }
  }, []);
  const setShowGrid = useCallback((v: boolean) => {
    setShowGridState(v);
    try { const s = JSON.parse(localStorage.getItem('objectEditor:gridSettings') || '{}'); localStorage.setItem('objectEditor:gridSettings', JSON.stringify({ ...s, showGrid: v })); } catch { /* ignore */ }
  }, []);
  const setSnapMode = useCallback((v: SnapMode) => {
    setSnapModeState(v);
    try { const s = JSON.parse(localStorage.getItem('objectEditor:gridSettings') || '{}'); localStorage.setItem('objectEditor:gridSettings', JSON.stringify({ ...s, snapMode: v })); } catch { /* ignore */ }
  }, []);

  const { background, setBackground } = useCanvasBackground();

  // Category/Type suggestions
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [typeSuggestions, setTypeSuggestions] = useState<string[]>([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false);

  useEffect(() => {
    fetch('/api/objects/suggestions?field=category')
      .then((r) => r.json())
      .then(setCategorySuggestions)
      .catch(() => {
        // Suggestions are non-critical; silently ignore fetch failures
      });
    fetch('/api/objects/suggestions?field=objectType')
      .then((r) => r.json())
      .then(setTypeSuggestions)
      .catch(() => {
        // Suggestions are non-critical; silently ignore fetch failures
      });
  }, []);

  useKeyboardShortcuts({
    onSave: () => {
      if (editor.name.trim()) handleSave();
    },
    onEscape: () => {
      if (showDeleteConfirm) setShowDeleteConfirm(false);
    },
    onDelete: () => {
      if (editorMode === 'layers' && editor.selectedLayerIndex !== null) {
        editor.handleLayerDelete(editor.selectedLayerIndex);
      }
      if (editorMode === 'zones' && editor.selectedZoneIndex !== null) {
        editor.deleteCollisionZone(editor.selectedZoneIndex);
      }
    },
  });

  // Load existing object
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    fetch(`/api/objects/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Object not found');
        return r.json();
      })
      .then(async (obj) => {
        editor.setName(obj.name);
        editor.setDescription(obj.description ?? '');
        editor.setCategory(obj.category ?? '');
        editor.setObjectType(obj.objectType ?? '');
        editor.setTags(obj.tags ?? []);
        editor.setCollisionZones((obj.collisionZones ?? []) as CollisionZone[]);

        const dbLayers = (obj.layers ?? []) as GameObjectLayer[];
        if (dbLayers.length > 0) {
          const frameLayers = await loadLayersWithSpriteUrls(dbLayers);
          editor.setLayers(frameLayers);
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load object';
        setLoadError(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  async function loadLayersWithSpriteUrls(
    dbLayers: GameObjectLayer[]
  ): Promise<FrameLayer[]> {
    const uniqueSpriteIds = [...new Set(dbLayers.map((l) => l.spriteId))];
    const spriteMap = new Map<string, string>();
    await Promise.all(
      uniqueSpriteIds.map(async (spriteId) => {
        try {
          const res = await fetch(`/api/sprites/${spriteId}`);
          if (res.ok) {
            const sprite = await res.json();
            spriteMap.set(spriteId, sprite.s3Url);
          }
        } catch {
          // Sprite may have been deleted
        }
      })
    );

    const frameMap = new Map<string, AtlasFrame>();
    await Promise.all(
      uniqueSpriteIds.map(async (spriteId) => {
        try {
          const res = await fetch(`/api/sprites/${spriteId}/frames`);
          if (res.ok) {
            const frames: AtlasFrame[] = await res.json();
            for (const frame of frames) {
              frameMap.set(frame.id, frame);
            }
          }
        } catch {
          // Frames may not be available
        }
      })
    );

    return dbLayers.map((l) => {
      const spriteUrl = spriteMap.get(l.spriteId) ?? '';
      const frame = frameMap.get(l.frameId);
      return {
        frameId: l.frameId,
        spriteId: l.spriteId,
        spriteUrl,
        frameX: frame?.frameX ?? 0,
        frameY: frame?.frameY ?? 0,
        frameW: frame?.frameW ?? 0,
        frameH: frame?.frameH ?? 0,
        xOffset: l.xOffset,
        yOffset: l.yOffset,
        layerOrder: l.layerOrder,
      };
    });
  }

  const handleFit = useCallback(() => {
    if (editor.layers.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of editor.layers) {
      minX = Math.min(minX, l.xOffset);
      minY = Math.min(minY, l.yOffset);
      maxX = Math.max(maxX, l.xOffset + l.frameW);
      maxY = Math.max(maxY, l.yOffset + l.frameH);
    }
    const padding = gridSize;
    setCanvasWidth(Math.max(64, Math.min(2048, maxX - minX + padding * 2)));
    setCanvasHeight(Math.max(64, Math.min(2048, maxY - minY + padding * 2)));
  }, [editor.layers, gridSize]);

  async function handleSave() {
    if (!editor.name.trim()) {
      editor.setError('Name is required');
      return;
    }
    editor.setIsSaving(true);
    editor.setError(null);
    try {
      const res = await fetch(`/api/objects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor.getPayload()),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      editor.setError(null);
      toast.success('Object saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
      editor.setError(msg);
    } finally {
      editor.setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/objects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete object');
      toast.success('Object deleted');
      router.push('/objects');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error(msg);
      editor.setError(msg);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const filteredCategorySuggestions = categorySuggestions.filter(
    (s) => s.toLowerCase().includes(editor.category.toLowerCase()) && s !== editor.category
  );
  const filteredTypeSuggestions = typeSuggestions.filter(
    (s) => s.toLowerCase().includes(editor.objectType.toLowerCase()) && s !== editor.objectType
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-64 w-64 rounded-lg" />
          <Skeleton className="h-64 flex-1 rounded-lg" />
          <Skeleton className="h-64 w-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <Breadcrumb
          items={[{ label: 'Objects', href: '/objects' }, { label: 'Error' }]}
        />
        <p className="text-destructive mt-4">{loadError}</p>
        <Button variant="outline" className="mt-2" onClick={() => router.push('/objects')}>
          Back to Objects
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Objects', href: '/objects' },
          { label: editor.name || 'Edit Object' },
        ]}
      />
      <h1 className="text-2xl font-bold mb-4">Edit Object</h1>

      <CanvasBackgroundSelector
        value={background}
        onChange={setBackground}
        className="mb-2"
      />

      <CanvasToolbar
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        onCanvasWidthChange={setCanvasWidth}
        onCanvasHeightChange={setCanvasHeight}
        onFit={handleFit}
        hasLayers={editor.layers.length > 0}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        snapMode={snapMode}
        onSnapModeChange={setSnapMode}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
      />

      <div className="flex gap-4">
        {/* Left sidebar: frame picker */}
        <AtlasFramePicker
          activeFrame={editor.activeFrame}
          onFrameSelect={editor.setActiveFrame}
        />

        {/* Center: object canvas */}
        <div className="flex-1 flex flex-col items-start">
          <ObjectGridCanvas
            layers={editor.layers}
            activeFrame={
              editor.activeFrame
                ? {
                    frameId: editor.activeFrame.id,
                    spriteId: editor.activeFrame.spriteId,
                    spriteUrl: editor.activeFrame.spriteS3Url,
                    frameX: editor.activeFrame.frameX,
                    frameY: editor.activeFrame.frameY,
                    frameW: editor.activeFrame.frameW,
                    frameH: editor.activeFrame.frameH,
                  }
                : null
            }
            selectedLayerIndex={editor.selectedLayerIndex}
            onLayerAdd={editor.handleLayerAdd}
            onLayerUpdate={editor.handleLayerUpdate}
            onLayerSelect={editor.setSelectedLayerIndex}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            background={background}
            showGrid={showGrid}
            gridSize={gridSize}
            snapMode={snapMode}
            editorMode={editorMode}
            collisionZones={editor.collisionZones}
            selectedZoneIndex={editor.selectedZoneIndex}
            onZoneAdd={editor.addCollisionZone}
            onZoneUpdate={editor.updateCollisionZone}
            onZoneSelect={editor.setSelectedZoneIndex}
          />
        </div>

        {/* Right panel */}
        <div className="w-72 border rounded-lg p-3 flex flex-col gap-3 flex-shrink-0">
          {/* Preview */}
          <div>
            <h3 className="font-semibold text-sm mb-1" title="Live preview of the composed object">Preview</h3>
            <ObjectPreview
              layers={editor.layersToPreview()}
              className="border rounded p-1"
            />
          </div>

          {/* Metadata form */}
          <div className="space-y-2">
            <div>
              <Label htmlFor="obj-name" className="text-xs" title="Unique name for this game object">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="obj-name"
                value={editor.name}
                onChange={(e) => editor.setName(e.target.value)}
                placeholder="Object name"
                required
                className="h-7 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="obj-desc" className="text-xs" title="Optional description of the object">Description</Label>
              <Textarea
                id="obj-desc"
                value={editor.description}
                onChange={(e) => editor.setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="text-xs"
              />
            </div>

            {/* Category */}
            <div className="relative">
              <Label className="text-xs" title="Object category (e.g., building, decoration, nature, furniture)">Category</Label>
              <Input
                value={editor.category}
                onChange={(e) => editor.setCategory(e.target.value)}
                onFocus={() => setShowCategorySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 150)}
                placeholder="e.g., building, decoration..."
                className="h-7 text-xs"
              />
              {showCategorySuggestions && filteredCategorySuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border rounded shadow-md max-h-24 overflow-y-auto">
                  {filteredCategorySuggestions.map((s) => (
                    <button
                      key={s}
                      className="w-full text-left px-2 py-1 text-xs hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.setCategory(s);
                        setShowCategorySuggestions(false);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type */}
            <div className="relative">
              <Label className="text-xs" title="Object type (e.g., static, interactive, animated)">Type</Label>
              <Input
                value={editor.objectType}
                onChange={(e) => editor.setObjectType(e.target.value)}
                onFocus={() => setShowTypeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTypeSuggestions(false), 150)}
                placeholder="e.g., static, interactive..."
                className="h-7 text-xs"
              />
              {showTypeSuggestions && filteredTypeSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border rounded shadow-md max-h-24 overflow-y-auto">
                  {filteredTypeSuggestions.map((s) => (
                    <button
                      key={s}
                      className="w-full text-left px-2 py-1 text-xs hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.setObjectType(s);
                        setShowTypeSuggestions(false);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <Label className="text-xs" title="Tags for organizing and filtering objects">Tags</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  value={editor.newTag}
                  onChange={(e) => editor.setNewTag(e.target.value)}
                  onKeyDown={editor.handleTagKeyDown}
                  placeholder="Add tag..."
                  className="flex-1 h-7 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={editor.addTag}
                  title="Add tag"
                >
                  Add
                </Button>
              </div>
              {editor.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {editor.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                    >
                      {tag}
                      <button
                        onClick={() => editor.removeTag(tag)}
                        className="hover:text-destructive"
                        aria-label={`Remove tag ${tag}`}
                        title={`Remove tag "${tag}"`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Layer list or Collision Zones */}
          {editorMode === 'layers' ? (
            <div>
              <h3 className="font-semibold text-sm mb-1" title="Sprite layers composing this object">
                Layers ({editor.layers.length})
              </h3>
              {editor.layers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Select a frame from the picker, then click the canvas to add a layer.
                </p>
              )}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {editor.layers.map((layer, i) => (
                  <div
                    key={`${layer.frameId}-${i}`}
                    className={`flex items-center gap-1 text-xs p-1 rounded cursor-pointer ${
                      editor.selectedLayerIndex === i
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => editor.setSelectedLayerIndex(i)}
                  >
                    <span className="text-muted-foreground w-4">{i}</span>
                    <span className="truncate flex-1">
                      {layer.frameId.slice(0, 8)}...
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); editor.handleMoveLayerUp(i); }}
                      className="hover:text-primary px-0.5"
                      title="Move layer up (increase z-order)"
                      disabled={i === 0}
                    >
                      ^
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); editor.handleMoveLayerDown(i); }}
                      className="hover:text-primary px-0.5"
                      title="Move layer down (decrease z-order)"
                      disabled={i === editor.layers.length - 1}
                    >
                      v
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); editor.handleLayerDelete(i); }}
                      className="hover:text-destructive px-0.5"
                      title="Delete this layer"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <CollisionZonePanel
              zones={editor.collisionZones}
              selectedIndex={editor.selectedZoneIndex}
              onSelect={editor.setSelectedZoneIndex}
              onUpdate={editor.updateCollisionZone}
              onDelete={editor.deleteCollisionZone}
              onAdd={editor.addCollisionZone}
            />
          )}

          {/* Actions */}
          {editor.error && <p className="text-destructive text-xs">{editor.error}</p>}

          <div className="flex gap-2 mt-auto">
            <Button
              onClick={handleSave}
              disabled={!editor.name.trim() || editor.isSaving}
              className="flex-1 h-8 text-xs"
            >
              {editor.isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
          >
            Delete Object
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Game Object"
        description={
          <p>
            Are you sure you want to delete this game object? This action cannot
            be undone.
          </p>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
