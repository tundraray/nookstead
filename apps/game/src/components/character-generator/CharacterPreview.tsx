'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { drawPreviewFrame, type LayerConfig } from './spritesheet-compositor';
import styles from './CharacterGenerator.module.css';

const PREVIEW_SCALE = 8;
const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 32;
const CANVAS_WIDTH = FRAME_WIDTH * PREVIEW_SCALE;
const CANVAS_HEIGHT = FRAME_HEIGHT * PREVIEW_SCALE;

/** Animation timing at 8 FPS. */
const FRAME_INTERVAL_MS = 125;

/** Direction stride in row 1 (6 columns per direction group). */
const DIR_STRIDE = 6;
const IDLE_ROW = 1;
const IDLE_FRAMES = 1;
const WAIT_ROW = 1;
const WAIT_FRAMES = 6;
const WALK_ROW = 2;
const WALK_FRAMES = 6;
const SIT_ROW = 4;
const SIT_FRAMES = 3;

/**
 * Remap standard dirIndex to sit direction order.
 * Standard: RIGHT=0, UP=1, LEFT=2, DOWN=3
 * Sit:      RIGHT=0, DOWN=1, LEFT=2, UP=3
 */
const SIT_DIR_REMAP = [0, 3, 2, 1];

interface DirectionConfig {
  label: string;
  dirIndex: number;
}

const DIRECTIONS: DirectionConfig[] = [
  { label: 'Down', dirIndex: 3 },
  { label: 'Left', dirIndex: 2 },
  { label: 'Right', dirIndex: 0 },
  { label: 'Up', dirIndex: 1 },
];

interface Props {
  layers: LayerConfig[];
  isLoading: boolean;
}

export function CharacterPreview({ layers, isLoading }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<{
    frameIndex: number;
    lastTime: number;
    animId: number;
    row: number;
    frameCount: number;
    colOffset: number;
  }>({
    frameIndex: 0,
    lastTime: 0,
    animId: 0,
    row: IDLE_ROW,
    frameCount: IDLE_FRAMES,
    colOffset: 3 * DIR_STRIDE, // down direction
  });

  const [animType, setAnimType] = useState<'idle' | 'wait' | 'walk' | 'sit'>('idle');
  const [dirIndex, setDirIndex] = useState(3); // down

  const animate = useCallback(
    (time: number) => {
      const state = animRef.current;
      if (time - state.lastTime >= FRAME_INTERVAL_MS) {
        state.lastTime = time;
        state.frameIndex = (state.frameIndex + 1) % state.frameCount;

        const canvas = canvasRef.current;
        if (canvas && layers.length > 0) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const col = state.colOffset + state.frameIndex;
            drawPreviewFrame(ctx, layers, state.row, col, PREVIEW_SCALE);
          }
        }
      }
      state.animId = requestAnimationFrame(animate);
    },
    [layers]
  );

  useEffect(() => {
    const state = animRef.current;
    if (animType === 'walk') {
      state.row = WALK_ROW;
      state.frameCount = WALK_FRAMES;
      state.colOffset = dirIndex * WALK_FRAMES;
    } else if (animType === 'wait') {
      state.row = WAIT_ROW;
      state.frameCount = WAIT_FRAMES;
      state.colOffset = dirIndex * WAIT_FRAMES;
    } else if (animType === 'sit') {
      state.row = SIT_ROW;
      state.frameCount = SIT_FRAMES;
      state.colOffset = SIT_DIR_REMAP[dirIndex] * SIT_FRAMES;
    } else {
      // idle: static single frame
      state.row = IDLE_ROW;
      state.frameCount = IDLE_FRAMES;
      state.colOffset = dirIndex * DIR_STRIDE;
    }
    state.frameIndex = 0;
  }, [animType, dirIndex]);

  useEffect(() => {
    if (layers.length === 0) return;

    // Draw initial frame
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const state = animRef.current;
        const col = state.colOffset + state.frameIndex;
        drawPreviewFrame(ctx, layers, state.row, col, PREVIEW_SCALE);
      }
    }

    const state = animRef.current;
    state.animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(state.animId);
  }, [layers, animate]);

  return (
    <div className={styles.previewSection}>
      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={styles.canvas}
        />
        {isLoading && <div className={styles.loadingOverlay}>Loading...</div>}
      </div>
      <div className={styles.animControls}>
        <div className={styles.animRow}>
          <button
            className={`${styles.animButton} ${animType === 'idle' ? styles.animButtonActive : ''}`}
            onClick={() => setAnimType('idle')}
          >
            Idle
          </button>
          <button
            className={`${styles.animButton} ${animType === 'wait' ? styles.animButtonActive : ''}`}
            onClick={() => setAnimType('wait')}
          >
            Wait
          </button>
          <button
            className={`${styles.animButton} ${animType === 'walk' ? styles.animButtonActive : ''}`}
            onClick={() => setAnimType('walk')}
          >
            Walk
          </button>
          <button
            className={`${styles.animButton} ${animType === 'sit' ? styles.animButtonActive : ''}`}
            onClick={() => setAnimType('sit')}
          >
            Sit
          </button>
        </div>
        <div className={styles.animRow}>
          {DIRECTIONS.map((dir) => (
            <button
              key={dir.label}
              className={`${styles.animButton} ${dirIndex === dir.dirIndex ? styles.animButtonActive : ''}`}
              onClick={() => setDirIndex(dir.dirIndex)}
            >
              {dir.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
