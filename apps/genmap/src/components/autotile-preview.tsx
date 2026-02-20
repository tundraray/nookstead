'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const TILE_SIZE = 16;
const SRC_COLS = 12;
const TOTAL_FRAMES = 48;

// Preview grid layout: 8 columns x 6 rows = 48 cells
const PREVIEW_COLS = 8;
const PREVIEW_ROWS = 6;
const CELL_SIZE = 24; // Each frame rendered at 24x24 (1.5x zoom)
const CELL_GAP = 4;
const LABEL_HEIGHT = 12;
const CELL_TOTAL_W = CELL_SIZE + CELL_GAP;
const CELL_TOTAL_H = CELL_SIZE + LABEL_HEIGHT + CELL_GAP;

const CANVAS_WIDTH = PREVIEW_COLS * CELL_TOTAL_W;
const CANVAS_HEIGHT = PREVIEW_ROWS * CELL_TOTAL_H;

// Checkerboard pattern sizes for transparency indicator
const CHECK_SIZE = 4;

interface AutotilePreviewProps {
  src: string;
  className?: string;
}

/**
 * Renders all 48 autotile frames from a tileset image in a compact 8x6 grid.
 * Each cell shows the frame at 1.5x zoom with frame index label and
 * checkerboard background for transparency indication.
 */
export function AutotilePreview({ src, className }: AutotilePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);

  // Load image
  useEffect(() => {
    if (!src) {
      setLoadedImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setLoadedImage(img);
    img.onerror = () => setLoadedImage(null);
    img.src = src;
  }, [src]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== CANVAS_WIDTH || canvas.height !== CANVAS_HEIGHT) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const gridCol = i % PREVIEW_COLS;
      const gridRow = Math.floor(i / PREVIEW_COLS);
      const dx = gridCol * CELL_TOTAL_W + CELL_GAP / 2;
      const dy = gridRow * CELL_TOTAL_H + CELL_GAP / 2;

      // Checkerboard background
      for (let cy = 0; cy < CELL_SIZE; cy += CHECK_SIZE) {
        for (let cx = 0; cx < CELL_SIZE; cx += CHECK_SIZE) {
          const isLight = ((cx / CHECK_SIZE) + (cy / CHECK_SIZE)) % 2 === 0;
          ctx.fillStyle = isLight ? '#e0e0e0' : '#c0c0c0';
          ctx.fillRect(
            dx + cx,
            dy + cy,
            Math.min(CHECK_SIZE, CELL_SIZE - cx),
            Math.min(CHECK_SIZE, CELL_SIZE - cy)
          );
        }
      }

      // Draw frame from tileset image
      if (loadedImage) {
        const srcCol = i % SRC_COLS;
        const srcRow = Math.floor(i / SRC_COLS);
        ctx.drawImage(
          loadedImage,
          srcCol * TILE_SIZE,
          srcRow * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          dx,
          dy,
          CELL_SIZE,
          CELL_SIZE
        );
      }

      // Hover highlight
      if (hoveredFrame === i) {
        ctx.strokeStyle = 'hsl(217, 91%, 60%)';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx + 1, dy + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }

      // Frame index label
      ctx.fillStyle = '#9ca3af'; // muted-foreground
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${i}`, dx + CELL_SIZE / 2, dy + CELL_SIZE + 1);
    }
  }, [loadedImage, hoveredFrame]);

  useEffect(() => {
    render();
  }, [render]);

  function getFrameFromEvent(e: React.MouseEvent<HTMLCanvasElement>): number | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(x / CELL_TOTAL_W);
    const row = Math.floor(y / CELL_TOTAL_H);

    if (col < 0 || col >= PREVIEW_COLS || row < 0 || row >= PREVIEW_ROWS) return null;

    const localX = x - col * CELL_TOTAL_W - CELL_GAP / 2;
    const localY = y - row * CELL_TOTAL_H - CELL_GAP / 2;

    // Only highlight if within the cell area (not the label or gap)
    if (localX < 0 || localX >= CELL_SIZE || localY < 0 || localY >= CELL_SIZE) return null;

    const frame = row * PREVIEW_COLS + col;
    return frame < TOTAL_FRAMES ? frame : null;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    setHoveredFrame(getFrameFromEvent(e));
  }

  function handleMouseLeave() {
    setHoveredFrame(null);
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2">Autotile Frames (48)</h3>
      <div className="border rounded-lg p-2 bg-muted inline-block">
        <canvas
          ref={canvasRef}
          style={{ imageRendering: 'pixelated', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="cursor-default"
        />
      </div>
      {hoveredFrame !== null && (
        <p className="text-xs text-muted-foreground mt-1">
          Frame {hoveredFrame}
        </p>
      )}
    </div>
  );
}
