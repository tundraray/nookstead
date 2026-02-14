'use client';

import { spriteNativeStyle } from './sprite';
import { SPRITES } from './sprites';

interface MenuButtonProps {
  onClick: () => void;
}

export function MenuButton({ onClick }: MenuButtonProps) {
  return (
    <button
      className="menu-button"
      onClick={onClick}
      aria-label="Open game menu"
      data-interactive="true"
    >
      <div
        className="menu-button__sprite-normal"
        style={spriteNativeStyle(...SPRITES.menuBtnNormal)}
        aria-hidden="true"
      />
      <div
        className="menu-button__sprite-hover"
        style={spriteNativeStyle(...SPRITES.menuBtnActive)}
        aria-hidden="true"
      />
    </button>
  );
}
