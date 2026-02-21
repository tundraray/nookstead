'use client';

import { useState, useEffect } from 'react';
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
import { TagEditor } from '@/components/tag-editor';
import type { Tileset, Material } from '@nookstead/db';

interface UpdateTilesetRequest {
  name: string;
  fromMaterialId: string | null;
  toMaterialId: string | null;
  inverseTilesetId: string | null;
  tags: string[];
}

interface TilesetPropertiesFormProps {
  tileset: Tileset & { tags: string[] };
  allTilesets: Tileset[];
  materials: Material[];
  onSave: (data: UpdateTilesetRequest) => Promise<void>;
  isLoading?: boolean;
}

const NONE_VALUE = '__none__';

/**
 * Properties form for editing tileset metadata: name, from/to materials,
 * inverse tileset link, and tags.
 */
export function TilesetPropertiesForm({
  tileset,
  allTilesets,
  materials,
  onSave,
  isLoading = false,
}: TilesetPropertiesFormProps) {
  const [name, setName] = useState(tileset.name);
  const [fromMaterialId, setFromMaterialId] = useState<string | null>(
    tileset.fromMaterialId
  );
  const [toMaterialId, setToMaterialId] = useState<string | null>(
    tileset.toMaterialId
  );
  const [inverseTilesetId, setInverseTilesetId] = useState<string | null>(
    tileset.inverseTilesetId
  );
  const [tags, setTags] = useState<string[]>(tileset.tags);

  // Sync form when tileset prop changes (e.g., after save)
  useEffect(() => {
    setName(tileset.name);
    setFromMaterialId(tileset.fromMaterialId);
    setToMaterialId(tileset.toMaterialId);
    setInverseTilesetId(tileset.inverseTilesetId);
    setTags(tileset.tags);
  }, [tileset]);

  // Validation: from and to materials must differ
  const sameMaterialError =
    fromMaterialId !== null &&
    toMaterialId !== null &&
    fromMaterialId === toMaterialId;

  // Filter inverse tilesets: must have swapped material pair
  const compatibleInverseTilesets = allTilesets.filter(
    (t) =>
      t.id !== tileset.id &&
      t.fromMaterialId === toMaterialId &&
      t.toMaterialId === fromMaterialId
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sameMaterialError) return;
    await onSave({
      name,
      fromMaterialId,
      toMaterialId,
      inverseTilesetId,
      tags,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="tileset-name">Name</Label>
        <Input
          id="tileset-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tileset name"
        />
      </div>

      {/* From Material */}
      <div className="space-y-1.5">
        <Label>From Material</Label>
        <Select
          value={fromMaterialId ?? NONE_VALUE}
          onValueChange={(v) =>
            setFromMaterialId(v === NONE_VALUE ? null : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select material" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>None</SelectItem>
            {materials.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-4 rounded-full border"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* To Material */}
      <div className="space-y-1.5">
        <Label>To Material</Label>
        <Select
          value={toMaterialId ?? NONE_VALUE}
          onValueChange={(v) =>
            setToMaterialId(v === NONE_VALUE ? null : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select material" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>None</SelectItem>
            {materials.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-4 rounded-full border"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Validation error: same material */}
      {sameMaterialError && (
        <p className="text-sm text-destructive">
          From and To materials must be different.
        </p>
      )}

      {/* Inverse Tileset */}
      <div className="space-y-1.5">
        <Label>Inverse Tileset</Label>
        <Select
          value={inverseTilesetId ?? NONE_VALUE}
          onValueChange={(v) =>
            setInverseTilesetId(v === NONE_VALUE ? null : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select inverse tileset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>None</SelectItem>
            {compatibleInverseTilesets.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {compatibleInverseTilesets.length === 0 &&
          fromMaterialId &&
          toMaterialId && (
            <p className="text-xs text-muted-foreground">
              No tilesets found with matching inverse material pair.
            </p>
          )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <TagEditor tags={tags} onChange={setTags} />
      </div>

      {/* Save button */}
      <Button
        type="submit"
        disabled={isLoading || sameMaterialError || !name.trim()}
        className="w-full"
      >
        {isLoading ? 'Saving...' : 'Save'}
      </Button>
    </form>
  );
}
