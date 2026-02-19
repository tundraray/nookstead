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

interface TransitionPropertiesProps {
  zone: ZoneData;
  onUpdate: (properties: Record<string, unknown>) => void;
}

const TRANSITION_TYPES = ['walk', 'door', 'portal', 'transport'] as const;

export function TransitionProperties({
  zone,
  onUpdate,
}: TransitionPropertiesProps) {
  const props = zone.properties;
  const targetMapId = (props.targetMapId as string) ?? '';
  const targetX = (props.targetX as number) ?? 0;
  const targetY = (props.targetY as number) ?? 0;
  const transitionType = (props.transitionType as string) ?? 'walk';

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Target Map ID</Label>
        <Input
          value={targetMapId}
          onChange={(e) =>
            onUpdate({ ...props, targetMapId: e.target.value })
          }
          className="h-7 text-xs"
          placeholder="Map UUID"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Target X</Label>
          <Input
            type="number"
            min={0}
            value={targetX}
            onChange={(e) =>
              onUpdate({ ...props, targetX: Number(e.target.value) })
            }
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Target Y</Label>
          <Input
            type="number"
            min={0}
            value={targetY}
            onChange={(e) =>
              onUpdate({ ...props, targetY: Number(e.target.value) })
            }
            className="h-7 text-xs"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Transition Type</Label>
        <Select
          value={transitionType}
          onValueChange={(v) => onUpdate({ ...props, transitionType: v })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSITION_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t[0].toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
