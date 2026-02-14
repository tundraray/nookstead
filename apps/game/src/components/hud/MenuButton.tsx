'use client';

import { spriteCSSStyle } from './sprite';
import { SPRITES } from './sprites';
import styles from './MenuButton.module.css';

interface MenuButtonProps {
  onClick: () => void;
}

export function MenuButton({ onClick }: MenuButtonProps) {
  return (
    <button
      className={styles.button}
      onClick={onClick}
      aria-label="Open game menu"
      data-interactive="true"
    >
      <div
        className={styles.spriteNormal}
        style={spriteCSSStyle(...SPRITES.menuBtnNormal)}
        aria-hidden="true"
      />
      <div
        className={styles.spriteHover}
        style={spriteCSSStyle(...SPRITES.menuBtnHover)}
        aria-hidden="true"
      />
    </button>
  );
}
