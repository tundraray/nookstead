'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const TILE_SIZE = 16;
const COLS = 12;
const ROWS = 4;
const IMG_WIDTH = COLS * TILE_SIZE; // 192
const IMG_HEIGHT = ROWS * TILE_SIZE; // 64

interface TilesetImageCanvasProps {
  src: string;
  onFrameClick?: (frameIndex: number) => void;
  className?: string;
}

/**
 * Canvas component that displays a 192x64 tileset image with a 12x4 grid
 * overlay, frame hover highlighting, and click-to-select interaction.
 */
export function TilesetImageCanvas({
  src,
  onFrameClick,
  className,
}: TilesetImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);
  const [zoom, setZoom] = useState(3);

  // Load image when src changes
  useEffect(() => {
    if (!src) {
      setLoadedImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLoadedImage(img);
      setImageError(false);
    };
    img.onerror = () => {
      setLoadedImage(null);
      setImageError(true);
    };
    img.src = src;
  }, [src]);

  // Redraw canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = IMG_WIDTH * zoom;
    const h = IMG_HEIGHT * zoom;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    if (!loadedImage) {
      // Placeholder
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        imageError ? 'Failed to load image' : 'Loading...',
        w / 2,
        h / 2
      );
      return;
    }

    // Draw the tileset image scaled up
    ctx.drawImage(loadedImage, 0, 0, w, h);

    // Grid overlay: 1px white lines at 25% opacity
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let col = 1; col < COLS; col++) {
      const x = col * TILE_SIZE * zoom;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }

    // Horizontal lines
    for (let row = 1; row < ROWS; row++) {
      const y = row * TILE_SIZE * zoom;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    // Hover highlight
    if (hoveredFrame !== null && hoveredFrame >= 0 && hoveredFrame < COLS * ROWS) {
      const col = hoveredFrame % COLS;
      const row = Math.floor(hoveredFrame / COLS);
      const x = col * TILE_SIZE * zoom;
      const y = row * TILE_SIZE * zoom;
      const size = TILE_SIZE * zoom;

      // 2px primary color border
      ctx.strokeStyle = 'hsl(217, 91%, 60%)'; // Tailwind primary blue
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

      // Frame index tooltip
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      const text = `#${hoveredFrame}`;
      ctx.font = `${Math.max(10, 12)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const metrics = ctx.measureText(text);
      const pad = 3;
      const tooltipX = x + 2;
      const tooltipY = y + 2;
      ctx.fillRect(tooltipX, tooltipY, metrics.width + pad * 2, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, tooltipX + pad, tooltipY + pad);
    }
  }, [loadedImage, imageError, hoveredFrame, zoom]);

  useEffect(() => {
    render();
  }, [render]);

  function getFrameFromEvent(e: React.MouseEvent<HTMLCanvasElement>): number | null {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(x / (TILE_SIZE * zoom));
    const row = Math.floor(y / (TILE_SIZE * zoom));

    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return row * COLS + col;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    setHoveredFrame(getFrameFromEvent(e));
  }

  function handleMouseLeave() {
    setHoveredFrame(null);
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const frame = getFrameFromEvent(e);
    if (frame !== null) {
      onFrameClick?.(frame);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-muted-foreground">Zoom:</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z - 1))}
          className="px-2 py-0.5 text-sm border rounded hover:bg-muted"
          disabled={zoom <= 1}
        >
          -
        </button>
        <span className="text-sm font-mono w-8 text-center">{zoom}x</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(8, z + 1))}
          className="px-2 py-0.5 text-sm border rounded hover:bg-muted"
          disabled={zoom >= 8}
        >
          +
        </button>
      </div>
      <div className="overflow-auto border rounded-lg bg-muted">
        <canvas
          ref={canvasRef}
          style={{ imageRendering: 'pixelated', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className="cursor-crosshair"
        />
      </div>
    </div>
  );
}
