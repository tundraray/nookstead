'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shape returned by GET /api/frames/by-filename.
 * Matches the atlas_frames DB columns we need for rendering.
 */
interface AtlasFrame {
  id: string;
  spriteId: string;
  filename: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
}

/* ------------------------------------------------------------------ */
/*  FrameThumbnail                                                     */
/* ------------------------------------------------------------------ */

interface FrameThumbnailProps {
  frame: AtlasFrame;
  spriteImage: HTMLImageElement | null;
  onClick: () => void;
}

/**
 * A 32x32 canvas thumbnail showing a single frame from the atlas image.
 * Memoized so it only re-renders when frame data or the sprite image changes.
 */
const FrameThumbnail = memo(function FrameThumbnail({
  frame,
  spriteImage,
  onClick,
}: FrameThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const THUMB_SIZE = 32;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    ctx.imageSmoothingEnabled = false;

    if (spriteImage) {
      const scale = Math.min(
        THUMB_SIZE / frame.frameW,
        THUMB_SIZE / frame.frameH
      );
      const dw = frame.frameW * scale;
      const dh = frame.frameH * scale;

      ctx.drawImage(
        spriteImage,
        frame.frameX,
        frame.frameY,
        frame.frameW,
        frame.frameH,
        (THUMB_SIZE - dw) / 2,
        (THUMB_SIZE - dh) / 2,
        dw,
        dh
      );
    } else {
      // Placeholder rectangle when no image is available
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    }
  }, [spriteImage, frame.frameX, frame.frameY, frame.frameW, frame.frameH]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={frame.filename}
      className="cursor-pointer border border-transparent rounded hover:border-primary transition-colors"
    >
      <canvas
        ref={canvasRef}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        style={{ imageRendering: 'pixelated' }}
      />
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  AtlasRow                                                           */
/* ------------------------------------------------------------------ */

interface AtlasRowProps {
  filename: string;
  isExpanded: boolean;
  frames: AtlasFrame[] | null;
  spriteImage: HTMLImageElement | null;
  isLoadingFrames: boolean;
  onToggle: () => void;
  onFrameClick: (frame: AtlasFrame) => void;
}

/**
 * A collapsible row representing a single atlas filename.
 * Collapsed: shows chevron + filename + frame count.
 * Expanded: shows the same header followed by a 4-column grid of thumbnails.
 */
const AtlasRow = memo(function AtlasRow({
  filename,
  isExpanded,
  frames,
  spriteImage,
  isLoadingFrames,
  onToggle,
  onFrameClick,
}: AtlasRowProps) {
  const frameCount = frames ? frames.length : null;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex items-center gap-1 w-full px-2 py-1 text-left text-xs hover:bg-accent rounded transition-colors"
      >
        <span className="text-muted-foreground flex-shrink-0">
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
        <span className="flex-1 truncate font-medium">{filename}</span>
        {frameCount !== null && (
          <span className="text-muted-foreground text-[10px] flex-shrink-0">
            {frameCount}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-2 pb-2">
          {isLoadingFrames && (
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-8 h-8 rounded" />
              ))}
            </div>
          )}
          {!isLoadingFrames && frames && frames.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-1">
              No frames
            </p>
          )}
          {!isLoadingFrames && frames && frames.length > 0 && (
            <div
              className="grid grid-cols-4 gap-1"
              style={{ gap: '4px' }}
            >
              {frames.map((frame) => (
                <FrameThumbnail
                  key={frame.id}
                  frame={frame}
                  spriteImage={spriteImage}
                  onClick={() => onFrameClick(frame)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  SkeletonList                                                       */
/* ------------------------------------------------------------------ */

function SkeletonList() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full rounded" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FramesPanel                                                        */
/* ------------------------------------------------------------------ */

/**
 * Self-contained atlas frame browser panel for the Frames sidebar tab.
 *
 * On mount, loads all distinct atlas filenames. Users can type to search
 * (debounced 300ms), expand filenames to see 32x32 frame thumbnail grids,
 * and click a thumbnail to copy its frame ID to clipboard.
 */
export function FramesPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filenames, setFilenames] = useState<string[]>([]);
  const [expandedAtlases, setExpandedAtlases] = useState<Set<string>>(
    new Set()
  );
  const [frameCache, setFrameCache] = useState<Map<string, AtlasFrame[]>>(
    new Map()
  );
  const spriteImageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [spriteImageReady, setSpriteImageReady] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadingAtlases, setLoadingAtlases] = useState<Set<string>>(
    new Set()
  );

  // Load all filenames on mount
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/frames/search')
      .then((r) => r.json())
      .then((data: string[]) => {
        setFilenames(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery === '') {
      // Reload all filenames when query is cleared
      fetch('/api/frames/search')
        .then((r) => r.json())
        .then((data: string[]) => setFilenames(data))
        .catch(() => {
          /* keep current filenames on error */
        });
      return;
    }

    const timer = setTimeout(() => {
      fetch(
        `/api/frames/search?q=${encodeURIComponent(searchQuery)}`
      )
        .then((r) => r.json())
        .then((data: string[]) => setFilenames(data))
        .catch(() => {
          /* keep current filenames on error */
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Load the sprite image for a given spriteId.
   * First fetches sprite metadata to get the signed URL, then loads the image.
   */
  const loadSpriteImage = useCallback(
    async (spriteId: string) => {
      if (spriteImageCacheRef.current.has(spriteId)) return;

      try {
        const spriteRes = await fetch(`/api/sprites/${spriteId}`);
        if (!spriteRes.ok) return;
        const spriteData: { s3Url: string } = await spriteRes.json();

        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = spriteData.s3Url;
        });

        spriteImageCacheRef.current.set(spriteId, img);
        setSpriteImageReady((prev) => new Set([...prev, spriteId]));
      } catch {
        // Image loading failed; thumbnails will show placeholder
      }
    },
    []
  );

  const handleToggleAtlas = useCallback(
    async (filename: string) => {
      if (expandedAtlases.has(filename)) {
        setExpandedAtlases((prev) => {
          const next = new Set(prev);
          next.delete(filename);
          return next;
        });
        return;
      }

      // Expand immediately
      setExpandedAtlases((prev) => new Set([...prev, filename]));

      // Fetch frames if not cached
      if (!frameCache.has(filename)) {
        setLoadingAtlases((prev) => new Set([...prev, filename]));
        try {
          const res = await fetch(
            `/api/frames/by-filename?filename=${encodeURIComponent(filename)}`
          );
          const frames: AtlasFrame[] = await res.json();
          setFrameCache((prev) => new Map([...prev, [filename, frames]]));

          // Load the sprite image for these frames (all frames in a filename share the same spriteId)
          if (frames.length > 0) {
            await loadSpriteImage(frames[0].spriteId);
          }
        } catch {
          // On error, cache empty array to avoid retrying
          setFrameCache((prev) => new Map([...prev, [filename, []]]));
        } finally {
          setLoadingAtlases((prev) => {
            const next = new Set(prev);
            next.delete(filename);
            return next;
          });
        }
      }
    },
    [expandedAtlases, frameCache, loadSpriteImage]
  );

  const handleFrameClick = useCallback(async (frame: AtlasFrame) => {
    try {
      await navigator.clipboard.writeText(frame.id);
      toast.success(`Frame ID copied: ${frame.id}`);
    } catch {
      toast.error('Failed to copy frame ID to clipboard');
    }
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSearchQuery('');
      }
    },
    []
  );

  /**
   * Resolve the cached sprite image for a given filename.
   * All frames under a filename share the same spriteId, so
   * we look up the first frame's spriteId in the image cache.
   *
   * `spriteImageReady` is included in deps to trigger re-render
   * when an image finishes loading asynchronously.
   */
  const getSpriteImageForFilename = useCallback(
    (filename: string): HTMLImageElement | null => {
      const frames = frameCache.get(filename);
      if (!frames || frames.length === 0) return null;
      return spriteImageCacheRef.current.get(frames[0].spriteId) ?? null;
    },
    // spriteImageReady is intentionally included to bust the memoization
    // when sprite images finish loading asynchronously.
    [frameCache, spriteImageReady]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="pb-2">
        <Input
          aria-label="Search atlas frames"
          placeholder="Search frames..."
          className="h-7 text-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>
      <div className="flex-1 overflow-y-auto -mx-2">
        {isLoading && <SkeletonList />}
        {!isLoading && filenames.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">No frames found</p>
        )}
        {!isLoading &&
          filenames.map((filename) => (
            <AtlasRow
              key={filename}
              filename={filename}
              isExpanded={expandedAtlases.has(filename)}
              frames={frameCache.get(filename) ?? null}
              spriteImage={getSpriteImageForFilename(filename)}
              isLoadingFrames={loadingAtlases.has(filename)}
              onToggle={() => handleToggleAtlas(filename)}
              onFrameClick={handleFrameClick}
            />
          ))}
      </div>
    </div>
  );
}
