'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Breadcrumb } from '@/components/breadcrumb';
import { useMapEditor } from '@/hooks/use-map-editor';
import { useTilesetImages } from '@/components/map-editor/use-tileset-images';
import { MapEditorCanvas } from '@/components/map-editor/map-editor-canvas';
import { MapEditorToolbar } from '@/components/map-editor/map-editor-toolbar';
import { TerrainPalette } from '@/components/map-editor/terrain-palette';
import { MapPropertiesPanel } from '@/components/map-editor/map-properties-panel';
import { LayerPanel } from '@/components/map-editor/layer-panel';
import { ZonePanel } from '@/components/map-editor/zone-panel';
import { ZoneCreationDialog } from '@/components/map-editor/zone-creation-dialog';
import { useZones } from '@/hooks/use-zones';
import { useZoneApi } from '@/hooks/use-zone-api';
import type { Camera } from '@/components/map-editor/canvas-renderer';
import type { ZoneBounds, ZoneVertex, ZoneType } from '@nookstead/map-lib';

export default function MapEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lifted camera and grid state for toolbar <-> canvas coordination
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const toggleGrid = useCallback(() => setShowGrid((prev) => !prev), []);
  const [showWalkability, setShowWalkability] = useState(false);
  const toggleWalkability = useCallback(() => setShowWalkability((prev) => !prev), []);

  const { state, dispatch, save, load } = useMapEditor();
  const zoneState = useZones(state, dispatch);
  const { loadZones, saveZones, trackZoneSnapshot } = useZoneApi();

  // Zone creation dialog state
  const [pendingZone, setPendingZone] = useState<{
    bounds?: ZoneBounds;
    vertices?: ZoneVertex[];
  } | null>(null);

  const handleZoneRectComplete = useCallback((bounds: ZoneBounds) => {
    setPendingZone({ bounds });
  }, []);

  const handleZonePolyComplete = useCallback((vertices: ZoneVertex[]) => {
    setPendingZone({ vertices });
  }, []);

  const handleZoneCreate = useCallback(
    (name: string, zoneType: ZoneType) => {
      if (!pendingZone) return;
      const zone = {
        id: crypto.randomUUID(),
        name,
        zoneType,
        shape: (pendingZone.bounds ? 'rectangle' : 'polygon') as
          | 'rectangle'
          | 'polygon',
        bounds: pendingZone.bounds,
        vertices: pendingZone.vertices,
        properties: {},
        zIndex: state.zones.length,
      };
      zoneState.addZone(zone);
      setPendingZone(null);
    },
    [pendingZone, state.zones.length, zoneState]
  );

  const handleZoneCreateCancel = useCallback(() => {
    setPendingZone(null);
  }, []);

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [playerMaps, setPlayerMaps] = useState<
    Array<{ userId: string; userName: string | null; userEmail: string }>
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const handleOpenExport = useCallback(async () => {
    setShowExportDialog(true);
    try {
      const res = await fetch('/api/player-maps');
      if (res.ok) {
        const data = await res.json();
        setPlayerMaps(data);
        if (data.length > 0) setSelectedUserId(data[0].userId);
      }
    } catch {
      toast.error('Failed to load player maps');
    }
  }, []);

  // Save as template
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!state.mapId) return;
    setIsSavingTemplate(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName || state.name,
          description: templateDesc || undefined,
          mapType: state.mapType || 'player_homestead',
          baseWidth: state.width,
          baseHeight: state.height,
          grid: state.grid,
          layers: state.layers,
          zones: state.zones.length > 0 ? state.zones : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error ?? 'Failed to save template');
      }
      toast.success('Saved as template');
      setShowTemplateDialog(false);
      setTemplateName('');
      setTemplateDesc('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  }, [state.mapId, state.name, state.mapType, state.width, state.height, state.grid, state.layers, state.zones, templateName, templateDesc]);

  const handleExport = useCallback(async () => {
    if (!state.mapId || !selectedUserId) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/editor-maps/${state.mapId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error ?? 'Export failed');
      }
      toast.success('Map exported to player');
      setShowExportDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [state.mapId, selectedUserId]);

  const handleSave = useCallback(async () => {
    await save();
    if (state.mapId) {
      const ok = await saveZones(state.mapId, state.zones);
      if (ok) {
        trackZoneSnapshot(state.zones);
      }
    }
  }, [save, saveZones, state.mapId, state.zones, trackZoneSnapshot]);
  const { images: tilesetImages, isLoading: tilesetLoading, loadedCount, totalCount } =
    useTilesetImages();

  const fetchMap = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      await load(id);
      const zones = await loadZones(id);
      dispatch({ type: 'SET_ZONES', zones });
      trackZoneSnapshot(zones);
    } catch (err) {
      if (err instanceof Error && err.message === 'Map not found') {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, load, loadZones, dispatch, trackZoneSnapshot]);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  // Override Ctrl+S to save both map and zones (capture phase to preempt hook handler)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleSave]);

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
          <div>
            <h3 className="font-semibold text-sm mb-2">Zones</h3>
            <ZonePanel zoneState={zoneState} />
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
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setTemplateName(state.name);
                  setShowTemplateDialog(true);
                }}
              >
                Save as Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleOpenExport}
              >
                Export to Player
              </Button>
            </div>
          </div>
          <MapEditorToolbar
            state={state}
            dispatch={dispatch}
            save={handleSave}
            camera={camera}
            onCameraChange={setCamera}
            showGrid={showGrid}
            onToggleGrid={toggleGrid}
            showWalkability={showWalkability}
            onToggleWalkability={toggleWalkability}
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
                onZoneRectComplete={handleZoneRectComplete}
                onZonePolyComplete={handleZonePolyComplete}
                zones={zoneState.zones}
                selectedZoneId={zoneState.selectedZoneId}
                zoneVisibility={zoneState.zoneVisibility}
                showWalkability={showWalkability}
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

      {/* Zone creation dialog */}
      <ZoneCreationDialog
        open={pendingZone !== null}
        onConfirm={handleZoneCreate}
        onCancel={handleZoneCreateCancel}
      />

      {/* Save as template dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save the current map state as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Template Name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Description (optional)</Label>
              <Input
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Short description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTemplateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={isSavingTemplate}
            >
              {isSavingTemplate ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export to player dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export to Player Map</DialogTitle>
            <DialogDescription>
              Export this editor map to a player&apos;s homestead. This will
              overwrite the player&apos;s existing map data.
            </DialogDescription>
          </DialogHeader>
          {playerMaps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No player maps found. Players need to have generated a map first.
            </p>
          ) : (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Target Player</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    {playerMaps.map((pm) => (
                      <SelectItem key={pm.userId} value={pm.userId}>
                        {pm.userName || pm.userEmail}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={!selectedUserId || isExporting || playerMaps.length === 0}
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
