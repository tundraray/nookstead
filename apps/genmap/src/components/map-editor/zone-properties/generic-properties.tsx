'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ZoneData } from '@nookstead/map-lib';

interface GenericPropertiesProps {
  zone: ZoneData;
  onUpdate: (properties: Record<string, unknown>) => void;
}

export function GenericProperties({ zone, onUpdate }: GenericPropertiesProps) {
  const props = zone.properties;
  const entries = Object.entries(props);
  const [newKey, setNewKey] = useState('');

  const handleValueChange = (key: string, value: string) => {
    onUpdate({ ...props, [key]: value });
  };

  const handleRemove = (key: string) => {
    const updated = { ...props };
    delete updated[key];
    onUpdate(updated);
  };

  const handleAdd = () => {
    const key = newKey.trim();
    if (!key || key in props) return;
    onUpdate({ ...props, [key]: '' });
    setNewKey('');
  };

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No properties</p>
      )}
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-16 truncate">
            {key}
          </span>
          <Input
            value={String(value ?? '')}
            onChange={(e) => handleValueChange(key, e.target.value)}
            className="h-6 text-xs flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => handleRemove(key)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="New key"
          className="h-6 text-xs flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={handleAdd}
          disabled={!newKey.trim()}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
