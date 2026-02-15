'use client';

import { useEffect } from 'react';
import { SHORTCUT_MAP } from './constants';
import type { PanelId } from '@/components/hud/types';

function isTextInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['button', 'submit', 'reset', 'checkbox', 'radio'].includes(type);
  }
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(
  togglePanel: (panelId: PanelId) => void,
  closePanel: () => void,
  activePanel: PanelId | null,
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (isTextInput(e.target)) return;

      const panelId = SHORTCUT_MAP[e.code];
      if (panelId) {
        e.preventDefault();
        if (e.code === 'Escape' && activePanel) {
          closePanel();
        } else if (e.code === 'Escape') {
          togglePanel('settings');
        } else {
          togglePanel(panelId);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePanel, closePanel, activePanel]);
}
