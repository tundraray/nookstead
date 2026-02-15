'use client';

import { useState, useEffect } from 'react';
import { Press_Start_2P } from 'next/font/google';
import { EventBus } from '@/game/EventBus';
import { Hotbar } from './Hotbar';
import { GameModal } from './GameModal';
import { MenuButton } from './MenuButton';
import { DEFAULT_HUD_STATE } from './types';
import type { HUDState, Season } from './types';

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixel',
});

export function HUD() {
  const [state, setState] = useState<HUDState>(DEFAULT_HUD_STATE);
  const [uiScale, setUiScale] = useState(3);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Compute integer scale from viewport
  useEffect(() => {
    function updateScale() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scaleX = Math.floor(vw / 480);
      const scaleY = Math.floor(vh / 270);
      setUiScale(Math.max(2, Math.min(6, Math.min(scaleX, scaleY))));
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // EventBus subscriptions (Phaser -> React)
  useEffect(() => {
    const onTime = (day: number, time: string, season: string) =>
      setState((s) => ({ ...s, day, time, season: season as Season }));
    const onGold = (gold: number) => setState((s) => ({ ...s, gold }));
    const onEnergy = (energy: number, maxEnergy: number) =>
      setState((s) => ({ ...s, energy, maxEnergy }));

    EventBus.on('hud:time', onTime);
    EventBus.on('hud:gold', onGold);
    EventBus.on('hud:energy', onEnergy);
    return () => {
      EventBus.removeListener('hud:time', onTime);
      EventBus.removeListener('hud:gold', onGold);
      EventBus.removeListener('hud:energy', onEnergy);
    };
  }, []);

  // Keyboard: hotbar slot selection (1-0)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const match = e.code.match(/^Digit(\d)$/);
      if (match) {
        const digit = parseInt(match[1], 10);
        const slot = digit === 0 ? 9 : digit - 1;
        setState((s) => ({ ...s, selectedSlot: slot }));
        EventBus.emit('hud:select-slot', slot);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className={`hud ${pixelFont.variable}`}
      style={{ '--ui-scale': uiScale } as React.CSSProperties}
      role="region"
      aria-label="Game heads-up display"
    >
      <Hotbar
        items={state.hotbarItems}
        selectedSlot={state.selectedSlot}
        onSlotClick={(i) => {
          setState((s) => ({ ...s, selectedSlot: i }));
          EventBus.emit('hud:select-slot', i);
        }}
      />
      <MenuButton onClick={() => setSettingsOpen(true)} />
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
