'use client';

import { useRef, useEffect, useCallback } from 'react';
import { drawFrame } from './portrait-canvas';
import {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  SHEET_COLUMNS,
  ANIMATION_FPS,
  type AnimationType,
} from './types';
import styles from './PortraitGenerator.module.css';

interface PortraitCanvasProps {
  images: HTMLImageElement[];
  animationType: AnimationType;
  scale?: number;
  isLoading?: boolean;
}

export function PortraitCanvas({
  images,
  animationType,
  scale = 8,
  isLoading = false,
}: PortraitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const width = FRAME_WIDTH * scale;
  const height = FRAME_HEIGHT * scale;
  const frameInterval = 1000 / ANIMATION_FPS;

  const animate = useCallback(
    (time: number) => {
      const elapsed = time - lastTimeRef.current;

      if (elapsed >= frameInterval) {
        lastTimeRef.current = time - (elapsed % frameInterval);
        frameRef.current = (frameRef.current + 1) % SHEET_COLUMNS;

        const canvas = canvasRef.current;
        if (canvas && images.length > 0) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawFrame(ctx, images, frameRef.current, animationType, scale);
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    },
    [images, animationType, scale, frameInterval]
  );

  useEffect(() => {
    // Reset frame when animation type changes
    frameRef.current = 0;
    lastTimeRef.current = 0;

    // Draw first frame immediately
    const canvas = canvasRef.current;
    if (canvas && images.length > 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawFrame(ctx, images, 0, animationType, scale);
      }
    }

    // idle = static, no animation loop
    if (animationType === 'idle') return;

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate, images, animationType, scale]);

  return (
    <div className={styles.canvasWrapper}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
      />
      {isLoading && (
        <div className={styles.canvasLoading}>
          <span>Loading...</span>
        </div>
      )}
    </div>
  );
}
