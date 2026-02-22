'use client';

import {
  useState,
  useRef,
  useEffect,
  memo,
  useMemo,
  type Dispatch,
} from 'react';
import {
  SOLID_FRAME, FRAMES_PER_TERRAIN,
  type MapEditorState, type MapEditorAction, type MaterialInfo,
} from '@nookstead/map-lib';

/** Tileset layout: 12 cols x 4 rows = 48 frames. */
const TILESET_COLS = FRAMES_PER_TERRAIN / 4;

/** Format a material name for display (capitalize each word). */
function formatMaterialName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface MaterialItemProps {
  materialKey: string;
  displayName: string;
  color: string;
  isActive: boolean;
  tilesetImage: HTMLImageElement | undefined;
  onClick: () => void;
}

/**
 * A single material item with a canvas swatch preview and name.
 * Memoized to avoid re-renders when other materials change.
 */
const MaterialItem = memo(function MaterialItem({
  materialKey,
  displayName,
  color,
  isActive,
  tilesetImage,
  onClick,
}: MaterialItemProps) {
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
      const srcX = (SOLID_FRAME % TILESET_COLS) * 16;
      const srcY = Math.floor(SOLID_FRAME / TILESET_COLS) * 16;
      ctx.drawImage(tilesetImage, srcX, srcY, 16, 16, 0, 0, 24, 24);
    } else {
      // Use material color as swatch fallback
      ctx.fillStyle = color || '#4a5568';
      ctx.fillRect(0, 0, 24, 24);
    }
  }, [tilesetImage, color]);

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
          {formatMaterialName(displayName)}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {materialKey}
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
 * Material palette sidebar panel.
 * Lists materials from state.materials with swatch previews via baseTilesetKey.
 * Clicking a material dispatches SET_MATERIAL to make it the active paint material.
 */
export function TerrainPalette({
  state,
  dispatch,
  tilesetImages,
}: TerrainPaletteProps) {
  // Build sorted materials list from state.materials
  const materialList = useMemo(() => {
    const list: MaterialInfo[] = [];
    for (const mat of state.materials.values()) {
      list.push(mat);
    }
    // Sort by renderPriority ascending, then by key
    list.sort((a, b) => a.renderPriority - b.renderPriority || a.key.localeCompare(b.key));
    return list;
  }, [state.materials]);

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return materialList;
    const query = searchQuery.toLowerCase();
    return materialList.filter(
      (m) => m.key.toLowerCase().includes(query)
    );
  }, [materialList, searchQuery]);

  function handleSelectMaterial(materialKey: string) {
    dispatch({ type: 'SET_MATERIAL', materialKey });
  }

  if (state.materials.size === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading materials...
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Search input */}
      <div className="pb-1">
        <input
          type="text"
          placeholder="Filter materials..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="space-y-0.5">
        {filteredMaterials.map((material) => (
          <MaterialItem
            key={material.key}
            materialKey={material.key}
            displayName={material.key}
            color={material.color}
            isActive={state.activeMaterialKey === material.key}
            tilesetImage={
              material.baseTilesetKey
                ? tilesetImages.get(material.baseTilesetKey)
                : undefined
            }
            onClick={() => handleSelectMaterial(material.key)}
          />
        ))}
      </div>
    </div>
  );
}
