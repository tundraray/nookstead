'use client';

import { NineSlicePanel } from './NineSlicePanel';
import { spriteCSSStyle } from './sprite';
import { SPRITES } from './sprites';
import type { Season } from './types';

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
      className="clock-panel"
      role="status"
      aria-live="polite"
      aria-label={`Day ${day}, ${time}, ${season}`}
    >
      <NineSlicePanel>
        <div className="clock-panel__content">
          <div
            className="clock-panel__season-icon"
            style={spriteCSSStyle(...seasonSprite)}
            aria-hidden="true"
          />
          <div className="clock-panel__text">
            <span className="clock-panel__line">Day {day}</span>
            <span className="clock-panel__line clock-panel__time">{time}</span>
          </div>
        </div>
      </NineSlicePanel>
    </div>
  );
}
