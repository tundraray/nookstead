'use client';

import { useState, useEffect } from 'react';
import { EventBus } from '@/game/EventBus';
import { EnergyBar } from './EnergyBar';
import { Hotbar } from './Hotbar';
import type { HUDState } from './types';

interface HUDProps {
  uiScale: number;
}

const DEFAULT_HUD_STATE: Omit<HUDState, 'day' | 'time' | 'season' | 'gold'> = {
  energy: 100,
  maxEnergy: 100,
  hotbarItems: Array(10).fill(null),
  selectedSlot: 0,
};

export function HUD({ uiScale }: HUDProps) {
  const [energy, setEnergy] = useState(DEFAULT_HUD_STATE.energy);
  const [maxEnergy, setMaxEnergy] = useState(DEFAULT_HUD_STATE.maxEnergy);
  const [hotbarItems] = useState(DEFAULT_HUD_STATE.hotbarItems);
  const [selectedSlot, setSelectedSlot] = useState(DEFAULT_HUD_STATE.selectedSlot);

  // EventBus: energy updates from Phaser
  useEffect(() => {
    const onEnergy = (e: number, max: number) => {
      setEnergy(e);
      setMaxEnergy(max);
    };

    EventBus.on('hud:energy', onEnergy);
    return () => {
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
      <EnergyBar energy={energy} maxEnergy={maxEnergy} />
      <Hotbar
        items={hotbarItems}
        selectedSlot={selectedSlot}
        onSlotClick={(i) => {
          setSelectedSlot(i);
          EventBus.emit('hud:select-slot', i);
        }}
      />
    </div>
  );
}
