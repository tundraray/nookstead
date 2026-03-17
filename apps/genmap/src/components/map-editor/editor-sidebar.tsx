'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type Dispatch,
} from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MapEditorState, MapEditorAction, SidebarTab } from '@nookstead/map-lib';
import type { UseZonesReturn } from '@/hooks/use-zones';
import { TerrainPalette } from './terrain-palette';
import { LayerPanel } from './layer-panel';
import { MapPropertiesPanel } from './map-properties-panel';
import { ZonePanel } from './zone-panel';
import { FramesPanel } from './frames-panel';
import { GameObjectsPanel } from './game-objects-panel';
import { InteractionsPanel } from './interactions-panel';

/** Human-readable labels for each sidebar tab. */
const TAB_LABELS: Record<SidebarTab, string> = {
  terrain: 'Terrain',
  layers: 'Layers',
  properties: 'Properties',
  zones: 'Zones',
  frames: 'Frames',
  'game-objects': 'Game Objects',
  interactions: 'Interactions',
};

/** Sidebar width in pixels when open. */
const SIDEBAR_WIDTH = 280;

/** Duration of width transition in milliseconds. */
const WIDTH_TRANSITION_MS = 200;

/** Duration of content opacity fade in milliseconds. */
const OPACITY_TRANSITION_MS = 100;

export interface EditorSidebarProps {
  activeTab: SidebarTab | null;
  onClose: () => void;
  state: MapEditorState;
  dispatch: Dispatch<MapEditorAction>;
  tilesetImages: Map<string, HTMLImageElement>;
  zoneState: UseZonesReturn;
  onObjectSelect: (objectId: string) => void;
}

/**
 * Hook to preserve scroll position per sidebar tab.
 *
 * Saves the current scrollTop when switching away from a tab and
 * restores the saved scrollTop when switching back.
 */
function useScrollPreservation(
  activeTab: SidebarTab | null,
  contentRef: React.RefObject<HTMLDivElement | null>
) {
  const scrollPositions = useRef<Map<SidebarTab, number>>(new Map());
  const previousTab = useRef<SidebarTab | null>(null);

  useEffect(() => {
    const prevTab = previousTab.current;

    // Save outgoing tab scroll position
    if (prevTab !== null && contentRef.current) {
      scrollPositions.current.set(prevTab, contentRef.current.scrollTop);
    }

    // Restore incoming tab scroll position
    if (activeTab !== null) {
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const saved = scrollPositions.current.get(activeTab) ?? 0;
          contentRef.current.scrollTop = saved;
        }
      });
    }

    previousTab.current = activeTab;
  }, [activeTab, contentRef]);

  const handleScroll = useCallback(() => {
    if (activeTab !== null && contentRef.current) {
      scrollPositions.current.set(activeTab, contentRef.current.scrollTop);
    }
  }, [activeTab, contentRef]);

  return handleScroll;
}

/**
 * Animated-width sidebar container that renders the active panel.
 *
 * Sits between the ActivityBar and the canvas area. When `activeTab`
 * is non-null the sidebar expands to 280px and renders the matching
 * panel component; when null, it collapses to 0px.
 */
export function EditorSidebar({
  activeTab,
  onClose,
  state,
  dispatch,
  tilesetImages,
  zoneState,
  onObjectSelect,
}: EditorSidebarProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentVisible, setContentVisible] = useState(activeTab !== null);
  const reducedMotion = useReducedMotion();

  const handleScroll = useScrollPreservation(activeTab, contentRef);

  // Content opacity fade on tab switch
  useEffect(() => {
    if (activeTab === null) {
      setContentVisible(false);
      return;
    }

    // Trigger a repaint cycle: set invisible, then visible on next frame
    setContentVisible(false);
    const frameId = requestAnimationFrame(() => {
      setContentVisible(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [activeTab]);

  const isOpen = activeTab !== null;

  const widthTransition = reducedMotion
    ? 'none'
    : `width ${WIDTH_TRANSITION_MS}ms ease-in-out`;

  const opacityTransition = reducedMotion
    ? 'none'
    : `opacity ${OPACITY_TRANSITION_MS}ms ease-in-out`;

  function renderPanel(): React.ReactNode {
    switch (activeTab) {
      case 'terrain':
        return (
          <TerrainPalette
            state={state}
            dispatch={dispatch}
            tilesetImages={tilesetImages}
          />
        );
      case 'layers':
        return <LayerPanel state={state} dispatch={dispatch} />;
      case 'properties':
        return <MapPropertiesPanel state={state} dispatch={dispatch} />;
      case 'zones':
        return <ZonePanel zoneState={zoneState} />;
      case 'frames':
        return <FramesPanel />;
      case 'game-objects':
        return <GameObjectsPanel onObjectSelect={onObjectSelect} />;
      case 'interactions':
        return <InteractionsPanel state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  }

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        width: isOpen ? SIDEBAR_WIDTH : 0,
        transition: widthTransition,
        borderRight: isOpen ? '1px solid var(--border)' : 'none',
      }}
    >
      {activeTab !== null && (
        <>
          {/* Panel header */}
          <div className="h-7 flex items-center justify-between px-2 border-b flex-shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {TAB_LABELS[activeTab]}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onClose}
            >
              <X size={14} />
            </Button>
          </div>

          {/* Scrollable panel content */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto p-2"
            onScroll={handleScroll}
            style={{
              opacity: contentVisible ? 1 : 0,
              transition: opacityTransition,
            }}
          >
            {renderPanel()}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Returns true when the user prefers reduced motion.
 * Listens for changes to the `prefers-reduced-motion` media query.
 */
function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);

    function handleChange(e: MediaQueryListEvent) {
      setReducedMotion(e.matches);
    }

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
}
