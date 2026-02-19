'use client';

import { useRef } from 'react';
import type { CanvasBackground } from '@/lib/canvas-utils';

interface CanvasBackgroundSelectorProps {
  value: CanvasBackground;
  onChange: (bg: CanvasBackground) => void;
  className?: string;
}

interface SwatchOption {
  label: string;
  bg: CanvasBackground;
  style: React.CSSProperties;
}

const PRESETS: SwatchOption[] = [
  {
    label: 'Checkerboard',
    bg: { type: 'checkerboard' },
    style: {
      backgroundImage:
        'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
      backgroundSize: '12px 12px',
      backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
      backgroundColor: '#fff',
    },
  },
  {
    label: 'Black',
    bg: { type: 'solid', color: '#000000' },
    style: { backgroundColor: '#000000' },
  },
  {
    label: 'White',
    bg: { type: 'solid', color: '#ffffff' },
    style: { backgroundColor: '#ffffff' },
  },
  {
    label: 'Grass green',
    bg: { type: 'solid', color: '#4a7c3f' },
    style: { backgroundColor: '#4a7c3f' },
  },
];

function isSameBg(a: CanvasBackground, b: CanvasBackground): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'checkerboard') return true;
  return a.type === 'solid' && b.type === 'solid' && a.color === b.color;
}

export function CanvasBackgroundSelector({
  value,
  onChange,
  className,
}: CanvasBackgroundSelectorProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const isCustom =
    value.type === 'solid' &&
    !PRESETS.some((p) => p.bg.type === 'solid' && p.bg.color === value.color);

  const customColor = value.type === 'solid' ? value.color : '#888888';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <span className="text-sm text-muted-foreground">Background:</span>
      {PRESETS.map((preset) => {
        const active = isSameBg(value, preset.bg);
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.bg)}
            aria-label={preset.label}
            aria-pressed={active}
            className={`w-6 h-6 rounded border transition-shadow ${
              active
                ? 'ring-2 ring-primary ring-offset-1'
                : 'hover:ring-1 hover:ring-muted-foreground'
            }`}
            style={preset.style}
          />
        );
      })}
      <button
        type="button"
        onClick={() => colorInputRef.current?.click()}
        aria-label="Custom color"
        aria-pressed={isCustom}
        className={`relative w-6 h-6 rounded border transition-shadow overflow-hidden ${
          isCustom
            ? 'ring-2 ring-primary ring-offset-1'
            : 'hover:ring-1 hover:ring-muted-foreground'
        }`}
        style={{ backgroundColor: customColor }}
      >
        <input
          ref={colorInputRef}
          type="color"
          value={customColor}
          onChange={(e) =>
            onChange({ type: 'solid', color: e.target.value })
          }
          className="absolute inset-0 opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </button>
    </div>
  );
}
