'use client';

import {
  useState,
  useRef,
  useEffect,
  memo,
  type Dispatch,
} from 'react';
import {
  TERRAINS,
  TILESETS,
  SOLID_FRAME,
} from '@nookstead/map-lib';
import type { TerrainType } from '@nookstead/map-lib';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';

/**
 * Terrain groups derived from TILESETS. Each group has a display name
 * and a list of terrain keys that belong to it.
 */
const TERRAIN_GROUPS: Array<{ name: string; keys: string[] }> = [
  {
    name: 'Grassland',
    keys: Object.values(TILESETS.grassland)
      .filter((v): v is TerrainType => typeof v !== 'string')
      .map((t) => t.key),
  },
  {
    name: 'Water',
    keys: Object.values(TILESETS.water)
      .filter((v): v is TerrainType => typeof v !== 'string')
      .map((t) => t.key),
  },
  {
    name: 'Sand',
    keys: Object.values(TILESETS.sand)
      .filter((v): v is TerrainType => typeof v !== 'string')
      .map((t) => t.key),
  },
  {
    name: 'Forest',
    keys: Object.values(TILESETS.forest)
      .filter((v): v is TerrainType => typeof v !== 'string')
      .map((t) => t.key),
  },
  {
    name: 'Stone',
    keys: Object.values(TILESETS.stone)
      .filter((v): v is TerrainType => typeof v !== 'string')
      .map((t) => t.key),
  },
  {
    name: 'Road',
    keys: Object.values(TILESETS.road)
      .filter((v): v is TerrainType => typeof v !== 'string')
      .map((t) => t.key),
  },
  {
    name: 'Props',
    keys: Object.values(TILESETS.props)
      .filter((v): v is TerrainType => typeof v !== 'string')
      .map((t) => t.key),
  },
  {
    name: 'Misc',
    keys: Object.values(TILESETS.misc)
      .filter((v): v is TerrainType => typeof v !== 'string')
      .map((t) => t.key),
  },
];

/** Build a lookup from terrain key to terrain name. */
const TERRAIN_NAME_MAP = new Map<string, string>(
  TERRAINS.map((t) => [t.key, t.name])
);

/** Format a terrain name for display. */
function formatTerrainName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface TerrainItemProps {
  terrainKey: string;
  isActive: boolean;
  tilesetImage: HTMLImageElement | undefined;
  onClick: () => void;
}

/**
 * A single terrain item with a canvas swatch preview and name.
 * Memoized to avoid re-renders when other terrains change.
 */
const TerrainItem = memo(function TerrainItem({
  terrainKey,
  isActive,
  tilesetImage,
  onClick,
}: TerrainItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw the SOLID_FRAME swatch into the mini canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 24, 24);

    if (tilesetImage) {
      ctx.imageSmoothingEnabled = false;
      const srcX = (SOLID_FRAME % 12) * 16;
      const srcY = Math.floor(SOLID_FRAME / 12) * 16;
      ctx.drawImage(tilesetImage, srcX, srcY, 16, 16, 0, 0, 24, 24);
    } else {
      // Placeholder gray square when image is not loaded
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(0, 0, 24, 24);
    }
  }, [tilesetImage]);

  const terrainName =
    TERRAIN_NAME_MAP.get(terrainKey) ?? terrainKey;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-2 py-1 rounded text-left hover:bg-accent transition-colors ${
        isActive ? 'ring-2 ring-primary bg-accent' : ''
      }`}
    >
      <canvas
        ref={canvasRef}
        width={24}
        height={24}
        className="flex-shrink-0 rounded border border-border"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">
          {formatTerrainName(terrainName)}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {terrainKey}
        </div>
      </div>
    </button>
  );
});

interface TerrainPaletteProps {
  state: MapEditorState;
  dispatch: Dispatch<MapEditorAction>;
  tilesetImages: Map<string, HTMLImageElement>;
}

/**
 * Terrain palette sidebar panel.
 * Lists all 26 terrain types organized into 8 collapsible groups.
 * Clicking a terrain dispatches SET_TERRAIN to make it the active paint terrain.
 */
export function TerrainPalette({
  state,
  dispatch,
  tilesetImages,
}: TerrainPaletteProps) {
  // All groups open by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(TERRAIN_GROUPS.map((g) => g.name))
  );

  function toggleGroup(groupName: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  function handleSelectTerrain(terrainKey: string) {
    dispatch({ type: 'SET_TERRAIN', terrainKey });
  }

  return (
    <div className="space-y-1">
      {TERRAIN_GROUPS.map((group) => {
        const isOpen = openGroups.has(group.name);
        return (
          <div key={group.name}>
            <button
              type="button"
              onClick={() => toggleGroup(group.name)}
              className="flex items-center justify-between w-full px-1 py-1 text-xs font-semibold hover:bg-accent rounded transition-colors"
            >
              <span>
                {group.name} ({group.keys.length})
              </span>
              <span className="text-muted-foreground">
                {isOpen ? '\u25B4' : '\u25BE'}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-0.5 ml-1">
                {group.keys.map((key) => (
                  <TerrainItem
                    key={key}
                    terrainKey={key}
                    isActive={state.activeTerrainKey === key}
                    tilesetImage={tilesetImages.get(key)}
                    onClick={() => handleSelectTerrain(key)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
