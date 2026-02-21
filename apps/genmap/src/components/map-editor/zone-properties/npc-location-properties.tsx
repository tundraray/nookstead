'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ZoneData } from '@nookstead/map-lib';

interface NpcLocationPropertiesProps {
  zone: ZoneData;
  onUpdate: (properties: Record<string, unknown>) => void;
}

export function NpcLocationProperties({
  zone,
  onUpdate,
}: NpcLocationPropertiesProps) {
  const props = zone.properties;
  const npcId = (props.npcId as string) ?? '';
  const scheduleTime = (props.scheduleTime as string) ?? '';
  const behavior = (props.behavior as string) ?? '';

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">NPC ID</Label>
        <Input
          value={npcId}
          onChange={(e) => onUpdate({ ...props, npcId: e.target.value })}
          className="h-7 text-xs"
          placeholder="NPC identifier"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Schedule Time</Label>
        <Input
          value={scheduleTime}
          onChange={(e) =>
            onUpdate({ ...props, scheduleTime: e.target.value })
          }
          className="h-7 text-xs"
          placeholder="e.g., 08:00-17:00"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Behavior</Label>
        <Input
          value={behavior}
          onChange={(e) => onUpdate({ ...props, behavior: e.target.value })}
          className="h-7 text-xs"
          placeholder="idle, patrol, shop..."
        />
      </div>
    </div>
  );
}
