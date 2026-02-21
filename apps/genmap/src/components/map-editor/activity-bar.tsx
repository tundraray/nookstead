'use client';

import {
  Mountain,
  Layers,
  SlidersHorizontal,
  Map,
  Frame,
  Gamepad2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SidebarTab } from '@/hooks/map-editor-types';

export interface ActivityBarProps {
  activeTab: SidebarTab | null;
  onTabChange: (tab: SidebarTab | null) => void;
}

const TAB_CONFIG: Array<{
  tab: SidebarTab;
  icon: LucideIcon;
  label: string;
  shortcut: string;
}> = [
  { tab: 'terrain', icon: Mountain, label: 'Terrain', shortcut: '1' },
  { tab: 'layers', icon: Layers, label: 'Layers', shortcut: '2' },
  {
    tab: 'properties',
    icon: SlidersHorizontal,
    label: 'Properties',
    shortcut: '3',
  },
  { tab: 'zones', icon: Map, label: 'Zones', shortcut: '4' },
  { tab: 'frames', icon: Frame, label: 'Frames', shortcut: '5' },
  {
    tab: 'game-objects',
    icon: Gamepad2,
    label: 'Game Objects',
    shortcut: '6',
  },
];

/**
 * Vertical icon strip (40px wide) with 6 sidebar tab buttons.
 *
 * Follows the VS Code Activity Bar pattern: clicking an inactive tab opens
 * the corresponding sidebar panel; clicking the already-active tab closes it.
 *
 * All state is owned by the parent -- this component is purely presentational.
 */
export function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  return (
    <TooltipProvider>
      <nav
        role="navigation"
        aria-label="Editor sidebar navigation"
        className="flex flex-col w-10 bg-muted flex-shrink-0"
      >
        {TAB_CONFIG.map(({ tab, icon: Icon, label, shortcut }) => {
          const isActive = activeTab === tab;

          return (
            <Tooltip key={tab}>
              <TooltipTrigger asChild>
                <button
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onTabChange(isActive ? null : tab)}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center relative',
                    'box-border',
                    isActive
                      ? 'border-l-2 border-primary bg-accent text-foreground'
                      : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {label} ({shortcut})
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
