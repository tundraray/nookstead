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

interface SpawnPointPropertiesProps {
  zone: ZoneData;
  onUpdate: (properties: Record<string, unknown>) => void;
}

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

export function SpawnPointProperties({
  zone,
  onUpdate,
}: SpawnPointPropertiesProps) {
  const props = zone.properties;
  const direction = (props.direction as string) ?? 'down';
  const priority = (props.priority as number) ?? 0;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Direction</Label>
        <Select
          value={direction}
          onValueChange={(v) => onUpdate({ ...props, direction: v })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIRECTIONS.map((d) => (
              <SelectItem key={d} value={d} className="text-xs">
                {d[0].toUpperCase() + d.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Priority</Label>
        <Input
          type="number"
          min={0}
          value={priority}
          onChange={(e) =>
            onUpdate({ ...props, priority: Math.max(0, Number(e.target.value)) })
          }
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}
