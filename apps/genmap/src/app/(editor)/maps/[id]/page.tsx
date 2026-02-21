'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { useMapEditor } from '@/hooks/use-map-editor';
import { useTilesetImages } from '@/components/map-editor/use-tileset-images';
import { useTilesets } from '@/hooks/use-tilesets';
import { MapEditorCanvas } from '@/components/map-editor/map-editor-canvas';
import { EditorOptionsBar } from '@/components/map-editor/editor-options-bar';
import { EditorStatusBar } from '@/components/map-editor/editor-status-bar';
import { ZoneCreationDialog } from '@/components/map-editor/zone-creation-dialog';
import { EditorHeader } from '@/components/map-editor/editor-header';
import { ActivityBar } from '@/components/map-editor/activity-bar';
import { EditorSidebar } from '@/components/map-editor/editor-sidebar';
import { useZones } from '@/hooks/use-zones';
import { useZoneApi } from '@/hooks/use-zone-api';
import { SIDEBAR_TABS } from '@/hooks/map-editor-types';
import type { SidebarTab, PlacedObject } from '@/hooks/map-editor-types';
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
  const toggleWalkability = useCallback(
    () => setShowWalkability((prev) => !prev),
    []
  );

  // Cursor position state for status bar
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const { state, dispatch, save, load } = useMapEditor();
  const zoneState = useZones(state, dispatch);
  const { loadZones, saveZones, trackZoneSnapshot } = useZoneApi();

  // Sidebar tab state with localStorage persistence
  const storedTab =
    typeof window !== 'undefined'
      ? (localStorage.getItem('genmap-editor-sidebar-tab') as SidebarTab | null)
      : null;
  const [activeTab, setActiveTab] = useState<SidebarTab | null>(
    SIDEBAR_TABS.includes(storedTab as SidebarTab)
      ? (storedTab as SidebarTab)
      : null
  );

  useEffect(() => {
    if (activeTab !== null) {
      localStorage.setItem('genmap-editor-sidebar-tab', activeTab);
    } else {
      localStorage.removeItem('genmap-editor-sidebar-tab');
    }
  }, [activeTab]);

  // Keyboard shortcuts for sidebar tabs (1-6) and Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const digit = parseInt(e.key);
      if (digit >= 1 && digit <= 6) {
        const tab = SIDEBAR_TABS[digit - 1];
        setActiveTab((prev) => (prev === tab ? null : tab));
      }
      if (e.key === 'Escape') {
        if (state.activeTool === 'object-place') {
          setSelectedObjectId(null);
          dispatch({ type: 'SET_TOOL', tool: 'brush' });
        } else {
          setActiveTab(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.activeTool, dispatch]);

  // Object placement state
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const handleObjectSelect = useCallback(
    (objectId: string) => {
      setSelectedObjectId(objectId);
      dispatch({ type: 'SET_TOOL', tool: 'object-place' });
    },
    [dispatch]
  );

  const handleObjectPlace = useCallback(
    (gridX: number, gridY: number) => {
      if (!selectedObjectId) return;

      const activeLayer = state.layers[state.activeLayerIndex];
      if (
        !activeLayer ||
        (activeLayer as unknown as { type: string }).type !== 'object'
      ) {
        toast.error('Select an object layer to place objects');
        return;
      }

      const newObject: PlacedObject = {
        id: crypto.randomUUID(),
        objectId: selectedObjectId,
        objectName: '',
        gridX,
        gridY,
        rotation: 0,
        flipX: false,
        flipY: false,
      };
      dispatch({
        type: 'PLACE_OBJECT',
        layerIndex: state.activeLayerIndex,
        object: newObject,
      });
    },
    [selectedObjectId, state.layers, state.activeLayerIndex, dispatch]
  );

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
        throw new Error(
          (body as Record<string, string>).error ?? 'Failed to save template'
        );
      }
      toast.success('Saved as template');
      setShowTemplateDialog(false);
      setTemplateName('');
      setTemplateDesc('');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save template'
      );
    } finally {
      setIsSavingTemplate(false);
    }
  }, [
    state.mapId,
    state.name,
    state.mapType,
    state.width,
    state.height,
    state.grid,
    state.layers,
    state.zones,
    templateName,
    templateDesc,
  ]);

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
        throw new Error(
          (body as Record<string, string>).error ?? 'Export failed'
        );
      }
      toast.success('Map exported to player');
      setShowExportDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [state.mapId, selectedUserId]);

  // Save status tracking for EditorStatusBar
  type SaveStatus = 'unsaved' | 'dirty' | 'saving' | 'saved';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    state.mapId ? 'saved' : 'unsaved'
  );
  const [savedAt, setSavedAt] = useState<Date | null>(
    state.lastSavedAt ? new Date(state.lastSavedAt) : null
  );

  // Derive active layer name for EditorStatusBar
  const activeLayerName =
    state.layers[state.activeLayerIndex]?.name ?? null;

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await save();
      if (state.mapId) {
        const ok = await saveZones(state.mapId, state.zones);
        if (ok) {
          trackZoneSnapshot(state.zones);
        }
      }
      setSaveStatus('saved');
      setSavedAt(new Date());
    } catch {
      setSaveStatus('dirty');
    }
  }, [save, saveZones, state.mapId, state.zones, trackZoneSnapshot]);

  // Sync saveStatus with isDirty from reducer
  useEffect(() => {
    if (state.isDirty && saveStatus === 'saved') {
      setSaveStatus('dirty');
    }
  }, [state.isDirty, saveStatus]);

  const {
    images: tilesetImages,
    isLoading: tilesetLoading,
    loadedCount,
    totalCount,
  } = useTilesetImages();

  // Fetch tileset records from API for the terrain palette grouping/naming
  const { tilesets: apiTilesets } = useTilesets();

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

  // Handler for EditorHeader inline name editing
  const handleNameChange = useCallback(
    (name: string) => {
      dispatch({ type: 'SET_NAME', name });
    },
    [dispatch]
  );

  // Handler for opening the template dialog from the header
  const handleOpenTemplate = useCallback(() => {
    setTemplateName(state.name);
    setShowTemplateDialog(true);
  }, [state.name]);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="flex gap-4 h-[calc(100vh-12rem)]">
          <div className="w-[200px] flex-shrink-0 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-full w-full" />
          </div>
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
    <div
      className="editor-page flex flex-col h-screen overflow-hidden"
    >
      {/* Compact header: 36px (h-9) */}
      <EditorHeader
        mapName={state.name || 'Untitled'}
        isDirty={state.isDirty}
        onNameChange={handleNameChange}
        onExport={handleOpenExport}
        onSaveAsTemplate={handleOpenTemplate}
      />

      {/* Options Bar */}
      <EditorOptionsBar
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

      {/* Editor body: ActivityBar + Sidebar + Canvas */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} />

        <EditorSidebar
          activeTab={activeTab}
          onClose={() => setActiveTab(null)}
          state={state}
          dispatch={dispatch}
          tilesetImages={tilesetImages}
          tilesets={apiTilesets}
          zoneState={zoneState}
          onObjectSelect={handleObjectSelect}
        />

        {/* Canvas area */}
        <div className="flex-1 min-w-0 relative">
          {tilesetLoading ? (
            <div className="h-full bg-muted/30 border border-dashed rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Loading tilesets... ({loadedCount}/{totalCount})
              </p>
            </div>
          ) : (
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
              onObjectPlace={handleObjectPlace}
              onCursorMove={setCursorPosition}
              selectedObjectId={selectedObjectId}
            />
          )}
        </div>
      </div>

      {/* Status Bar */}
      <EditorStatusBar
        zoom={camera.zoom}
        onZoomChange={(z) => setCamera((prev) => ({ ...prev, zoom: z }))}
        cursorPosition={cursorPosition}
        activeLayerName={activeLayerName}
        saveStatus={saveStatus}
        savedAt={savedAt}
      />

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
            <Button onClick={handleSaveAsTemplate} disabled={isSavingTemplate}>
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
              disabled={
                !selectedUserId || isExporting || playerMaps.length === 0
              }
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
