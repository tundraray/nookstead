'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventBus } from '@/game/EventBus';
import type { HeaderState, PanelId, Season } from '@/components/hud/types';

const DEFAULT_HEADER_STATE: HeaderState = {
  day: 1,
  time: '08:00',
  season: 'spring',
  gold: 0,
  activePanel: null,
};

export function useHeaderState() {
  const [state, setState] = useState<HeaderState>(DEFAULT_HEADER_STATE);

  useEffect(() => {
    const onTime = (day: number, time: string, season: string) =>
      setState((s) => ({ ...s, day, time, season: season as Season }));
    const onGold = (gold: number) => setState((s) => ({ ...s, gold }));

    EventBus.on('hud:time', onTime);
    EventBus.on('hud:gold', onGold);
    return () => {
      EventBus.removeListener('hud:time', onTime);
      EventBus.removeListener('hud:gold', onGold);
    };
  }, []);

  const togglePanel = useCallback((panelId: PanelId) => {
    setState((s) => {
      const newPanel = s.activePanel === panelId ? null : panelId;
      if (newPanel) {
        EventBus.emit(`hud:open-panel:${newPanel}`);
      } else {
        EventBus.emit('hud:close-panel');
      }
      return { ...s, activePanel: newPanel };
    });
  }, []);

  const closePanel = useCallback(() => {
    setState((s) => {
      if (s.activePanel) {
        EventBus.emit('hud:close-panel');
      }
      return { ...s, activePanel: null };
    });
  }, []);

  return { state, togglePanel, closePanel };
}
