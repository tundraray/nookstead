'use client';

import {
  useState,
  useRef,
  useEffect,
  memo,
  useMemo,
  type Dispatch,
} from 'react';
import type { MapEditorState, MapEditorAction } from '@nookstead/map-lib';

/**
 * Minimal tileset shape needed by the terrain palette.
 * Compatible with TilesetWithTags from useTilesets hook.
 */
export interface PaletteTileset {
  id: string;
  name: string;
  key: string;
  tags: string[];
}

/**
 * Frame index for the solid (fully-filled) autotile frame.
 * This is the frame used for palette swatch previews.
 * Previously imported as SOLID_FRAME from '@nookstead/map-lib'.
 */
const SOLID_FRAME_INDEX = 47;

/** Format a terrain name for display (capitalize each word). */
function formatTerrainName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Group tilesets by their first tag.
 * Tilesets without tags go into an 'Uncategorized' group.
 */
function groupTilesetsByTag(
  tilesets: PaletteTileset[]
): Array<{ name: string; tilesets: PaletteTileset[] }> {
  const groupMap = new Map<string, PaletteTileset[]>();

  for (const tileset of tilesets) {
    const groupName =
      tileset.tags.length > 0 ? tileset.tags[0] : 'uncategorized';
    const existing = groupMap.get(groupName);
    if (existing) {
      existing.push(tileset);
    } else {
      groupMap.set(groupName, [tileset]);
    }
  }

  return Array.from(groupMap.entries()).map(([name, items]) => ({
    name,
    tilesets: items,
  }));
}

/** Capitalize the first letter of a string. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface TerrainItemProps {
  terrainKey: string;
  displayName: string;
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
  displayName,
  isActive,
  tilesetImage,
  onClick,
}: TerrainItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw the solid frame swatch into the mini canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 24, 24);

    if (tilesetImage) {
      ctx.imageSmoothingEnabled = false;
      const srcX = (SOLID_FRAME_INDEX % 12) * 16;
      const srcY = Math.floor(SOLID_FRAME_INDEX / 12) * 16;
      ctx.drawImage(tilesetImage, srcX, srcY, 16, 16, 0, 0, 24, 24);
    } else {
      // Placeholder gray square when image is not loaded
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(0, 0, 24, 24);
    }
  }, [tilesetImage]);

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
          {formatTerrainName(displayName)}
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
  tilesets: PaletteTileset[];
}

/**
 * Terrain palette sidebar panel.
 * Lists tilesets organized into collapsible groups by tag.
 * Clicking a terrain dispatches SET_TERRAIN to make it the active paint terrain.
 */
export function TerrainPalette({
  state,
  dispatch,
  tilesetImages,
  tilesets,
}: TerrainPaletteProps) {
  const groups = useMemo(() => groupTilesetsByTag(tilesets), [tilesets]);

  // All groups open by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.name))
  );

  // Update open groups when groups change (new tilesets loaded)
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        next.add(g.name);
      }
      return next;
    });
  }, [groups]);

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        tilesets: group.tilesets.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.key.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.tilesets.length > 0);
  }, [groups, searchQuery]);

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

  if (tilesets.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading tilesets...
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Search input */}
      <div className="pb-1">
        <input
          type="text"
          placeholder="Filter tilesets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {filteredGroups.map((group) => {
        const isOpen = openGroups.has(group.name);
        return (
          <div key={group.name}>
            <button
              type="button"
              onClick={() => toggleGroup(group.name)}
              className="flex items-center justify-between w-full px-1 py-1 text-xs font-semibold hover:bg-accent rounded transition-colors"
            >
              <span>
                {capitalize(group.name)} ({group.tilesets.length})
              </span>
              <span className="text-muted-foreground">
                {isOpen ? '\u25B4' : '\u25BE'}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-0.5 ml-1">
                {group.tilesets.map((tileset) => (
                  <TerrainItem
                    key={tileset.key}
                    terrainKey={tileset.key}
                    displayName={tileset.name}
                    isActive={state.activeTerrainKey === tileset.key}
                    tilesetImage={tilesetImages.get(tileset.key)}
                    onClick={() => handleSelectTerrain(tileset.key)}
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
