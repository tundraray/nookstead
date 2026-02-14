'use client';

import { spriteCSSStyle } from './sprite';
import { SLOT_NORMAL, SLOT_SELECTED } from './sprites';
import { NineSlicePanel } from './NineSlicePanel';
import type { HotbarItem } from './types';
import styles from './HotbarSlot.module.css';

interface HotbarSlotProps {
  item: HotbarItem | null;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

export function HotbarSlot({
  item,
  index,
  isSelected,
  onClick,
}: HotbarSlotProps) {
  const keyLabel = index === 9 ? '0' : String(index + 1);

  return (
    <div className={styles.wrapper}>
      <span className={styles.keyHint} aria-hidden="true">
        {keyLabel}
      </span>
      <button
        className={styles.slot}
        onClick={onClick}
        aria-label={`Slot ${keyLabel}${item ? `: ${item.id}` : ': empty'}`}
        aria-pressed={isSelected}
        data-interactive="true"
      >
        <NineSlicePanel
          slices={isSelected ? SLOT_SELECTED : SLOT_NORMAL}
          className={styles.background}
        >
          <div className={styles.content}>
            {item && (
              <div
                className={styles.itemIcon}
                style={spriteCSSStyle(...item.spriteRect)}
                aria-hidden="true"
              />
            )}
            {item && item.quantity > 1 && (
              <span className={styles.quantity}>
                {item.quantity > 99 ? '99+' : item.quantity}
              </span>
            )}
          </div>
        </NineSlicePanel>
      </button>
    </div>
  );
}
