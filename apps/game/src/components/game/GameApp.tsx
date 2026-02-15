'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { PhaserGame, IRefPhaserGame } from './PhaserGame';
import { LoadingScreen } from './LoadingScreen';
import { HUD } from '@/components/hud/HUD';
import { GameHeader } from '@/components/header/GameHeader';
import { EventBus } from '@/game/EventBus';

export function GameApp() {
  const phaserRef = useRef<IRefPhaserGame | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiScale, setUiScale] = useState(3);

  useEffect(() => {
    const onPreloadComplete = () => setLoading(false);
    EventBus.on('preload-complete', onPreloadComplete);
    return () => {
      EventBus.removeListener('preload-complete', onPreloadComplete);
    };
  }, []);

  // Compute --ui-scale from canvas area dimensions (not full viewport)
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const scaleX = Math.floor(width / 480);
        const scaleY = Math.floor(height / 270);
        setUiScale(Math.max(2, Math.min(6, Math.min(scaleX, scaleY))));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onSceneReady = useCallback((_scene: Phaser.Scene) => {
    // Scene is ready — can interact with Phaser from React here
  }, []);

  return (
    <div className="game-app">
      <GameHeader />
      <div
        className="game-canvas-area"
        ref={canvasAreaRef}
        style={{ '--ui-scale': uiScale } as React.CSSProperties}
      >
        <LoadingScreen visible={loading} />
        <PhaserGame ref={phaserRef} currentActiveScene={onSceneReady} />
        {!loading && <HUD uiScale={uiScale} />}
      </div>
    </div>
  );
}
