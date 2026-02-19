'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ZoneData } from '@nookstead/map-lib';

interface WaterFeaturePropertiesProps {
  zone: ZoneData;
  onUpdate: (properties: Record<string, unknown>) => void;
}

const WATER_TYPES = ['pond', 'river', 'irrigation', 'well'] as const;

export function WaterFeatureProperties({
  zone,
  onUpdate,
}: WaterFeaturePropertiesProps) {
  const props = zone.properties;
  const waterType = (props.waterType as string) ?? 'pond';
  const depth = (props.depth as number) ?? 1;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Water Type</Label>
        <Select
          value={waterType}
          onValueChange={(v) => onUpdate({ ...props, waterType: v })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WATER_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t[0].toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Depth</Label>
        <Input
          type="number"
          min={1}
          value={depth}
          onChange={(e) =>
            onUpdate({ ...props, depth: Math.max(1, Number(e.target.value)) })
          }
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}
