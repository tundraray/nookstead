'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { ZoneData } from '@nookstead/map-lib';
import { validateAllZones } from '@/lib/zone-validation';

interface ZoneChange {
  added: ZoneData[];
  modified: ZoneData[];
  deletedIds: string[];
}

export interface UseZoneApiReturn {
  loadZones: (mapId: string) => Promise<ZoneData[]>;
  saveZones: (mapId: string, zones: ZoneData[]) => Promise<boolean>;
  trackZoneSnapshot: (zones: ZoneData[]) => void;
}

/**
 * Hook for zone persistence: loading zones from API and saving changes.
 * Tracks a snapshot of the last-saved zones to compute diffs on save.
 */
export function useZoneApi(): UseZoneApiReturn {
  const snapshotRef = useRef<ZoneData[]>([]);

  const trackZoneSnapshot = useCallback((zones: ZoneData[]) => {
    snapshotRef.current = zones.map((z) => ({ ...z }));
  }, []);

  const loadZones = useCallback(
    async (mapId: string): Promise<ZoneData[]> => {
      const res = await fetch(`/api/editor-maps/${mapId}/zones`);
      if (!res.ok) return [];
      const dbZones = await res.json();
      const zones: ZoneData[] = dbZones.map(
        (z: Record<string, unknown>) => ({
          id: z.id as string,
          name: z.name as string,
          zoneType: z.zoneType as ZoneData['zoneType'],
          shape: z.shape as ZoneData['shape'],
          bounds: z.bounds as ZoneData['bounds'],
          vertices: z.vertices as ZoneData['vertices'],
          properties:
            (z.properties as Record<string, unknown>) ?? {},
          zIndex: (z.zIndex as number) ?? 0,
        })
      );
      snapshotRef.current = zones.map((z) => ({ ...z }));
      return zones;
    },
    []
  );

  const computeChanges = useCallback(
    (currentZones: ZoneData[]): ZoneChange => {
      const prev = snapshotRef.current;
      const prevMap = new Map(prev.map((z) => [z.id, z]));
      const currMap = new Map(currentZones.map((z) => [z.id, z]));

      const added: ZoneData[] = [];
      const modified: ZoneData[] = [];
      const deletedIds: string[] = [];

      for (const zone of currentZones) {
        const prevZone = prevMap.get(zone.id);
        if (!prevZone) {
          added.push(zone);
        } else if (JSON.stringify(prevZone) !== JSON.stringify(zone)) {
          modified.push(zone);
        }
      }

      for (const prevZone of prev) {
        if (!currMap.has(prevZone.id)) {
          deletedIds.push(prevZone.id);
        }
      }

      return { added, modified, deletedIds };
    },
    []
  );

  const saveZones = useCallback(
    async (mapId: string, zones: ZoneData[]): Promise<boolean> => {
      // Pre-save validation
      const errors = validateAllZones(zones);
      if (errors.length > 0) {
        errors.forEach((err) => {
          toast.error(
            `Zone overlap: "${err.zoneA}" and "${err.zoneB}" — ${err.tiles.length} tiles`
          );
        });
        return false;
      }

      const changes = computeChanges(zones);
      const hasChanges =
        changes.added.length > 0 ||
        changes.modified.length > 0 ||
        changes.deletedIds.length > 0;

      if (!hasChanges) return true;

      try {
        // Process in parallel
        const promises: Promise<unknown>[] = [];

        for (const zone of changes.added) {
          promises.push(
            fetch(`/api/editor-maps/${mapId}/zones`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: zone.name,
                zoneType: zone.zoneType,
                shape: zone.shape,
                bounds: zone.bounds,
                vertices: zone.vertices,
                properties: zone.properties,
                zIndex: zone.zIndex,
              }),
            })
          );
        }

        for (const zone of changes.modified) {
          promises.push(
            fetch(`/api/editor-maps/${mapId}/zones/${zone.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: zone.name,
                zoneType: zone.zoneType,
                shape: zone.shape,
                bounds: zone.bounds,
                vertices: zone.vertices,
                properties: zone.properties,
                zIndex: zone.zIndex,
              }),
            })
          );
        }

        for (const id of changes.deletedIds) {
          promises.push(
            fetch(`/api/editor-maps/${mapId}/zones/${id}`, {
              method: 'DELETE',
            })
          );
        }

        await Promise.all(promises);
        snapshotRef.current = zones.map((z) => ({ ...z }));
        return true;
      } catch (error) {
        console.error('Failed to save zones:', error);
        toast.error('Failed to save zones');
        return false;
      }
    },
    [computeChanges]
  );

  return { loadZones, saveZones, trackZoneSnapshot };
}
