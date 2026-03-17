'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Input } from '@/components/ui/input';

export interface FramePickerFrame {
  id: string;
  spriteId: string;
  spriteName: string;
  spriteS3Url: string;
  filename: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
}

interface AtlasFramePickerProps {
  activeFrame: FramePickerFrame | null;
  onFrameSelect: (frame: FramePickerFrame) => void;
}

interface SpriteData {
  id: string;
  name: string;
  s3Url: string;
  width: number;
  height: number;
}

interface AtlasFrameData {
  id: string;
  spriteId: string;
  filename: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
}

export function AtlasFramePicker({
  activeFrame,
  onFrameSelect,
}: AtlasFramePickerProps) {
  const [sprites, setSprites] = useState<SpriteData[]>([]);
  const [expandedSpriteIds, setExpandedSpriteIds] = useState<Set<string>>(
    new Set()
  );
  const [framesBySprite, setFramesBySprite] = useState<
    Record<string, AtlasFrameData[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingFrames, setLoadingFrames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/sprites')
      .then((r) => r.json())
      .then((data: SpriteData[]) => {
        setSprites(data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const loadFramesForSprite = useCallback(
    async (spriteId: string) => {
      if (framesBySprite[spriteId]) return;
      setLoadingFrames((prev) => new Set([...prev, spriteId]));
      try {
        const res = await fetch(`/api/sprites/${spriteId}/frames`);
        const frames: AtlasFrameData[] = await res.json();
        setFramesBySprite((prev) => ({ ...prev, [spriteId]: frames }));
      } catch (err) {
        console.error('Failed to fetch frames for sprite:', spriteId, err);
        setFramesBySprite((prev) => ({ ...prev, [spriteId]: [] }));
      } finally {
        setLoadingFrames((prev) => {
          const next = new Set(prev);
          next.delete(spriteId);
          return next;
        });
      }
    },
    [framesBySprite]
  );

  const handleSpriteToggle = useCallback(
    async (spriteId: string) => {
      if (expandedSpriteIds.has(spriteId)) {
        setExpandedSpriteIds((prev) => {
          const next = new Set(prev);
          next.delete(spriteId);
          return next;
        });
        return;
      }
      setExpandedSpriteIds((prev) => new Set([...prev, spriteId]));
      await loadFramesForSprite(spriteId);
    },
    [expandedSpriteIds, loadFramesForSprite]
  );

  // When searching, auto-expand and load frames for all sprites
  useEffect(() => {
    if (searchQuery.trim()) {
      sprites.forEach((sprite) => {
        loadFramesForSprite(sprite.id);
      });
      setExpandedSpriteIds(new Set(sprites.map((s) => s.id)));
    }
  }, [searchQuery, sprites, loadFramesForSprite]);

  const lowerSearch = searchQuery.toLowerCase().trim();

  return (
    <div className="border rounded-lg overflow-hidden w-64 flex-shrink-0">
      <div className="bg-muted p-2 font-medium text-sm">Atlas Frames</div>

      {/* Search input */}
      <div className="p-1.5 border-b">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search frames..."
          className="h-7 text-xs"
          title="Search frame filenames across all sprites"
        />
      </div>

      <div className="overflow-y-auto max-h-96">
        {isLoading && (
          <p className="p-2 text-sm text-muted-foreground">Loading...</p>
        )}
        {!isLoading && sprites.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">
            No sprites available
          </p>
        )}
        {sprites.map((sprite) => {
          const isExpanded = expandedSpriteIds.has(sprite.id);
          const allFrames = framesBySprite[sprite.id] ?? [];
          const isLoadingFramesForSprite = loadingFrames.has(sprite.id);

          // Filter frames by search
          const frames = lowerSearch
            ? allFrames.filter((f) =>
                f.filename.toLowerCase().includes(lowerSearch)
              )
            : allFrames;

          // If searching and no matching frames, hide this sprite
          if (lowerSearch && frames.length === 0 && !isLoadingFramesForSprite) {
            return null;
          }

          return (
            <div key={sprite.id}>
              <button
                onClick={() => handleSpriteToggle(sprite.id)}
                className="w-full text-left p-2 text-sm hover:bg-muted flex justify-between items-center"
              >
                <span className="flex items-center gap-1">
                  <span>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                  <span>{sprite.name}</span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {lowerSearch
                    ? `${frames.length}/${allFrames.length}`
                    : framesBySprite[sprite.id] !== undefined
                      ? frames.length
                      : ''}
                </span>
              </button>

              {isExpanded && (
                <div className="flex flex-wrap gap-1 p-2 bg-background">
                  {isLoadingFramesForSprite && (
                    <p className="text-xs text-muted-foreground">
                      Loading frames...
                    </p>
                  )}
                  {!isLoadingFramesForSprite && frames.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {lowerSearch ? 'No matches' : 'No frames'}
                    </p>
                  )}
                  {frames.map((frame) => {
                    const pickerFrame: FramePickerFrame = {
                      id: frame.id,
                      spriteId: sprite.id,
                      spriteName: sprite.name,
                      spriteS3Url: sprite.s3Url,
                      filename: frame.filename,
                      frameX: frame.frameX,
                      frameY: frame.frameY,
                      frameW: frame.frameW,
                      frameH: frame.frameH,
                    };
                    return (
                      <FrameThumbnail
                        key={frame.id}
                        frame={frame}
                        pickerFrame={pickerFrame}
                        spriteUrl={sprite.s3Url}
                        isActive={activeFrame?.id === frame.id}
                        onClick={() => onFrameSelect(pickerFrame)}
                        imageCache={imageCacheRef}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * FrameThumbnail renders a single atlas frame as a clickable, draggable thumbnail.
 *
 * Drag-and-drop: Each thumbnail is a draggable source via @dnd-kit/core's useDraggable.
 * The drag data carries the full FramePickerFrame object at `active.data.current.frame`.
 * A parent DndContext is required for drag-and-drop to function (provided by task-11/12).
 */
function FrameThumbnail({
  frame,
  pickerFrame,
  spriteUrl,
  isActive,
  onClick,
  imageCache,
}: {
  frame: AtlasFrameData;
  pickerFrame: FramePickerFrame;
  spriteUrl: string;
  isActive: boolean;
  onClick: () => void;
  imageCache: React.RefObject<Map<string, HTMLImageElement>>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `atlas-frame-${pickerFrame.spriteId}-${pickerFrame.id}`,
    data: { frame: pickerFrame },
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbSize = 40;

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const draw = useCallback(
    (img: HTMLImageElement) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, thumbSize, thumbSize);
      ctx.imageSmoothingEnabled = false;

      const scale = Math.min(
        thumbSize / frame.frameW,
        thumbSize / frame.frameH
      );
      const dw = frame.frameW * scale;
      const dh = frame.frameH * scale;

      ctx.drawImage(
        img,
        frame.frameX, frame.frameY, frame.frameW, frame.frameH,
        (thumbSize - dw) / 2, (thumbSize - dh) / 2, dw, dh
      );
    },
    [frame.frameX, frame.frameY, frame.frameW, frame.frameH]
  );

  useEffect(() => {
    const cached = imageCache.current?.get(spriteUrl);
    if (cached) {
      draw(cached);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.current?.set(spriteUrl, img);
        draw(img);
      };
      img.src = spriteUrl;
    }
  }, [spriteUrl, draw, imageCache]);

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      title={frame.filename}
      className={`cursor-pointer border-2 rounded ${
        isActive ? 'border-primary' : 'border-transparent'
      } hover:border-primary${isDragging ? ' opacity-50' : ''}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <canvas
        ref={canvasRef}
        width={thumbSize}
        height={thumbSize}
        style={{ imageRendering: 'pixelated' }}
      />
      <span className="text-[10px] truncate block max-w-10 leading-tight">{frame.filename}</span>
    </button>
  );
}
