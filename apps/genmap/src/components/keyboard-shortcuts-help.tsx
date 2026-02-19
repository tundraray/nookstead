'use client';

import { useState } from 'react';
import { Keyboard } from 'lucide-react';

interface ShortcutEntry {
  keys: string;
  description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: 'Ctrl+S', description: 'Save current work' },
  { keys: 'Escape', description: 'Close dialog / cancel' },
  { keys: 'Delete', description: 'Clear brush (objects)' },
  { keys: 'Drag', description: 'Select rectangle of tiles' },
  { keys: 'Shift+Drag', description: 'Add tiles to selection' },
  { keys: 'Ctrl+Drag', description: 'Remove tiles from selection' },
];

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts"
      >
        <Keyboard size={16} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Popover */}
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-popover border rounded-lg shadow-lg p-3">
            <h3 className="text-sm font-medium mb-2">Keyboard Shortcuts</h3>
            <div className="space-y-1.5">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">
                    {shortcut.description}
                  </span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono font-medium border">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
