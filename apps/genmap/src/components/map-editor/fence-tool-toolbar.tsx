'use client';

import { cn } from '@/lib/utils';
import type { FencePlacementMode } from './tools/fence-tool';

const MODE_CONFIG: Array<{
  mode: FencePlacementMode;
  label: string;
  description: string;
}> = [
  {
    mode: 'single',
    label: 'Single',
    description: 'Click to place one fence segment',
  },
  {
    mode: 'rectangle',
    label: 'Rectangle',
    description: 'Drag to place fence perimeter',
  },
  {
    mode: 'line',
    label: 'Line',
    description: 'Click start, click end for a straight line',
  },
];

interface FenceToolToolbarProps {
  activeMode: FencePlacementMode;
  onModeChange: (mode: FencePlacementMode) => void;
}

/**
 * Mode selector toolbar for the fence placement tool.
 *
 * Displays three mode buttons: Single, Rectangle, Line.
 * The active mode is highlighted with a ring indicator.
 */
export function FenceToolToolbar({
  activeMode,
  onModeChange,
}: FenceToolToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      {MODE_CONFIG.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onModeChange(mode)}
          title={`${label} mode`}
          className={cn(
            'px-2 py-0.5 text-[11px] rounded border transition-colors',
            activeMode === mode
              ? 'border-primary bg-primary/10 text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
