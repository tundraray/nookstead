'use client';

import { useState, useEffect } from 'react';
import { EventBus } from '@/game/EventBus';
import { Hotbar } from './Hotbar';
import { GameModal } from './GameModal';
import { MenuButton } from './MenuButton';
import type { HUDState } from './types';

interface HUDProps {
  uiScale: number;
}

const DEFAULT_HUD_STATE: Omit<HUDState, 'day' | 'time' | 'season' | 'gold'> = {
  hotbarItems: Array(10).fill(null),
  selectedSlot: 0,
};

export function HUD({ uiScale }: HUDProps) {
  const [hotbarItems] = useState(DEFAULT_HUD_STATE.hotbarItems);
  const [selectedSlot, setSelectedSlot] = useState(DEFAULT_HUD_STATE.selectedSlot);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Keyboard: hotbar slot selection (1-0)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const match = e.code.match(/^Digit(\d)$/);
      if (match) {
        const digit = parseInt(match[1], 10);
        const slot = digit === 0 ? 9 : digit - 1;
        setSelectedSlot(slot);
        EventBus.emit('hud:select-slot', slot);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className="hud"
      style={{ '--ui-scale': uiScale } as React.CSSProperties}
      role="region"
      aria-label="Game heads-up display"
    >
      <MenuButton onClick={() => setSettingsOpen(true)} />
      <Hotbar
        items={hotbarItems}
        selectedSlot={selectedSlot}
        onSlotClick={(i) => {
          setSelectedSlot(i);
          EventBus.emit('hud:select-slot', i);
        }}
      />
      <GameModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Settings"
      >
        <p>Settings content goes here</p>
      </GameModal>
    </div>
  );
}
