'use client';

import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { EventBus } from '@/game/EventBus';
import { FRAMES_PER_TERRAIN } from '@/game/autotile';
import type { TileClickEvent } from '@/game/scenes/Game';
import styles from './TileInspector.module.css';

const COLS = 12;
const ROWS = Math.ceil(FRAMES_PER_TERRAIN / COLS); // 4
const FRAME_PX = 48;

export function TileInspector() {
  const [data, setData] = useState<TileClickEvent | null>(null);

  useEffect(() => {
    const handler = (ev: TileClickEvent) => setData(ev);
    EventBus.on('tile-click', handler);
    return () => {
      EventBus.removeListener('tile-click', handler);
    };
  }, []);

  const handleFrameClick = useCallback(
    (e: MouseEvent<HTMLDivElement>, layerName: string) => {
      if (!data) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / FRAME_PX);
      const row = Math.floor((e.clientY - rect.top) / FRAME_PX);
      const newFrame = row * COLS + col;
      if (newFrame < 0 || newFrame >= FRAMES_PER_TERRAIN) return;

      EventBus.emit('tile-replace', {
        tileX: data.tileX,
        tileY: data.tileY,
        layerName,
        newFrame,
      });

      // Update local state so highlight moves to the new frame
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          layers: prev.layers.map((l) =>
            l.name === layerName ? { ...l, frame: newFrame } : l,
          ),
        };
      });
    },
    [data],
  );

  if (!data) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          Tile ({data.tileX}, {data.tileY})
        </span>
        <button className={styles.close} onClick={() => setData(null)}>
          &times;
        </button>
      </div>

      <div className={styles.meta}>
        <span>terrain: {data.terrain}</span>
        <span>elevation: {data.elevation.toFixed(3)}</span>
        <span>seed: {data.seed}</span>
      </div>

      {data.layers.map((layer) => (
        <div key={layer.name} className={styles.layerSection}>
          <div className={styles.layerName}>
            {layer.name}{' '}
            <span className={styles.dim}>
              {layer.terrainKey} frame {layer.frame}
            </span>
          </div>
          <div
            className={styles.tilesetWrapper}
            style={{
              width: COLS * FRAME_PX,
              height: ROWS * FRAME_PX,
            }}
            onClick={(e) => handleFrameClick(e, layer.name)}
          >
            <img
              className={styles.tilesetImg}
              src={`/assets/tilesets/${layer.terrainKey}.png`}
              alt={layer.terrainKey}
              draggable={false}
              width={COLS * FRAME_PX}
              height={ROWS * FRAME_PX}
            />
            <div
              className={styles.highlight}
              style={{
                left: (layer.frame % COLS) * FRAME_PX,
                top: Math.floor(layer.frame / COLS) * FRAME_PX,
                width: FRAME_PX,
                height: FRAME_PX,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
