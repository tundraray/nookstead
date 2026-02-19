'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutHandlers {
  /** Called on Ctrl+S / Cmd+S. Prevents default browser save. */
  onSave?: () => void;
  /** Called on Escape key. Used to close dialogs or cancel operations. */
  onEscape?: () => void;
  /** Called on Delete or Backspace key. Used to clear selected cell. */
  onDelete?: () => void;
}

/**
 * Hook that registers global keyboard shortcuts for the sprite management app.
 *
 * Shortcuts:
 * - Ctrl+S / Cmd+S: Save current tile map or object
 * - Escape: Close dialogs, cancel current operation
 * - Delete / Backspace: Clear selected cell on object grid
 *
 * All handlers are optional. The hook cleans up event listeners on unmount.
 * Shortcuts are suppressed when the active element is an input, textarea,
 * or select to avoid interfering with normal text editing.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const { onSave, onEscape, onDelete } = handlers;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Ctrl+S / Cmd+S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Escape: Close dialog / cancel
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      // Delete / Backspace: Clear selected cell (only when not in input)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        onDelete?.();
        return;
      }
    },
    [onSave, onEscape, onDelete]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
