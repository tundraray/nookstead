'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ZONE_COLORS } from '@nookstead/map-lib';
import type { ZoneType } from '@nookstead/map-lib';

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

interface ZoneCreationDialogProps {
  open: boolean;
  onConfirm: (name: string, zoneType: ZoneType) => void;
  onCancel: () => void;
}

export function ZoneCreationDialog({
  open,
  onConfirm,
  onCancel,
}: ZoneCreationDialogProps) {
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('crop_field');

  const handleConfirm = () => {
    const finalName = name.trim() || `${formatZoneType(zoneType)} Zone`;
    onConfirm(finalName, zoneType);
    setName('');
    setZoneType('crop_field');
  };

  const handleCancel = () => {
    onCancel();
    setName('');
    setZoneType('crop_field');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Create Zone</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="zone-name" className="text-xs">
              Name
            </Label>
            <Input
              id="zone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Zone name (optional)"
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={zoneType}
              onValueChange={(v) => setZoneType(v as ZoneType)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONE_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-sm">
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
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
