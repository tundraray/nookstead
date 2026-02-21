'use client';

import { useEffect, useRef } from 'react';

export interface LayerPreviewData {
  frameId: string;
  spriteId: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  xOffset: number;
  yOffset: number;
  layerOrder: number;
  spriteUrl: string;
}

interface ObjectPreviewProps {
  layers: LayerPreviewData[];
  className?: string;
}

const PLACEHOLDER_SIZE = 32;

function drawMissingPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.fillStyle = '#ff000033';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();

  ctx.fillStyle = '#ff0000';
  ctx.font = '10px sans-serif';
  ctx.fillText('missing', x + 2, y + 12);
}

function computeBoundingBox(layers: LayerPreviewData[]): {
  width: number;
  height: number;
} {
  if (layers.length === 0) {
    return { width: PLACEHOLDER_SIZE, height: PLACEHOLDER_SIZE };
  }

  let maxX = 0;
  let maxY = 0;

  for (const layer of layers) {
    const right = layer.xOffset + (layer.frameW || PLACEHOLDER_SIZE);
    const bottom = layer.yOffset + (layer.frameH || PLACEHOLDER_SIZE);
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  return {
    width: Math.max(maxX, 1),
    height: Math.max(maxY, 1),
  };
}

export function ObjectPreview({ layers, className }: ObjectPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const { width, height } = computeBoundingBox(layers);

  useEffect(() => {
    if (layers.length === 0) {
      renderEmpty();
      return;
    }

    const uniqueSprites = new Map<string, string>();
    for (const layer of layers) {
      if (!uniqueSprites.has(layer.spriteId)) {
        uniqueSprites.set(layer.spriteId, layer.spriteUrl);
      }
    }

    let pending = 0;
    const spritesToLoad: Array<[string, string]> = [];

    for (const [spriteId, url] of uniqueSprites) {
      if (imageCacheRef.current.has(spriteId)) {
        continue;
      }
      spritesToLoad.push([spriteId, url]);
      pending++;
    }

    if (pending === 0) {
      renderLayers();
      return;
    }

    for (const [spriteId, url] of spritesToLoad) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCacheRef.current.set(spriteId, img);
        pending--;
        if (pending === 0) renderLayers();
      };
      img.onerror = () => {
        pending--;
        if (pending === 0) renderLayers();
      };
      img.src = url;
    }
  }, [layers, width, height]);

  function renderEmpty() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ccc';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No layers', canvas.width / 2, canvas.height / 2 + 4);
    ctx.textAlign = 'start';
  }

  function renderLayers() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    const sorted = [...layers].sort((a, b) => a.layerOrder - b.layerOrder);

    for (const layer of sorted) {
      const img = imageCacheRef.current.get(layer.spriteId);

      if (img && img.naturalWidth > 0) {
        ctx.drawImage(
          img,
          layer.frameX,
          layer.frameY,
          layer.frameW,
          layer.frameH,
          layer.xOffset,
          layer.yOffset,
          layer.frameW,
          layer.frameH
        );
      } else {
        drawMissingPlaceholder(
          ctx,
          layer.xOffset,
          layer.yOffset,
          layer.frameW || PLACEHOLDER_SIZE,
          layer.frameH || PLACEHOLDER_SIZE
        );
      }
    }
  }

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ imageRendering: 'pixelated', display: 'block' }}
      />
    </div>
  );
}
