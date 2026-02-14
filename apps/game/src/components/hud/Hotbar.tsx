'use client';

import { HotbarSlot } from './HotbarSlot';
import type { HotbarItem } from './types';
import styles from './Hotbar.module.css';

interface HotbarProps {
  items: (HotbarItem | null)[];
  selectedSlot: number;
  onSlotClick: (index: number) => void;
}

export function Hotbar({ items, selectedSlot, onSlotClick }: HotbarProps) {
  return (
    <nav
      className={styles.wrapper}
      role="toolbar"
      aria-label="Hotbar — keys 1-0 to select"
    >
      <div className={styles.slots}>
        {items.map((item, i) => (
          <HotbarSlot
            key={i}
            item={item}
            index={i}
            isSelected={i === selectedSlot}
            onClick={() => onSlotClick(i)}
          />
        ))}
      </div>
    </nav>
  );
}
