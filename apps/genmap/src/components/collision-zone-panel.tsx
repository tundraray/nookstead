'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CollisionZone } from '@/hooks/use-object-editor';

interface CollisionZonePanelProps {
  zones: CollisionZone[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onUpdate: (index: number, updates: Partial<CollisionZone>) => void;
  onDelete: (index: number) => void;
  onAdd: (zone: Omit<CollisionZone, 'id'>) => void;
}

export function CollisionZonePanel({
  zones,
  selectedIndex,
  onSelect,
  onUpdate,
  onDelete,
  onAdd,
}: CollisionZonePanelProps) {
  const selectedZone = selectedIndex !== null ? zones[selectedIndex] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm" title="Collision zones define where players can or cannot walk">
          Collision Zones ({zones.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() =>
            onAdd({
              label: `Zone ${zones.length + 1}`,
              type: 'collision',
              shape: 'rectangle',
              x: 0,
              y: 0,
              width: 32,
              height: 32,
            })
          }
          title="Add a new collision zone at position (0,0)"
        >
          + Add
        </Button>
      </div>

      {zones.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No zones. Draw on canvas in Zone mode or click &quot;+ Add&quot;.
        </p>
      )}

      {/* Zone list */}
      <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
        {zones.map((zone, i) => (
          <div
            key={zone.id}
            className={`flex items-center gap-1 text-xs p-1 rounded cursor-pointer ${
              selectedIndex === i
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-muted'
            }`}
            onClick={() => onSelect(i)}
          >
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{
                backgroundColor:
                  zone.type === 'collision'
                    ? 'rgba(239, 68, 68, 0.5)'
                    : 'rgba(34, 197, 94, 0.5)',
              }}
              title={zone.type === 'collision' ? 'Blocked area' : 'Walkable area'}
            />
            <span className="truncate flex-1">{zone.label}</span>
            <span className="text-muted-foreground">
              {zone.width}x{zone.height}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(i);
              }}
              className="hover:text-destructive px-0.5"
              title="Delete zone"
            >
              x
            </button>
          </div>
        ))}
      </div>

      {/* Selected zone properties */}
      {selectedZone && selectedIndex !== null && (
        <div className="space-y-2 border-t pt-2">
          <div>
            <Label className="text-xs" title="Human-readable name for this zone">Label</Label>
            <Input
              value={selectedZone.label}
              onChange={(e) => onUpdate(selectedIndex, { label: e.target.value })}
              className="h-7 text-xs"
              placeholder="Zone label"
            />
          </div>

          <div>
            <Label className="text-xs" title="Collision = blocked (red), Walkable = passable (green)">Type</Label>
            <div className="flex gap-1">
              <Button
                variant={selectedZone.type === 'collision' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-xs px-2 flex-1"
                onClick={() => onUpdate(selectedIndex, { type: 'collision' })}
                title="Mark as collision — players cannot walk here"
              >
                Collision
              </Button>
              <Button
                variant={selectedZone.type === 'walkable' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-xs px-2 flex-1"
                onClick={() => onUpdate(selectedIndex, { type: 'walkable' })}
                title="Mark as walkable — players can walk here"
              >
                Walkable
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <div>
              <Label className="text-xs" title="X offset from object origin in pixels">X</Label>
              <Input
                type="number"
                value={selectedZone.x}
                onChange={(e) => onUpdate(selectedIndex, { x: parseInt(e.target.value, 10) || 0 })}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs" title="Y offset from object origin in pixels">Y</Label>
              <Input
                type="number"
                value={selectedZone.y}
                onChange={(e) => onUpdate(selectedIndex, { y: parseInt(e.target.value, 10) || 0 })}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs" title="Width of the zone in pixels">W</Label>
              <Input
                type="number"
                value={selectedZone.width}
                onChange={(e) => onUpdate(selectedIndex, { width: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="h-7 text-xs"
                min={1}
              />
            </div>
            <div>
              <Label className="text-xs" title="Height of the zone in pixels">H</Label>
              <Input
                type="number"
                value={selectedZone.height}
                onChange={(e) => onUpdate(selectedIndex, { height: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="h-7 text-xs"
                min={1}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
