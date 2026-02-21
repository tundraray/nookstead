'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ZoneData } from '@nookstead/map-lib';
import { polygonArea } from '../zone-drawing';

interface CropFieldPropertiesProps {
  zone: ZoneData;
  onUpdate: (properties: Record<string, unknown>) => void;
}

function computeMaxCropSlots(zone: ZoneData): number {
  if (zone.shape === 'rectangle' && zone.bounds) {
    return zone.bounds.width * zone.bounds.height;
  }
  if (zone.shape === 'polygon' && zone.vertices) {
    return Math.round(polygonArea(zone.vertices));
  }
  return 0;
}

export function CropFieldProperties({
  zone,
  onUpdate,
}: CropFieldPropertiesProps) {
  const props = zone.properties;
  const soilQuality = (props.soilQuality as number) ?? 3;
  const irrigated = (props.irrigated as boolean) ?? false;
  const maxCropSlots = computeMaxCropSlots(zone);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Soil Quality (1-5)</Label>
        <Input
          type="number"
          min={1}
          max={5}
          value={soilQuality}
          onChange={(e) =>
            onUpdate({
              ...props,
              soilQuality: Math.min(5, Math.max(1, Number(e.target.value))),
            })
          }
          className="h-7 text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="irrigated"
          checked={irrigated}
          onChange={(e) =>
            onUpdate({ ...props, irrigated: e.target.checked })
          }
          className="h-3.5 w-3.5"
        />
        <Label htmlFor="irrigated" className="text-xs">
          Irrigated
        </Label>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Max Crop Slots</Label>
        <Input
          type="number"
          value={maxCropSlots}
          readOnly
          className="h-7 text-xs bg-muted"
        />
      </div>
    </div>
  );
}
