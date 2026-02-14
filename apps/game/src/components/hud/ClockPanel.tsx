'use client';

import { NineSlicePanel } from './NineSlicePanel';
import { spriteCSSStyle } from './sprite';
import { SPRITES } from './sprites';
import type { Season } from './types';
import styles from './ClockPanel.module.css';

interface ClockPanelProps {
  day: number;
  time: string;
  season: Season;
}

const SEASON_SPRITES = {
  spring: SPRITES.seasonSpring,
  summer: SPRITES.seasonSummer,
  autumn: SPRITES.seasonAutumn,
  winter: SPRITES.seasonWinter,
} as const;

export function ClockPanel({ day, time, season }: ClockPanelProps) {
  const seasonSprite = SEASON_SPRITES[season];

  return (
    <div
      className={styles.wrapper}
      role="status"
      aria-live="polite"
      aria-label={`Day ${day}, ${time}, ${season}`}
    >
      <NineSlicePanel>
        <div className={styles.content}>
          <div
            className={styles.seasonIcon}
            style={spriteCSSStyle(...seasonSprite)}
            aria-hidden="true"
          />
          <div className={styles.text}>
            <span className={styles.line}>Day {day}</span>
            <span className={`${styles.line} ${styles.time}`}>{time}</span>
          </div>
        </div>
      </NineSlicePanel>
    </div>
  );
}
