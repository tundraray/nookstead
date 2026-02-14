'use client';

import type { ReactNode } from 'react';
import { spriteNativeStyle, spriteStretchStyle } from './sprite';
import { PANEL_DEFAULT } from './sprites';
import type { NineSliceSet } from './types';

interface NineSlicePanelProps {
  children: ReactNode;
  slices?: NineSliceSet;
  className?: string;
}

export function NineSlicePanel({
  children,
  slices = PANEL_DEFAULT,
  className,
}: NineSlicePanelProps) {
  return (
    <div className={`nine-slice ${className ?? ''}`}>
      {/* Row 1: TL corner | Top edge (stretch) | TR corner */}
      <div
        className="nine-slice__cell"
        style={{ gridColumn: 1, gridRow: 1, ...spriteNativeStyle(...slices.cornerTL) }}
        aria-hidden="true"
      />
      <div
        className="nine-slice__cell nine-slice__edge"
        style={{ gridColumn: 2, gridRow: 1, ...spriteStretchStyle(...slices.edgeT) }}
        aria-hidden="true"
      />
      <div
        className="nine-slice__cell"
        style={{ gridColumn: 3, gridRow: 1, ...spriteNativeStyle(...slices.cornerTR) }}
        aria-hidden="true"
      />
      {/* Row 2: Left edge (stretch) | Center (stretch) | Right edge (stretch) */}
      <div
        className="nine-slice__cell nine-slice__edge"
        style={{ gridColumn: 1, gridRow: 2, ...spriteStretchStyle(...slices.edgeL) }}
        aria-hidden="true"
      />
      <div
        className="nine-slice__cell nine-slice__edge"
        style={{ gridColumn: 2, gridRow: 2, ...spriteStretchStyle(...slices.center) }}
        aria-hidden="true"
      />
      <div
        className="nine-slice__cell nine-slice__edge"
        style={{ gridColumn: 3, gridRow: 2, ...spriteStretchStyle(...slices.edgeR) }}
        aria-hidden="true"
      />
      {/* Row 3: BL corner | Bottom edge (stretch) | BR corner */}
      <div
        className="nine-slice__cell"
        style={{ gridColumn: 1, gridRow: 3, ...spriteNativeStyle(...slices.cornerBL) }}
        aria-hidden="true"
      />
      <div
        className="nine-slice__cell nine-slice__edge"
        style={{ gridColumn: 2, gridRow: 3, ...spriteStretchStyle(...slices.edgeB) }}
        aria-hidden="true"
      />
      <div
        className="nine-slice__cell"
        style={{ gridColumn: 3, gridRow: 3, ...spriteNativeStyle(...slices.cornerBR) }}
        aria-hidden="true"
      />
      {/* Content overlay in center cell */}
      <div className="nine-slice__content">{children}</div>
    </div>
  );
}
