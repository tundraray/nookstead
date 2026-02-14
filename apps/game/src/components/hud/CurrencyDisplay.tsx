'use client';

import { NineSlicePanel } from './NineSlicePanel';
import { spriteCSSStyle } from './sprite';
import { SPRITES } from './sprites';
import styles from './CurrencyDisplay.module.css';

interface CurrencyDisplayProps {
  gold: number;
}

export function CurrencyDisplay({ gold }: CurrencyDisplayProps) {
  const formatted = gold.toLocaleString();

  return (
    <div
      className={styles.wrapper}
      role="status"
      aria-label={`Gold: ${formatted}`}
    >
      <NineSlicePanel>
        <div className={styles.content}>
          <div
            className={styles.icon}
            style={spriteCSSStyle(...SPRITES.coinIcon)}
            aria-hidden="true"
          />
          <span className={styles.amount}>{formatted}</span>
        </div>
      </NineSlicePanel>
    </div>
  );
}
