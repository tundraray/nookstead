'use client';

import { spriteCSSStyle } from './sprite';
import { SLOT_NORMAL, SLOT_SELECTED } from './sprites';
import { NineSlicePanel } from './NineSlicePanel';
import type { HotbarItem } from './types';

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
    <div className="hotbar-slot">
      <span className="hotbar-slot__key-hint" aria-hidden="true">
        {keyLabel}
      </span>
      <button
        className="hotbar-slot__button"
        onClick={onClick}
        aria-label={`Slot ${keyLabel}${item ? `: ${item.id}` : ': empty'}`}
        aria-pressed={isSelected}
        data-interactive="true"
      >
        <NineSlicePanel
          slices={isSelected ? SLOT_SELECTED : SLOT_NORMAL}
          className="hotbar-slot__background"
        >
          <div className="hotbar-slot__content">
            {item && (
              <div
                className="hotbar-slot__item-icon"
                style={spriteCSSStyle(...item.spriteRect)}
                aria-hidden="true"
              />
            )}
            {item && item.quantity > 1 && (
              <span className="hotbar-slot__quantity">
                {item.quantity > 99 ? '99+' : item.quantity}
              </span>
            )}
          </div>
        </NineSlicePanel>
      </button>
    </div>
  );
}
