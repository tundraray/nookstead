'use client';

import { Press_Start_2P } from 'next/font/google';
import { spriteNativeStyle } from '@/components/hud/sprite';
import { SPRITES } from '@/components/hud/sprites';
import { useHeaderState } from './useHeaderState';
import { EventBus } from '@/game/EventBus';
import type { Season, SpriteRect } from '@/components/hud/types';

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixel',
});

const SEASON_SPRITES: Record<Season, SpriteRect> = {
  spring: SPRITES.seasonSpring,
  summer: SPRITES.seasonSummer,
  autumn: SPRITES.seasonAutumn,
  winter: SPRITES.seasonWinter,
};

export function GameHeader() {
  const { state } = useHeaderState();

  const seasonSprite = SEASON_SPRITES[state.season];
  const formattedGold = state.gold.toLocaleString();

  return (
    <header
      className={`game-header ${pixelFont.variable}`}
      role="banner"
    >
      <div className="game-header__content">
        {/* Logo Zone */}
        <div className="game-header__logo-zone">
          <span className="game-header__logo" aria-hidden="true">
            NOOKSTEAD
          </span>
        </div>

        {/* Clock Zone */}
        <div
          className="game-header__clock-zone"
          role="status"
          aria-live="polite"
          aria-label={`Day ${state.day}, ${state.time}, ${state.season}`}
        >
          <span
            className="game-header__season-icon"
            style={spriteNativeStyle(...seasonSprite)}
            aria-hidden="true"
          />
          <span className="game-header__clock-text">
            <span className="game-header__day">Day {state.day}</span>
            <span className="game-header__time">{state.time}</span>
          </span>
        </div>

        {/* Currency Zone */}
        <div
          className="game-header__currency-zone"
          role="status"
          aria-live="polite"
          aria-label={`Gold: ${formattedGold}`}
        >
          <span
            className="game-header__coin-icon"
            style={spriteNativeStyle(...SPRITES.coinIcon)}
            aria-hidden="true"
          />
          <span className="game-header__gold-amount">{formattedGold}</span>
        </div>

        {/* Reset Button */}
        <button
          className="game-header__reset-btn"
          type="button"
          aria-label="Teleport to spawn"
          title="Hard Reset"
          onClick={() => EventBus.emit('player:hard-reset')}
        >
          ↺
        </button>
      </div>
    </header>
  );
}
