'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import type { Tileset, Material } from '@nookstead/db';

interface TilesetCardProps {
  tileset: Tileset & {
    tags: string[];
    usageCount?: number;
    fromMaterial?: Material | null;
    toMaterial?: Material | null;
  };
}

const FRAME_SIZE = 16;
const CANVAS_WIDTH = 96;
const CANVAS_HEIGHT = 64;

export function TilesetCard({ tileset }: TilesetCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tileset.s3Url) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.imageSmoothingEnabled = false;

      // Draw up to 6x4 frames (first 6 columns, first 4 rows)
      const cols = Math.min(Math.floor(img.width / FRAME_SIZE), 6);
      const rows = Math.min(Math.floor(img.height / FRAME_SIZE), 4);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          ctx.drawImage(
            img,
            col * FRAME_SIZE,
            row * FRAME_SIZE,
            FRAME_SIZE,
            FRAME_SIZE,
            col * FRAME_SIZE,
            row * FRAME_SIZE,
            FRAME_SIZE,
            FRAME_SIZE
          );
        }
      }
    };
    img.onerror = () => {
      // Show a fallback if image fails
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No preview', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 3);
    };
    img.src = tileset.s3Url;
  }, [tileset.s3Url]);

  const visibleTags = tileset.tags.slice(0, 3);
  const extraTagCount = tileset.tags.length - 3;

  return (
    <Link href={`/tilesets/${tileset.id}`}>
      <Card className="p-0 gap-0 overflow-hidden hover:shadow-md hover:border-primary transition-all cursor-pointer">
        <CardHeader className="p-0">
          <div className="flex items-center justify-center bg-muted h-20">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="pixelated"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-3 space-y-1.5">
          {/* Name */}
          <p className="text-sm font-medium line-clamp-2 leading-tight">
            {tileset.name}
          </p>

          {/* Material pair */}
          <div className="flex items-center gap-1.5">
            {tileset.fromMaterial ? (
              <span
                className="inline-block size-4 rounded-full border"
                style={{ backgroundColor: tileset.fromMaterial.color }}
                title={tileset.fromMaterial.name}
              />
            ) : (
              <span className="text-xs text-muted-foreground">--</span>
            )}
            <ArrowRight className="size-3 text-muted-foreground" />
            {tileset.toMaterial ? (
              <span
                className="inline-block size-4 rounded-full border"
                style={{ backgroundColor: tileset.toMaterial.color }}
                title={tileset.toMaterial.name}
              />
            ) : (
              <span className="text-xs text-muted-foreground">--</span>
            )}
          </div>

          {/* Tags */}
          {tileset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {visibleTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  {tag}
                </Badge>
              ))}
              {extraTagCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  +{extraTagCount} more
                </span>
              )}
            </div>
          )}

          {/* Usage count */}
          {tileset.usageCount !== undefined && (
            <p className="text-xs text-muted-foreground">
              {tileset.usageCount} map{tileset.usageCount !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
