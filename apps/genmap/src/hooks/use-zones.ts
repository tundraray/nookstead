'use client';

import { useCallback, useState } from 'react';
import type { ZoneData, ZoneVertex } from '@nookstead/map-lib';
import type { MapEditorState, MapEditorAction } from './map-editor-types';

export interface UseZonesReturn {
  zones: ZoneData[];
  selectedZoneId: string | null;
  zoneVisibility: boolean;
  isDrawing: boolean;
  drawingVertices: ZoneVertex[];
  addZone: (zone: ZoneData) => void;
  updateZone: (zoneId: string, data: Partial<ZoneData>) => void;
  deleteZone: (zoneId: string) => void;
  selectZone: (zoneId: string | null) => void;
  toggleZoneVisibility: () => void;
  startDrawing: () => void;
  addVertex: (vertex: ZoneVertex) => void;
  cancelDrawing: () => void;
}

export function useZones(
  state: MapEditorState,
  dispatch: React.Dispatch<MapEditorAction>
): UseZonesReturn {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingVertices, setDrawingVertices] = useState<ZoneVertex[]>([]);

  const addZone = useCallback(
    (zone: ZoneData) => {
      dispatch({ type: 'ADD_ZONE', zone });
    },
    [dispatch]
  );

  const updateZone = useCallback(
    (zoneId: string, data: Partial<ZoneData>) => {
      dispatch({ type: 'UPDATE_ZONE', zoneId, data });
    },
    [dispatch]
  );

  const deleteZone = useCallback(
    (zoneId: string) => {
      dispatch({ type: 'DELETE_ZONE', zoneId });
      setSelectedZoneId((prev) => (prev === zoneId ? null : prev));
    },
    [dispatch]
  );

  const selectZone = useCallback((zoneId: string | null) => {
    setSelectedZoneId(zoneId);
  }, []);

  const toggleZoneVisibility = useCallback(() => {
    dispatch({ type: 'TOGGLE_ZONE_VISIBILITY' });
  }, [dispatch]);

  const startDrawing = useCallback(() => {
    setIsDrawing(true);
    setDrawingVertices([]);
  }, []);

  const addVertex = useCallback((vertex: ZoneVertex) => {
    setDrawingVertices((prev) => [...prev, vertex]);
  }, []);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setDrawingVertices([]);
  }, []);

  return {
    zones: state.zones ?? [],
    selectedZoneId,
    zoneVisibility: state.zoneVisibility ?? true,
    isDrawing,
    drawingVertices,
    addZone,
    updateZone,
    deleteZone,
    selectZone,
    toggleZoneVisibility,
    startDrawing,
    addVertex,
    cancelDrawing,
  };
}
