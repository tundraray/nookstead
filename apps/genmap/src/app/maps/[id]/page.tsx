'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/breadcrumb';
import { useMapEditor } from '@/hooks/use-map-editor';
import { useTilesetImages } from '@/components/map-editor/use-tileset-images';
import { MapEditorCanvas } from '@/components/map-editor/map-editor-canvas';
import { MapEditorToolbar } from '@/components/map-editor/map-editor-toolbar';
import { TerrainPalette } from '@/components/map-editor/terrain-palette';
import { MapPropertiesPanel } from '@/components/map-editor/map-properties-panel';
import { LayerPanel } from '@/components/map-editor/layer-panel';
import type { Camera } from '@/components/map-editor/canvas-renderer';

export default function MapEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lifted camera and grid state for toolbar <-> canvas coordination
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const toggleGrid = useCallback(() => setShowGrid((prev) => !prev), []);

  const { state, dispatch, save, load } = useMapEditor();
  const { images: tilesetImages, isLoading: tilesetLoading, loadedCount, totalCount } =
    useTilesetImages();

  const fetchMap = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      await load(id);
    } catch (err) {
      if (err instanceof Error && err.message === 'Map not found') {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, load]);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isDirty]);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="flex gap-4 h-[calc(100vh-12rem)]">
          {/* Left sidebar skeleton */}
          <div className="w-[200px] flex-shrink-0 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
          {/* Center canvas skeleton */}
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-full w-full" />
          </div>
          {/* Right sidebar skeleton */}
          <div className="w-[200px] flex-shrink-0 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Map not found</p>
        <Button asChild variant="outline">
          <Link href="/maps">Back to Maps</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={fetchMap}>
          Retry
        </Button>
      </div>
    );
  }

  if (!state.mapId) return null;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Maps', href: '/maps' },
          { label: state.name || 'Untitled' },
        ]}
      />

      {/* Three-column editor layout */}
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Left sidebar: Properties and Layers */}
        <div className="w-[200px] flex-shrink-0 border rounded-lg p-3 space-y-4 overflow-y-auto">
          <div>
            <h3 className="font-semibold text-sm mb-2">Properties</h3>
            <MapPropertiesPanel state={state} dispatch={dispatch} />
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-2">Layers</h3>
            <LayerPanel state={state} dispatch={dispatch} />
          </div>
        </div>

        {/* Center: Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold">{state.name || 'Untitled'}</h1>
            <Badge variant="secondary">
              {state.width} x {state.height}
            </Badge>
            {state.mapType && (
              <Badge variant="outline">{state.mapType}</Badge>
            )}
          </div>
          <MapEditorToolbar
            state={state}
            dispatch={dispatch}
            save={save}
            camera={camera}
            onCameraChange={setCamera}
            showGrid={showGrid}
            onToggleGrid={toggleGrid}
          />
          {tilesetLoading ? (
            <div className="flex-1 bg-muted/30 border border-dashed rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Loading tilesets... ({loadedCount}/{totalCount})
              </p>
            </div>
          ) : (
            <div className="flex-1">
              <MapEditorCanvas
                state={state}
                dispatch={dispatch}
                tilesetImages={tilesetImages}
                camera={camera}
                onCameraChange={setCamera}
                showGrid={showGrid}
                onToggleGrid={toggleGrid}
              />
            </div>
          )}
        </div>

        {/* Right sidebar: Terrain palette */}
        <div className="w-[200px] flex-shrink-0 border rounded-lg p-3 overflow-y-auto">
          <h3 className="font-semibold text-sm mb-2">Terrain</h3>
          <TerrainPalette
            state={state}
            dispatch={dispatch}
            tilesetImages={tilesetImages}
          />
        </div>
      </div>
    </div>
  );
}
