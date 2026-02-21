'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AtlasZoneCanvas, type Zone } from '@/components/atlas-zone-canvas';
import {
  AtlasZoneModal,
  type AtlasFrameData,
} from '@/components/atlas-zone-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CanvasBackgroundSelector } from '@/components/canvas-background-selector';
import { useCanvasBackground } from '@/hooks/use-canvas-background';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Breadcrumb } from '@/components/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface Sprite {
  id: string;
  name: string;
  s3Url: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface References {
  frameCount: number;
  affectedObjects: { id: string; name: string }[];
}

interface ApiFrame {
  id: string;
  spriteId: string;
  filename: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSizeX: number;
  spriteSourceSizeY: number;
  spriteSourceSizeW: number | null;
  spriteSourceSizeH: number | null;
  sourceSizeW: number | null;
  sourceSizeH: number | null;
  pivotX: number;
  pivotY: number;
  customData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

function mapApiFrameToLocal(frame: ApiFrame): AtlasFrameData {
  return {
    filename: frame.filename,
    frameX: frame.frameX,
    frameY: frame.frameY,
    frameW: frame.frameW,
    frameH: frame.frameH,
    rotated: frame.rotated,
    trimmed: frame.trimmed,
    spriteSourceSizeX: frame.spriteSourceSizeX,
    spriteSourceSizeY: frame.spriteSourceSizeY,
    spriteSourceSizeW: frame.spriteSourceSizeW ?? frame.frameW,
    spriteSourceSizeH: frame.spriteSourceSizeH ?? frame.frameH,
    sourceSizeW: frame.sourceSizeW ?? frame.frameW,
    sourceSizeH: frame.sourceSizeH ?? frame.frameH,
    pivotX: frame.pivotX,
    pivotY: frame.pivotY,
    customData: frame.customData,
  };
}

function generateFrameFilename(existingFrames: AtlasFrameData[]): string {
  let index = existingFrames.length + 1;
  const existingNames = new Set(existingFrames.map((f) => f.filename));
  let name = `frame_${String(index).padStart(3, '0')}`;
  while (existingNames.has(name)) {
    index++;
    name = `frame_${String(index).padStart(3, '0')}`;
  }
  return name;
}

export default function SpriteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sprite, setSprite] = useState<Sprite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tile grid snapping
  const [tileWidth, setTileWidth] = useState<number>(16);
  const [tileHeight, setTileHeight] = useState<number>(16);

  // Zoom state (controlled by this page, passed to canvas)
  const [zoom, setZoom] = useState<number>(1);

  // Atlas frame editor state
  const [frames, setFrames] = useState<AtlasFrameData[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(
    null
  );
  const [modalPosition, setModalPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isFramesLoaded, setIsFramesLoaded] = useState(false);

  // Track last pointer position for modal placement
  const lastPointerPosition = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const { background, setBackground } = useCanvasBackground();

  // Delete sprite state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingRefs, setIsCheckingRefs] = useState(false);
  const [references, setReferences] = useState<References | null>(null);

  useKeyboardShortcuts({
    onSave: () => {
      if (isDirty && frames.length > 0) {
        handleSaveFrames();
      }
    },
    onEscape: () => {
      if (selectedFrameIndex !== null) {
        setSelectedFrameIndex(null);
      } else if (deleteOpen) {
        setDeleteOpen(false);
      }
    },
  });

  // Load sprite data
  useEffect(() => {
    fetch(`/api/sprites/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Sprite not found');
        return res.json();
      })
      .then((data: Sprite) => {
        setSprite(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  // Load existing frames on mount (after sprite is loaded)
  useEffect(() => {
    if (!sprite) return;

    fetch(`/api/sprites/${id}/frames`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load frames');
        return res.json();
      })
      .then((data: ApiFrame[]) => {
        setFrames(data.map(mapApiFrameToLocal));
        setIsFramesLoaded(true);
      })
      .catch(() => {
        toast.error('Failed to load existing frames');
        setIsFramesLoaded(true);
      });
  }, [id, sprite]);

  // Track pointer position on the page for modal placement
  const handlePagePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      lastPointerPosition.current = { x: e.clientX, y: e.clientY };
    },
    []
  );

  // Convert frames to Zone[] for AtlasZoneCanvas
  const zones: Zone[] = frames.map((f) => ({
    x: f.frameX,
    y: f.frameY,
    w: f.frameW,
    h: f.frameH,
    filename: f.filename,
  }));

  // Handle new zone creation from canvas
  const handleZoneCreate = useCallback(
    (rect: { x: number; y: number; w: number; h: number }) => {
      const newFrame: AtlasFrameData = {
        filename: generateFrameFilename(frames),
        frameX: rect.x,
        frameY: rect.y,
        frameW: rect.w,
        frameH: rect.h,
        rotated: false,
        trimmed: false,
        spriteSourceSizeX: 0,
        spriteSourceSizeY: 0,
        spriteSourceSizeW: rect.w,
        spriteSourceSizeH: rect.h,
        sourceSizeW: rect.w,
        sourceSizeH: rect.h,
        pivotX: 0.5,
        pivotY: 0.5,
        customData: null,
      };
      setFrames((prev) => [...prev, newFrame]);
      setIsDirty(true);
      // Auto-open modal for the new frame
      setSelectedFrameIndex(frames.length);
      setModalPosition({
        x: lastPointerPosition.current.x + 10,
        y: lastPointerPosition.current.y + 10,
      });
    },
    [frames]
  );

  // Handle zone click from canvas
  const handleZoneClick = useCallback((index: number) => {
    setSelectedFrameIndex(index);
    setModalPosition({
      x: lastPointerPosition.current.x + 10,
      y: lastPointerPosition.current.y + 10,
    });
  }, []);

  // Handle frame update from modal
  const handleFrameUpdate = useCallback(
    (updatedFrame: AtlasFrameData) => {
      if (selectedFrameIndex === null) return;
      setFrames((prev) => {
        const newFrames = [...prev];
        newFrames[selectedFrameIndex] = updatedFrame;
        return newFrames;
      });
      setIsDirty(true);
    },
    [selectedFrameIndex]
  );

  // Handle frame delete from modal
  const handleFrameDelete = useCallback(() => {
    if (selectedFrameIndex === null) return;
    setFrames((prev) => prev.filter((_, i) => i !== selectedFrameIndex));
    setSelectedFrameIndex(null);
    setIsDirty(true);
  }, [selectedFrameIndex]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setSelectedFrameIndex(null);
  }, []);

  // Batch save all frames
  async function handleSaveFrames() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/sprites/${id}/frames`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames }),
      });
      if (!res.ok) {
        const data = await res.json();
        const errMsg = data.error ?? 'Failed to save frames';
        setSaveError(errMsg);
        toast.error(errMsg);
      } else {
        const saved: ApiFrame[] = await res.json();
        setFrames(saved.map(mapApiFrameToLocal));
        setIsDirty(false);
        toast.success(`Saved ${saved.length} frame${saved.length !== 1 ? 's' : ''}`);
      }
    } catch {
      const errMsg = 'Network error while saving frames';
      setSaveError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSaving(false);
    }
  }

  // Delete sprite handlers
  async function handleDeleteClick() {
    setIsCheckingRefs(true);
    try {
      const res = await fetch(`/api/sprites/${id}/references`);
      const refs: References = await res.json();
      setReferences(refs);
      setDeleteOpen(true);
    } catch {
      setError('Failed to check references');
    } finally {
      setIsCheckingRefs(false);
    }
  }

  async function handleDeleteConfirm() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sprites/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete sprite');
      router.push('/sprites');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="aspect-video w-full max-w-lg rounded-lg" />
      </div>
    );
  }
  if (error && !sprite) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{error}</p>
      </div>
    );
  }
  if (!sprite) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Sprite not found</p>
      </div>
    );
  }

  return (
    <div onPointerMove={handlePagePointerMove}>
      <Breadcrumb
        items={[
          { label: 'Sprites', href: '/sprites' },
          { label: sprite.name },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{sprite.name}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteClick}
            disabled={isCheckingRefs}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isCheckingRefs ? 'Checking...' : 'Delete Sprite'}
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground mb-4">
        {sprite.width} x {sprite.height} px &mdash; {sprite.mimeType}
      </p>

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <CanvasBackgroundSelector value={background} onChange={setBackground} />
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Tile:</label>
          <input
            type="number"
            value={tileWidth}
            onChange={(e) => setTileWidth(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 h-8 px-2 text-sm border rounded bg-background"
            min={1}
          />
          <span className="text-sm text-muted-foreground">x</span>
          <input
            type="number"
            value={tileHeight}
            onChange={(e) => setTileHeight(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 h-8 px-2 text-sm border rounded bg-background"
            min={1}
          />
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}
            disabled={zoom <= 0.5}
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </Button>
          <span className="text-sm font-mono text-muted-foreground w-12 text-center">
            {zoom.toFixed(1)}x
          </span>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => setZoom((z) => Math.min(20, z + 0.5))}
            disabled={zoom >= 20}
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </Button>
          {zoom !== 1 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setZoom(1)}
              aria-label="Reset zoom"
              title="Reset zoom to 1x"
            >
              <RotateCcw size={14} />
            </Button>
          )}
        </div>

        <span className="text-sm text-muted-foreground">
          {frames.length} frame{frames.length !== 1 ? 's' : ''}
        </span>
        {isDirty && (
          <span className="text-sm text-amber-600 font-medium">
            Unsaved changes
          </span>
        )}
        {saveError && (
          <span className="text-sm text-destructive">{saveError}</span>
        )}
        <Button
          onClick={handleSaveFrames}
          disabled={isSaving || !isDirty}
          size="sm"
        >
          {isSaving ? 'Saving...' : 'Save All Frames'}
        </Button>
      </div>

      {/* Atlas Zone Canvas */}
      {isFramesLoaded && (
        <AtlasZoneCanvas
          imageUrl={sprite.s3Url}
          zones={zones}
          selectedZoneIndex={selectedFrameIndex ?? undefined}
          onZoneCreate={handleZoneCreate}
          onZoneClick={handleZoneClick}
          background={background}
          tileWidth={tileWidth}
          tileHeight={tileHeight}
          zoom={zoom}
          onZoomChange={setZoom}
        />
      )}

      {/* Atlas Zone Modal */}
      {selectedFrameIndex !== null && frames[selectedFrameIndex] && (
        <AtlasZoneModal
          frame={frames[selectedFrameIndex]}
          onUpdate={handleFrameUpdate}
          onDelete={handleFrameDelete}
          onClose={handleModalClose}
          position={modalPosition}
          localFilenames={frames.map((f) => f.filename)}
        />
      )}

      {/* Delete Sprite Confirm Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Sprite"
        confirmLabel="Delete"
        confirmVariant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteOpen(false)}
        description={
          <div>
            <p>Are you sure you want to delete &quot;{sprite.name}&quot;?</p>
            {references &&
              (references.frameCount > 0 ||
                references.affectedObjects.length > 0) && (
                <div className="mt-2 text-sm text-destructive">
                  {references.frameCount > 0 && (
                    <p>
                      This will cascade-delete{' '}
                      <strong>{references.frameCount}</strong> frame
                      {references.frameCount !== 1 ? 's' : ''}.
                    </p>
                  )}
                  {references.affectedObjects.length > 0 && (
                    <div>
                      <p>
                        The following game objects reference this sprite:
                      </p>
                      <ul className="list-disc list-inside mt-1">
                        {references.affectedObjects.map((obj) => (
                          <li key={obj.id}>{obj.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
          </div>
        }
      />
    </div>
  );
}
