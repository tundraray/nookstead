'use client';

import { spriteCSSStyle } from './sprite';
import { SPRITES } from './sprites';
import styles from './EnergyBar.module.css';

interface EnergyBarProps {
  energy: number;
  maxEnergy: number;
}

function getFillColor(pct: number): string {
  if (pct > 35) return '#5FAD46'; // Meadow Green
  if (pct > 15) return '#DAA520'; // Harvest Gold
  return '#C0392B'; // Sunset Red
}

export function EnergyBar({ energy, maxEnergy }: EnergyBarProps) {
  const pct = maxEnergy > 0 ? Math.max(0, Math.min(100, (energy / maxEnergy) * 100)) : 0;
  const fillColor = getFillColor(pct);

  return (
    <div
      className={styles.wrapper}
      role="progressbar"
      aria-valuenow={energy}
      aria-valuemin={0}
      aria-valuemax={maxEnergy}
      aria-label={`Energy: ${energy} of ${maxEnergy}`}
    >
      <div className={styles.frame}>
        <div
          style={spriteCSSStyle(...SPRITES.energyFrame)}
          aria-hidden="true"
        />
        <div className={styles.track}>
          <div
            className={styles.fill}
            style={{ height: `${pct}%`, backgroundColor: fillColor }}
          />
        </div>
      </div>
      <span className={styles.label} aria-hidden="true">
        {energy}
      </span>
    </div>
  );
}
