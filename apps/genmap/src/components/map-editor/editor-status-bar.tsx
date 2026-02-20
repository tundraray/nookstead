'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface EditorStatusBarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  cursorPosition: { x: number; y: number } | null;
  activeLayerName: string | null;
  saveStatus: 'unsaved' | 'dirty' | 'saving' | 'saved';
  savedAt?: Date | null;
}

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 4] as const;

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Divider() {
  return <div className="h-3 w-px bg-border mx-2" />;
}

function SaveStatusText({
  saveStatus,
  savedAt,
}: Pick<EditorStatusBarProps, 'saveStatus' | 'savedAt'>) {
  switch (saveStatus) {
    case 'unsaved':
      return <>Not yet saved</>;
    case 'dirty':
      return <>Unsaved changes</>;
    case 'saving':
      return <>Saving...</>;
    case 'saved':
      return <>{savedAt ? `Saved ${formatTime(savedAt)}` : 'Saved'}</>;
  }
}

/**
 * 24px bottom strip displaying real-time editor status: zoom level,
 * cursor coordinates, active layer name, and save status.
 *
 * Purely presentational -- all data flows in via props.
 */
export function EditorStatusBar({
  zoom,
  onZoomChange,
  cursorPosition,
  activeLayerName,
  saveStatus,
  savedAt,
}: EditorStatusBarProps) {
  return (
    <div className="flex items-center flex-shrink-0">
      {/* Static status sections (no aria-live to avoid announcing every cursor move) */}
      <div className="flex items-center h-6 px-2 border-t bg-muted text-[11px] text-muted-foreground flex-1">
        {/* Zoom section */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="tabular-nums hover:text-foreground cursor-pointer"
              aria-label={`Zoom ${Math.round(zoom * 100)}%. Click to change.`}
            >
              {Math.round(zoom * 100)}%
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-[6rem]">
            {ZOOM_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset}
                className="text-xs tabular-nums"
                onSelect={() => onZoomChange(preset)}
              >
                {Math.round(preset * 100)}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Divider />

        {/* Cursor section */}
        <span className="tabular-nums">
          {cursorPosition !== null
            ? `(${cursorPosition.x}, ${cursorPosition.y})`
            : '(--)'}
        </span>

        <Divider />

        {/* Layer section */}
        <span>Layer: {activeLayerName ?? 'No layers'}</span>

        <Divider />

        {/* Save status -- placed in its own aria-live region */}
        <span role="status" aria-label="Editor status" aria-live="polite">
          <SaveStatusText saveStatus={saveStatus} savedAt={savedAt} />
        </span>
      </div>
    </div>
  );
}
