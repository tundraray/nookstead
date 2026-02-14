'use client';

import { NineSlicePanel } from './NineSlicePanel';
import { spriteCSSStyle } from './sprite';
import { SPRITES } from './sprites';

interface CurrencyDisplayProps {
  gold: number;
}

export function CurrencyDisplay({ gold }: CurrencyDisplayProps) {
  const formatted = gold.toLocaleString();

  return (
    <div
      className="currency-display"
      role="status"
      aria-label={`Gold: ${formatted}`}
    >
      <NineSlicePanel>
        <div className="currency-display__content">
          <div
            className="currency-display__icon"
            style={spriteCSSStyle(...SPRITES.coinIcon)}
            aria-hidden="true"
          />
          <span className="currency-display__amount">{formatted}</span>
        </div>
      </NineSlicePanel>
    </div>
  );
}
