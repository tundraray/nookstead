'use client';

import { useState, useCallback } from 'react';
import type { CanvasBackground } from '@/lib/canvas-utils';

const STORAGE_KEY = 'genmap-canvas-background';

function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Safari private mode -- silently ignore
  }
}

const DEFAULT_BACKGROUND: CanvasBackground = { type: 'checkerboard' };

export function useCanvasBackground() {
  const [background, setBackgroundState] = useState<CanvasBackground>(() =>
    readFromStorage<CanvasBackground>(STORAGE_KEY, DEFAULT_BACKGROUND)
  );

  const setBackground = useCallback((bg: CanvasBackground) => {
    setBackgroundState(bg);
    writeToStorage(STORAGE_KEY, bg);
  }, []);

  return { background, setBackground };
}
