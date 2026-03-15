'use client';

import React from 'react';
import { getItemDefinition } from '@nookstead/shared';

interface ItemTooltipProps {
  itemType: string | null;
  /** Positioning hint for the tooltip. */
  position?: 'above' | 'beside';
}

const CATEGORY_COLORS: Record<string, string> = {
  tool: '#8B7355',
  seed: '#6B8E23',
  crop: '#228B22',
  material: '#708090',
  consumable: '#DC143C',
  gift: '#FF69B4',
  special: '#FFD700',
};

export function ItemTooltip({
  itemType,
  position = 'above',
}: ItemTooltipProps) {
  if (!itemType) return null;

  const def = getItemDefinition(itemType);

  if (!def) {
    return (
      <div className={`item-tooltip item-tooltip--${position}`}>
        <span className="item-tooltip__name">{itemType}</span>
      </div>
    );
  }

  return (
    <div
      className={`item-tooltip item-tooltip--${position}`}
      role="tooltip"
    >
      <div className="item-tooltip__name">{def.displayName}</div>
      <div
        className="item-tooltip__category"
        style={{ color: CATEGORY_COLORS[def.category] ?? '#ccc' }}
      >
        {def.category}
      </div>
      {def.description && (
        <div className="item-tooltip__description">{def.description}</div>
      )}
    </div>
  );
}
