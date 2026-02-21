'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Trash2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ZONE_COLORS } from '@nookstead/map-lib';
import type { ZoneType } from '@nookstead/map-lib';
import type { UseZonesReturn } from '@/hooks/use-zones';
import { zoneTypeToEditor } from './zone-properties';
import { validateAllZones } from '@/lib/zone-validation';

const ZONE_TYPES: ZoneType[] = [
  'crop_field',
  'path',
  'water_feature',
  'decoration',
  'spawn_point',
  'transition',
  'npc_location',
  'animal_pen',
  'building_footprint',
  'transport_point',
  'lighting',
];

function formatZoneType(type: ZoneType): string {
  return type
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

interface ZonePanelProps {
  zoneState: UseZonesReturn;
}

export function ZonePanel({ zoneState }: ZonePanelProps) {
  const {
    zones,
    selectedZoneId,
    zoneVisibility,
    updateZone,
    deleteZone,
    selectZone,
    toggleZoneVisibility,
  } = zoneState;

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleValidate = useCallback(() => {
    const errors = validateAllZones(zones);
    if (errors.length === 0) {
      toast.success('All zones valid — no disallowed overlaps');
    } else {
      errors.forEach((err) => {
        toast.error(
          `Overlap: "${err.zoneA}" (${err.zoneAType}) and "${err.zoneB}" (${err.zoneBType}) — ${err.tiles.length} tiles`
        );
      });
    }
  }, [zones]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  return (
    <div className="space-y-3">
      {/* Visibility toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {zones.length} zone{zones.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={toggleZoneVisibility}
          title={zoneVisibility ? 'Hide zones' : 'Show zones'}
        >
          {zoneVisibility ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Zone list */}
      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {zones.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No zones. Use zone tools to draw zones.
          </p>
        ) : (
          zones.map((zone) => (
            <div
              key={zone.id}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs hover:bg-accent/50 ${
                selectedZoneId === zone.id ? 'bg-accent' : ''
              }`}
              onClick={() => selectZone(zone.id)}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: ZONE_COLORS[zone.zoneType] }}
              />
              <span className="truncate flex-1">{zone.name}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {zone.zoneType}
              </Badge>
              {pendingDeleteId === zone.id ? (
                <div className="flex gap-0.5">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-5 w-5 p-0 text-[10px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteZone(zone.id);
                      setPendingDeleteId(null);
                    }}
                  >
                    Y
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-[10px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteId(null);
                    }}
                  >
                    N
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteId(zone.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Selected zone properties */}
      {selectedZone && (
        <div className="border-t pt-2 space-y-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <Select
              value={selectedZone.zoneType}
              onValueChange={(value) =>
                updateZone(selectedZone.id, {
                  zoneType: value as ZoneType,
                })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONE_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: ZONE_COLORS[type] }}
                      />
                      {formatZoneType(type)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zone type-specific property editor */}
          {(() => {
            const Editor = zoneTypeToEditor[selectedZone.zoneType];
            return Editor ? (
              <Editor
                zone={selectedZone}
                onUpdate={(properties) =>
                  updateZone(selectedZone.id, { properties })
                }
              />
            ) : null;
          })()}
        </div>
      )}

      {/* Validate button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs h-7"
        disabled={zones.length === 0}
        data-testid="validate-zones-btn"
        onClick={handleValidate}
      >
        <ShieldCheck className="h-3 w-3 mr-1" />
        Validate Zones
      </Button>
    </div>
  );
}
