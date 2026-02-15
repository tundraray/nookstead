'use client';

import { useState, useRef } from 'react';
import { spriteNativeStyle } from '@/components/hud/sprite';
import { SPRITES } from '@/components/hud/sprites';
import type { NavItem, PanelId, SpriteRect } from '@/components/hud/types';

const NAV_SPRITES: Record<PanelId, SpriteRect> = {
  inventory: SPRITES.navInventory,
  map: SPRITES.navMap,
  quests: SPRITES.navQuests,
  social: SPRITES.navSocial,
  settings: SPRITES.navSettings,
};

interface NavIconProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}

export function NavIcon({ item, isActive, onClick }: NavIconProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShowTooltip(true), 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  };

  return (
    <div className="game-header__nav-item">
      <button
        className={`game-header__nav-icon ${isActive ? 'game-header__nav-icon--active' : ''}`}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label={item.tooltip}
        aria-pressed={isActive}
        data-interactive="true"
      >
        <span
          className="game-header__nav-sprite"
          style={spriteNativeStyle(...NAV_SPRITES[item.id])}
          aria-hidden="true"
        />
        <span className="game-header__nav-label">{item.label}</span>
      </button>
      {showTooltip && (
        <div className="game-header__tooltip" role="tooltip">
          {item.tooltip}
        </div>
      )}
    </div>
  );
}
