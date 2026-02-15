'use client';

import { Press_Start_2P } from 'next/font/google';
import { spriteNativeStyle } from '@/components/hud/sprite';
import { SPRITES } from '@/components/hud/sprites';
import { NAV_ITEMS } from './constants';
import { NavIcon } from './NavIcon';
import { useHeaderState } from './useHeaderState';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
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
  const { state, togglePanel, closePanel } = useHeaderState();
  useKeyboardShortcuts(togglePanel, closePanel, state.activePanel);

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

        {/* Navigation Zone */}
        <nav
          className="game-header__nav-zone"
          aria-label="Game navigation"
        >
          {NAV_ITEMS.map((item) => (
            <NavIcon
              key={item.id}
              item={item}
              isActive={state.activePanel === item.id}
              onClick={() => togglePanel(item.id)}
            />
          ))}
        </nav>

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
      </div>
    </header>
  );
}
