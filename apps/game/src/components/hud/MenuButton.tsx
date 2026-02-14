'use client';

import { spriteNativeStyle } from './sprite';
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
        style={spriteNativeStyle(...SPRITES.menuBtnNormal)}
        aria-hidden="true"
      />
      <div
        className={styles.spriteHover}
        style={spriteNativeStyle(...SPRITES.menuBtnActive)}
        aria-hidden="true"
      />
    </button>
  );
}
