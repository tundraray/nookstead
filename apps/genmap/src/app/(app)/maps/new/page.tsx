'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Breadcrumb } from '@/components/breadcrumb';
import { toast } from 'sonner';
import {
  validateMapDimensions,
  MAP_TYPE_CONSTRAINTS,
  isWalkable,
  type MapType,
  type Cell,
} from '@nookstead/map-lib';

const MAP_TYPE_OPTIONS: { value: MapType; label: string }[] = [
  { value: 'player_homestead', label: 'Player Homestead' },
  { value: 'town_district', label: 'Town District' },
  { value: 'template', label: 'Template' },
];

function getConstraints(mapType: MapType) {
  return MAP_TYPE_CONSTRAINTS[mapType];
}

function buildEmptyGrid(width: number, height: number): Cell[][] {
  const grid: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ terrain: 'deep_water', elevation: 0, meta: {} });
    }
    grid.push(row);
  }
  return grid;
}

interface EditorLayerData {
  name: string;
  terrainKey: string;
  visible: boolean;
  opacity: number;
  frames: number[][];
}

function buildEmptyLayers(): EditorLayerData[] {
  return [
    {
      name: 'ground',
      terrainKey: 'terrain-01',
      visible: true,
      opacity: 1,
      frames: [],
    },
  ];
}

function buildWalkableGrid(width: number, height: number): boolean[][] {
  const walkable: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(isWalkable('deep_water'));
    }
    walkable.push(row);
  }
  return walkable;
}

export default function NewMapPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mapType, setMapType] = useState<MapType>('player_homestead');
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const constraints = getConstraints(mapType);

  function handleMapTypeChange(value: string) {
    const newType = value as MapType;
    setMapType(newType);
    const c = MAP_TYPE_CONSTRAINTS[newType];
    // Reset dimensions to min if current values are out of range
    if (width < c.minWidth || width > c.maxWidth) {
      setWidth(c.minWidth);
    }
    if (height < c.minHeight || height > c.maxHeight) {
      setHeight(c.minHeight);
    }
    setErrors({});
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    const dimResult = validateMapDimensions(mapType, width, height);
    if (!dimResult.valid && dimResult.reason) {
      // Parse the reason to assign to width or height field
      if (dimResult.reason.startsWith('Width')) {
        newErrors.width = dimResult.reason;
      } else if (dimResult.reason.startsWith('Height')) {
        newErrors.height = dimResult.reason;
      } else {
        newErrors.dimensions = dimResult.reason;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const grid = buildEmptyGrid(width, height);
      const layers = buildEmptyLayers();
      const walkable = buildWalkableGrid(width, height);

      const res = await fetch('/api/editor-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          mapType,
          width,
          height,
          grid,
          layers,
          walkable,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create map');
      }

      const created = await res.json();
      toast.success('Map created');
      router.push(`/maps/${created.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create map';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Maps', href: '/maps' },
          { label: 'New Map' },
        ]}
      />
      <h1 className="text-2xl font-bold mb-6">New Map</h1>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <Label htmlFor="map-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="map-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.name;
                  return next;
                });
              }
            }}
            placeholder="Enter map name"
          />
          {errors.name && (
            <p className="text-destructive text-sm mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <Label htmlFor="map-type">Map Type</Label>
          <Select value={mapType} onValueChange={handleMapTypeChange}>
            <SelectTrigger id="map-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAP_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="map-width">
              Width ({constraints.minWidth}-{constraints.maxWidth})
            </Label>
            <Input
              id="map-width"
              type="number"
              value={width}
              onChange={(e) => {
                setWidth(Number(e.target.value));
                if (errors.width) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.width;
                    return next;
                  });
                }
              }}
              min={constraints.minWidth}
              max={constraints.maxWidth}
            />
            {errors.width && (
              <p className="text-destructive text-sm mt-1">{errors.width}</p>
            )}
          </div>
          <div>
            <Label htmlFor="map-height">
              Height ({constraints.minHeight}-{constraints.maxHeight})
            </Label>
            <Input
              id="map-height"
              type="number"
              value={height}
              onChange={(e) => {
                setHeight(Number(e.target.value));
                if (errors.height) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.height;
                    return next;
                  });
                }
              }}
              min={constraints.minHeight}
              max={constraints.maxHeight}
            />
            {errors.height && (
              <p className="text-destructive text-sm mt-1">{errors.height}</p>
            )}
          </div>
        </div>
        {errors.dimensions && (
          <p className="text-destructive text-sm">{errors.dimensions}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Map'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/maps">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
