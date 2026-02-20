'use client';

import { useState } from 'react';
import type { Material } from '@nookstead/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type {
  CreateMaterialRequest,
  UpdateMaterialRequest,
} from '@/hooks/use-materials';

interface MaterialFormProps {
  initialData?: Partial<Material>;
  onSave: (data: CreateMaterialRequest | UpdateMaterialRequest) => Promise<void>;
  onCancel: () => void;
}

function generateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function MaterialForm({ initialData, onSave, onCancel }: MaterialFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [key, setKey] = useState(initialData?.key ?? '');
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(!!initialData?.key);
  const [keyEditable, setKeyEditable] = useState(false);
  const [color, setColor] = useState(initialData?.color ?? '#3b82f6');
  const [walkable, setWalkable] = useState(initialData?.walkable ?? true);
  const [speedModifier, setSpeedModifier] = useState(
    initialData?.speedModifier?.toString() ?? '1'
  );
  const [swimRequired, setSwimRequired] = useState(initialData?.swimRequired ?? false);
  const [damaging, setDamaging] = useState(initialData?.damaging ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!keyManuallyEdited) {
      setKey(generateKey(value));
    }
  }

  function handleKeyChange(value: string) {
    setKey(value);
    setKeyManuallyEdited(true);
  }

  function toggleKeyEditable() {
    setKeyEditable(!keyEditable);
    if (!keyEditable) {
      setKeyManuallyEdited(true);
    }
  }

  function validateSpeedModifier(value: string): string | null {
    const num = parseFloat(value);
    if (isNaN(num)) return 'Speed modifier must be a number';
    if (num < 0) return 'Speed modifier must be at least 0.0';
    if (num > 2) return 'Speed modifier must be at most 2.0';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const speedError = validateSpeedModifier(speedModifier);
    if (speedError) {
      setError(speedError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData: CreateMaterialRequest = {
        name: name.trim(),
        key: key || generateKey(name),
        color,
        walkable,
        speedModifier: parseFloat(speedModifier),
        swimRequired,
        damaging,
      };
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save material');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="material-name">Name</Label>
        <Input
          id="material-name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Material name"
          className="w-40"
          required
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label htmlFor="material-key">Key</Label>
          <button
            type="button"
            onClick={toggleKeyEditable}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {keyEditable ? '(lock)' : '(edit)'}
          </button>
        </div>
        <Input
          id="material-key"
          value={key}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="auto_generated"
          className={cn('w-40', !keyEditable && 'opacity-60')}
          readOnly={!keyEditable}
          tabIndex={keyEditable ? 0 : -1}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="material-color">Color</Label>
        <div className="flex items-center gap-2">
          <Input
            id="material-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-9 p-1 cursor-pointer"
          />
          <div
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="material-walkable">Walkable</Label>
        <div className="flex items-center h-9">
          <input
            id="material-walkable"
            type="checkbox"
            checked={walkable}
            onChange={(e) => setWalkable(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="material-speed">Speed</Label>
        <Input
          id="material-speed"
          type="number"
          value={speedModifier}
          onChange={(e) => setSpeedModifier(e.target.value)}
          onBlur={() => {
            const err = validateSpeedModifier(speedModifier);
            if (err) setError(err);
            else setError(null);
          }}
          min={0}
          max={2}
          step={0.05}
          className="w-20"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="material-swim">Swim</Label>
        <div className="flex items-center h-9">
          <input
            id="material-swim"
            type="checkbox"
            checked={swimRequired}
            onChange={(e) => setSwimRequired(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="material-damaging">Damage</Label>
        <div className="flex items-center h-9">
          <input
            id="material-damaging"
            type="checkbox"
            checked={damaging}
            onChange={(e) => setDamaging(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 h-9">
        <Button type="submit" size="sm" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {error && (
        <p className="text-destructive text-sm w-full">{error}</p>
      )}
    </form>
  );
}
