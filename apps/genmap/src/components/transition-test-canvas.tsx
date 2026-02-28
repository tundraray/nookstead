'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Paintbrush, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { getFrame, computeNeighborMask } from '@nookstead/map-lib';
import type { TilesetInfo, Cell } from '@nookstead/map-lib';

const GRID_SIZE = 10;
const BASE_TILE_SIZE = 16;
const MIN_ZOOM = 100;
const MAX_ZOOM = 600;
const ZOOM_STEP = 100;
const SRC_COLS = 12;

type CellValue = 'A' | 'B';

/**
 * Fake tilesets for the transition test canvas.
 * Maps synthetic terrain names 'A' and 'B' to tileset entries
 * so computeNeighborMask can perform neighbor matching.
 */
const TEST_TILESETS: ReadonlyArray<TilesetInfo> = [
  { key: 'A', name: 'A' },
  { key: 'B', name: 'B' },
];

/**
 * Convert a CellValue grid to a Cell-compatible grid for computeNeighborMask.
 * Uses a type assertion because 'A'/'B' are not production TerrainCellType values,
 * but computeNeighborMask only performs string comparison at runtime.
 */
function toCellGrid(grid: CellValue[][]): Cell[][] {
  return grid.map((row) =>
    row.map((val) => ({ terrain: val, elevation: 0, meta: {} }))
  ) as unknown as Cell[][];
}

interface TransitionTestCanvasProps {
  tilesetSrc: string;
  inverseTilesetSrc?: string;
  fromMaterialColor: string;
  toMaterialColor: string;
}

/**
 * Create initial 10x10 grid filled with 'B' (the "to" material).
 */
function createEmptyGrid(): CellValue[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => 'B' as CellValue)
  );
}

/**
 * Compute the frame grid for all 'A' cells using the Blob-47 autotile algorithm.
 * Returns a 2D array where each cell is a frame index (0-47) or -1 for 'B' cells.
 */
function computeFrameGrid(grid: CellValue[][]): number[][] {
  const cellGrid = toCellGrid(grid);
  const height = grid.length;
  const width = grid[0].length;
  return grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell === 'B') return -1;
      const mask = computeNeighborMask(
        cellGrid, c, r, width, height, 'A', TEST_TILESETS,
        { outOfBoundsMatches: false },
      );
      return getFrame(mask);
    })
  );
}

/**
 * Compute the inverse frame grid for 'B' cells, treating them as the "to" material
 * with neighbors being other 'B' cells (for inverse tileset rendering).
 */
function computeInverseFrameGrid(grid: CellValue[][]): number[][] {
  const cellGrid = toCellGrid(grid);
  const height = grid.length;
  const width = grid[0].length;
  return grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell === 'A') return -1;
      const mask = computeNeighborMask(
        cellGrid, c, r, width, height, 'B', TEST_TILESETS,
        { outOfBoundsMatches: false },
      );
      return getFrame(mask);
    })
  );
}

/**
 * Interactive 10x10 tile grid for testing autotile transitions.
 * Users paint cells as Material A or Material B and see autotile frames
 * rendered in real time from the tileset sprite sheet.
 */
export function TransitionTestCanvas({
  tilesetSrc,
  inverseTilesetSrc,
  fromMaterialColor,
  toMaterialColor,
}: TransitionTestCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<CellValue[][]>(createEmptyGrid);
  const [frameGrid, setFrameGrid] = useState<number[][]>(() =>
    computeFrameGrid(createEmptyGrid())
  );
  const [inverseFrameGrid, setInverseFrameGrid] = useState<number[][]>(() =>
    computeInverseFrameGrid(createEmptyGrid())
  );
  const [activeBrush, setActiveBrush] = useState<CellValue>('A');
  const [zoom, setZoom] = useState(200);
  const isMouseDownRef = useRef(false);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  // Loaded tileset images
  const [tilesetImg, setTilesetImg] = useState<HTMLImageElement | null>(null);
  const [inverseTilesetImg, setInverseTilesetImg] = useState<HTMLImageElement | null>(null);

  // Load tileset image
  useEffect(() => {
    if (!tilesetSrc) {
      setTilesetImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setTilesetImg(img);
    img.onerror = () => setTilesetImg(null);
    img.src = tilesetSrc;
  }, [tilesetSrc]);

  // Load inverse tileset image
  useEffect(() => {
    if (!inverseTilesetSrc) {
      setInverseTilesetImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setInverseTilesetImg(img);
    img.onerror = () => setInverseTilesetImg(null);
    img.src = inverseTilesetSrc;
  }, [inverseTilesetSrc]);

  const cellSize = BASE_TILE_SIZE * (zoom / 100);
  const canvasSize = GRID_SIZE * cellSize;

  // Recalculate autotile frames
  const recalcFrames = useCallback((g: CellValue[][]) => {
    setFrameGrid(computeFrameGrid(g));
    setInverseFrameGrid(computeInverseFrameGrid(g));
  }, []);

  // Draw the canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = Math.round(canvasSize);
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }

    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = col * cellSize;
        const y = row * cellSize;
        const cell = grid[row][col];

        if (cell === 'A') {
          const frame = frameGrid[row]?.[col] ?? -1;
          if (frame >= 0 && tilesetImg) {
            const srcCol = frame % SRC_COLS;
            const srcRow = Math.floor(frame / SRC_COLS);
            // Fill with from material color first as background
            ctx.fillStyle = fromMaterialColor;
            ctx.fillRect(x, y, cellSize, cellSize);
            ctx.drawImage(
              tilesetImg,
              srcCol * BASE_TILE_SIZE,
              srcRow * BASE_TILE_SIZE,
              BASE_TILE_SIZE,
              BASE_TILE_SIZE,
              x,
              y,
              cellSize,
              cellSize
            );
          } else {
            // Fallback: solid from material color
            ctx.fillStyle = fromMaterialColor;
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        } else {
          // B cell
          const inverseFrame = inverseFrameGrid[row]?.[col] ?? -1;
          if (inverseFrame >= 0 && inverseTilesetImg) {
            const srcCol = inverseFrame % SRC_COLS;
            const srcRow = Math.floor(inverseFrame / SRC_COLS);
            ctx.fillStyle = toMaterialColor;
            ctx.fillRect(x, y, cellSize, cellSize);
            ctx.drawImage(
              inverseTilesetImg,
              srcCol * BASE_TILE_SIZE,
              srcRow * BASE_TILE_SIZE,
              BASE_TILE_SIZE,
              BASE_TILE_SIZE,
              x,
              y,
              cellSize,
              cellSize
            );
          } else {
            // Solid to material color
            ctx.fillStyle = toMaterialColor;
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }
      }
    }

    // Grid lines: 1px white at 15% opacity
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      const pos = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos + 0.5, 0);
      ctx.lineTo(pos + 0.5, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos + 0.5);
      ctx.lineTo(size, pos + 0.5);
      ctx.stroke();
    }
  }, [
    grid,
    frameGrid,
    inverseFrameGrid,
    cellSize,
    canvasSize,
    fromMaterialColor,
    toMaterialColor,
    tilesetImg,
    inverseTilesetImg,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  function getCellFromEvent(e: React.MouseEvent<HTMLCanvasElement>): {
    row: number;
    col: number;
  } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
    return { row, col };
  }

  function paintCell(row: number, col: number) {
    setGrid((prev) => {
      if (prev[row][col] === activeBrush) return prev;
      const next = prev.map((r) => [...r]);
      next[row][col] = activeBrush;
      gridRef.current = next;
      return next;
    });
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    isMouseDownRef.current = true;
    const cell = getCellFromEvent(e);
    if (cell) paintCell(cell.row, cell.col);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isMouseDownRef.current) return;
    const cell = getCellFromEvent(e);
    if (cell) paintCell(cell.row, cell.col);
  }

  function handleMouseUp() {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false;
      // Recalculate autotile frames on mouse up
      recalcFrames(gridRef.current);
    }
  }

  function handleMouseLeave() {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false;
      recalcFrames(gridRef.current);
    }
  }

  function handleClear() {
    const empty = createEmptyGrid();
    setGrid(empty);
    recalcFrames(empty);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Material A brush */}
        <Button
          variant={activeBrush === 'A' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveBrush('A')}
        >
          <Paintbrush className="size-4 mr-1.5" />
          <span
            className="inline-block size-3 rounded-full border mr-1"
            style={{ backgroundColor: fromMaterialColor }}
          />
          Material A
        </Button>

        {/* Material B brush */}
        <Button
          variant={activeBrush === 'B' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveBrush('B')}
        >
          <Paintbrush className="size-4 mr-1.5" />
          <span
            className="inline-block size-3 rounded-full border mr-1"
            style={{ backgroundColor: toMaterialColor }}
          />
          Material B
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Clear */}
        <Button variant="outline" size="sm" onClick={handleClear}>
          <RotateCcw className="size-4 mr-1.5" />
          Clear
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Zoom controls */}
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
          disabled={zoom <= MIN_ZOOM}
        >
          <ZoomOut className="size-4" />
        </Button>
        <span className="text-sm font-mono w-10 text-center">{zoom}%</span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM}
        >
          <ZoomIn className="size-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div className="overflow-auto border rounded-lg bg-muted inline-block">
        <canvas
          ref={canvasRef}
          style={{ imageRendering: 'pixelated', display: 'block' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="cursor-crosshair"
        />
      </div>
    </div>
  );
}
