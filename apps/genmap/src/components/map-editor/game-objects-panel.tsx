'use client';

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  memo,
} from 'react';
import type { CollisionZone } from '@nookstead/db';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GameObjectLayer {
  frameId: string;
  spriteId: string;
  xOffset: number;
  yOffset: number;
  layerOrder: number;
}

interface GameObject {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  objectType: string | null;
  layers: GameObjectLayer[];
  collisionZones: CollisionZone[];
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface AtlasFrame {
  id: string;
  spriteId: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
}

interface SpriteInfo {
  id: string;
  s3Url: string;
}

export interface GameObjectsPanelProps {
  onObjectSelect: (objectId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Thumbnail canvas component                                         */
/* ------------------------------------------------------------------ */

const THUMB_SIZE = 48;

interface ObjectThumbnailProps {
  object: GameObject;
  isSelected: boolean;
  spriteImages: Map<string, HTMLImageElement>;
  frameData: Map<string, AtlasFrame>;
  onClick: () => void;
}

/**
 * Renders a 48x48 canvas thumbnail for a game object using the first
 * layer's first frame. Shows a placeholder when sprite data is unavailable.
 */
const ObjectThumbnail = memo(function ObjectThumbnail({
  object,
  isSelected,
  spriteImages,
  frameData,
  onClick,
}: ObjectThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    ctx.imageSmoothingEnabled = false;

    if (object.layers.length === 0) {
      drawPlaceholder(ctx);
      return;
    }

    // Sort layers by layerOrder and draw each one
    const sorted = [...object.layers].sort(
      (a, b) => a.layerOrder - b.layerOrder
    );

    // Compute bounding box of all layers to scale into 48x48
    let maxRight = 0;
    let maxBottom = 0;
    let hasAnyFrame = false;

    for (const layer of sorted) {
      const frame = frameData.get(layer.frameId);
      if (frame) {
        hasAnyFrame = true;
        const right = layer.xOffset + frame.frameW;
        const bottom = layer.yOffset + frame.frameH;
        if (right > maxRight) maxRight = right;
        if (bottom > maxBottom) maxBottom = bottom;
      }
    }

    if (!hasAnyFrame) {
      drawPlaceholder(ctx);
      return;
    }

    // Calculate scale to fit object in 48x48
    const scale = Math.min(THUMB_SIZE / maxRight, THUMB_SIZE / maxBottom, 1);
    const offsetX = (THUMB_SIZE - maxRight * scale) / 2;
    const offsetY = (THUMB_SIZE - maxBottom * scale) / 2;

    for (const layer of sorted) {
      const frame = frameData.get(layer.frameId);
      const img = spriteImages.get(layer.spriteId);

      if (frame && img && img.naturalWidth > 0) {
        ctx.drawImage(
          img,
          frame.frameX,
          frame.frameY,
          frame.frameW,
          frame.frameH,
          offsetX + layer.xOffset * scale,
          offsetY + layer.yOffset * scale,
          frame.frameW * scale,
          frame.frameH * scale
        );
      }
    }
  }, [object, spriteImages, frameData]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className="flex flex-col items-center gap-0.5 p-1 rounded cursor-pointer transition-colors hover:bg-accent"
      title={object.name}
    >
      <canvas
        ref={canvasRef}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        className="rounded flex-shrink-0"
        style={{
          imageRendering: 'pixelated',
          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
        }}
      />
      <span className="text-[10px] text-center truncate w-[52px] leading-tight">
        {object.name}
      </span>
    </button>
  );
});

function drawPlaceholder(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
  ctx.fillStyle = '#718096';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('No', THUMB_SIZE / 2, THUMB_SIZE / 2 - 2);
  ctx.fillText('data', THUMB_SIZE / 2, THUMB_SIZE / 2 + 10);
  ctx.textAlign = 'start';
}

/* ------------------------------------------------------------------ */
/*  Category group component                                           */
/* ------------------------------------------------------------------ */

interface CategoryGroupProps {
  category: string;
  objects: GameObject[];
  isExpanded: boolean;
  selectedObjectId: string | null;
  spriteImages: Map<string, HTMLImageElement>;
  frameData: Map<string, AtlasFrame>;
  onToggle: () => void;
  onObjectClick: (objectId: string) => void;
}

function CategoryGroup({
  category,
  objects,
  isExpanded,
  selectedObjectId,
  spriteImages,
  frameData,
  onToggle,
  onObjectClick,
}: CategoryGroupProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold hover:bg-accent rounded transition-colors"
      >
        <span>
          {category} ({objects.length})
        </span>
        <span className="text-muted-foreground">
          {isExpanded ? '\u25B4' : '\u25BE'}
        </span>
      </button>
      {isExpanded && (
        <div className="flex flex-wrap gap-1 px-1 py-1">
          {objects.map((obj) => (
            <ObjectThumbnail
              key={obj.id}
              object={obj}
              isSelected={selectedObjectId === obj.id}
              spriteImages={spriteImages}
              frameData={frameData}
              onClick={() => onObjectClick(obj.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Selected object detail panel                                       */
/* ------------------------------------------------------------------ */

interface SelectedObjectDetailProps {
  object: GameObject;
}

function SelectedObjectDetail({ object }: SelectedObjectDetailProps) {
  // Compute approximate dimensions from layers
  let maxRight = 0;
  let maxBottom = 0;

  for (const layer of object.layers) {
    // We use xOffset/yOffset as rough dimension indicators
    const right = layer.xOffset + 16; // default frame size fallback
    const bottom = layer.yOffset + 16;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const collisionCount = object.collisionZones?.length ?? 0;
  const collisionTypes = object.collisionZones
    ? [...new Set(object.collisionZones.map((z) => z.type))]
    : [];

  return (
    <div className="flex-shrink-0 border-t p-2 space-y-1" style={{ minHeight: 80 }}>
      <div className="text-xs font-semibold truncate">{object.name}</div>
      {object.description && (
        <div className="text-[10px] text-muted-foreground truncate">
          {object.description}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">
        {object.layers.length} layer{object.layers.length !== 1 ? 's' : ''}
        {object.objectType && ` \u00B7 ${object.objectType}`}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {collisionCount > 0
          ? `${collisionCount} collision zone${collisionCount !== 1 ? 's' : ''} (${collisionTypes.join(', ')})`
          : 'No collision zones'}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton loading component                                         */
/* ------------------------------------------------------------------ */

function SkeletonList() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-5 w-24" />
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 4 }, (_, j) => (
              <Skeleton key={j} className="h-14 w-14" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

/**
 * Game objects browser panel for the map editor sidebar.
 *
 * Loads all game objects from `GET /api/objects`, groups them by category,
 * provides client-side search filtering, and renders 48x48 canvas thumbnails.
 * When an object is clicked, `onObjectSelect(objectId)` is called so the
 * parent can activate placement mode.
 */
export function GameObjectsPanel({ onObjectSelect }: GameObjectsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sprite image cache and frame data for thumbnail rendering
  const [spriteImages, setSpriteImages] = useState<Map<string, HTMLImageElement>>(
    () => new Map()
  );
  const [frameData, setFrameData] = useState<Map<string, AtlasFrame>>(
    () => new Map()
  );

  // Fetch all game objects on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchObjects() {
      try {
        const res = await fetch('/api/objects');
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const data: GameObject[] = await res.json();
        if (cancelled) return;

        setObjects(data);

        // Expand all categories by default
        const categories = new Set(
          data.map((obj) => obj.category ?? 'Uncategorized')
        );
        setExpandedCategories(categories);

        // Load sprite and frame data for thumbnails
        await loadSpriteData(data, cancelled);
      } catch {
        // Failed to fetch -- leave empty state
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function loadSpriteData(data: GameObject[], isCancelled: boolean) {
      // Collect unique sprite IDs from all object layers
      const uniqueSpriteIds = new Set<string>();
      const uniqueFrameIds = new Set<string>();
      for (const obj of data) {
        for (const layer of obj.layers) {
          uniqueSpriteIds.add(layer.spriteId);
          uniqueFrameIds.add(layer.frameId);
        }
      }

      if (uniqueSpriteIds.size === 0) return;

      // Fetch sprite URLs
      const spriteMap = new Map<string, string>();
      await Promise.all(
        Array.from(uniqueSpriteIds).map(async (spriteId) => {
          try {
            const res = await fetch(`/api/sprites/${spriteId}`);
            if (res.ok) {
              const sprite: SpriteInfo = await res.json();
              spriteMap.set(spriteId, sprite.s3Url);
            }
          } catch {
            // Sprite may have been deleted
          }
        })
      );

      if (isCancelled) return;

      // Fetch frame data for each sprite
      const frames = new Map<string, AtlasFrame>();
      await Promise.all(
        Array.from(uniqueSpriteIds).map(async (spriteId) => {
          try {
            const res = await fetch(`/api/sprites/${spriteId}/frames`);
            if (res.ok) {
              const spriteFrames: AtlasFrame[] = await res.json();
              for (const frame of spriteFrames) {
                if (uniqueFrameIds.has(frame.id)) {
                  frames.set(frame.id, frame);
                }
              }
            }
          } catch {
            // Frames may not be available
          }
        })
      );

      if (isCancelled) return;

      setFrameData(frames);

      // Load sprite images
      const images = new Map<string, HTMLImageElement>();
      await Promise.all(
        Array.from(spriteMap.entries()).map(
          ([spriteId, url]) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                images.set(spriteId, img);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = url;
            })
        )
      );

      if (isCancelled) return;

      setSpriteImages(images);
    }

    fetchObjects();

    return () => {
      cancelled = true;
    };
  }, []);

  // Client-side filter across name, category, and tags
  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) return objects;
    const q = searchQuery.toLowerCase();
    return objects.filter(
      (obj) =>
        obj.name.toLowerCase().includes(q) ||
        (obj.category ?? '').toLowerCase().includes(q) ||
        (obj.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
    );
  }, [objects, searchQuery]);

  // Group by category, sorted alphabetically
  const groups = useMemo(() => {
    const map = new Map<string, GameObject[]>();
    for (const obj of filteredObjects) {
      const cat = obj.category ?? 'Uncategorized';
      const arr = map.get(cat) ?? [];
      arr.push(obj);
      map.set(cat, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredObjects]);

  const handleToggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const s = new Set(prev);
      if (s.has(cat)) {
        s.delete(cat);
      } else {
        s.add(cat);
      }
      return s;
    });
  }, []);

  const handleObjectClick = useCallback(
    (objectId: string) => {
      setSelectedObjectId(objectId);
      onObjectSelect(objectId);
    },
    [onObjectSelect]
  );

  const selectedObject = selectedObjectId
    ? objects.find((o) => o.id === selectedObjectId) ?? null
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-2 flex-shrink-0">
        <Input
          aria-label="Search game objects"
          placeholder="Search objects..."
          className="h-7 text-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Object list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && <SkeletonList />}
        {!isLoading && groups.length === 0 && (
          <div className="text-xs text-muted-foreground p-2 text-center">
            {searchQuery.trim()
              ? 'No objects match your search.'
              : 'No game objects found.'}
          </div>
        )}
        {!isLoading &&
          groups.map(([category, objs]) => (
            <CategoryGroup
              key={category}
              category={category}
              objects={objs}
              isExpanded={expandedCategories.has(category)}
              selectedObjectId={selectedObjectId}
              spriteImages={spriteImages}
              frameData={frameData}
              onToggle={() => handleToggleCategory(category)}
              onObjectClick={handleObjectClick}
            />
          ))}
      </div>

      {/* Selected object detail */}
      {selectedObject && <SelectedObjectDetail object={selectedObject} />}
    </div>
  );
}
