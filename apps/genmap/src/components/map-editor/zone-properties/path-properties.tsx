'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ZoneData } from '@nookstead/map-lib';

interface PathPropertiesProps {
  zone: ZoneData;
  onUpdate: (properties: Record<string, unknown>) => void;
}

export function PathProperties({ zone, onUpdate }: PathPropertiesProps) {
  const props = zone.properties;
  const surfaceType = (props.surfaceType as string) ?? 'dirt';
  const width = (props.width as number) ?? 1;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Surface Type</Label>
        <Input
          value={surfaceType}
          onChange={(e) =>
            onUpdate({ ...props, surfaceType: e.target.value })
          }
          className="h-7 text-xs"
          placeholder="dirt, stone, gravel..."
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Width</Label>
        <Input
          type="number"
          min={1}
          value={width}
          onChange={(e) =>
            onUpdate({ ...props, width: Math.max(1, Number(e.target.value)) })
          }
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}
