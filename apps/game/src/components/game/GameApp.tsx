'use client';

import { useRef, useState, useCallback } from 'react';
import { PhaserGame, IRefPhaserGame } from './PhaserGame';
import { LoadingScreen } from './LoadingScreen';
import { GameHUD } from './GameHUD';
import { EventBus } from '@/game/EventBus';
import { useEffect } from 'react';
import styles from './GameApp.module.css';

export function GameApp() {
  const phaserRef = useRef<IRefPhaserGame | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onPreloadComplete = () => setLoading(false);
    EventBus.on('preload-complete', onPreloadComplete);
    return () => {
      EventBus.removeListener('preload-complete', onPreloadComplete);
    };
  }, []);

  const onSceneReady = useCallback((_scene: Phaser.Scene) => {
    // Scene is ready — can interact with Phaser from React here
  }, []);

  return (
    <div className={styles.wrapper}>
      <LoadingScreen visible={loading} />
      <PhaserGame ref={phaserRef} currentActiveScene={onSceneReady} />
      {!loading && <GameHUD />}
    </div>
  );
}
