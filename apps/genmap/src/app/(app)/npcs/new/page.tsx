'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AVAILABLE_SKINS } from '@nookstead/shared';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

interface MapOption {
  id: string;
  name: string;
  mapType: string;
}

export default function NewNpcPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [skin, setSkin] = useState('');
  const [mapId, setMapId] = useState('');
  const [role, setRole] = useState('');
  const [personality, setPersonality] = useState('');
  const [speechStyle, setSpeechStyle] = useState('');
  const [concept, setConcept] = useState('');

  const [maps, setMaps] = useState<MapOption[]>([]);
  const [mapsLoading, setMapsLoading] = useState(true);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMapsLoading(true);
    fetch('/api/maps')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load maps');
        return r.json();
      })
      .then((data: MapOption[]) => {
        setMaps(data);
        setMapsError(null);
      })
      .catch((err) => {
        setMapsError(
          err instanceof Error ? err.message : 'Failed to load maps'
        );
      })
      .finally(() => {
        setMapsLoading(false);
      });
  }, []);

  async function handleGenerate() {
    const input = concept.trim() || role.trim() || name.trim();
    if (!input) {
      toast.error('Enter a concept, role, or name first');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/npcs/generate-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: input, name: name.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }
      const data = await res.json();
      if (data.role) setRole(data.role);
      if (data.personality) setPersonality(data.personality);
      if (data.speechStyle) setSpeechStyle(data.speechStyle);
      toast.success('Character generated');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Generation failed'
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!skin) {
      setError('Skin is required');
      return;
    }
    if (!mapId) {
      setError('Map is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/npcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          skin,
          mapId,
          role: role.trim() || undefined,
          personality: personality.trim() || undefined,
          speechStyle: speechStyle.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create NPC');
      }
      const created = await res.json();
      toast.success('NPC created');
      router.push(`/npcs/${created.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create NPC';
      toast.error(msg);
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: 'NPCs', href: '/npcs' }, { label: 'New NPC' }]}
      />
      <h1 className="text-2xl font-bold mb-6">Create NPC</h1>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <div>
          <Label htmlFor="npc-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="npc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="NPC name"
            maxLength={64}
            required
          />
        </div>

        <div>
          <Label htmlFor="npc-skin">
            Skin <span className="text-destructive">*</span>
          </Label>
          <Select value={skin} onValueChange={setSkin}>
            <SelectTrigger id="npc-skin" className="w-full">
              <SelectValue placeholder="Select a skin" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_SKINS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="npc-map">
            Map <span className="text-destructive">*</span>
          </Label>
          {mapsError ? (
            <p className="text-destructive text-sm">{mapsError}</p>
          ) : (
            <Select
              value={mapId}
              onValueChange={setMapId}
              disabled={mapsLoading}
            >
              <SelectTrigger id="npc-map" className="w-full">
                <SelectValue
                  placeholder={mapsLoading ? 'Loading maps...' : 'Select a map'}
                />
              </SelectTrigger>
              <SelectContent>
                {maps.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.mapType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Character Traits</Label>
            <div className="flex items-center gap-2">
              <Input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="e.g., friendly blacksmith"
                className="w-48 h-8 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {isGenerating ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="npc-role">Role</Label>
            <Input
              id="npc-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Shopkeeper, Guard, Farmer"
              maxLength={64}
            />
          </div>

          <div>
            <Label htmlFor="npc-personality">Personality</Label>
            <Textarea
              id="npc-personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Describe the NPC's personality traits and behavior..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="npc-speech-style">Speech Style</Label>
            <Textarea
              id="npc-speech-style"
              value={speechStyle}
              onChange={(e) => setSpeechStyle(e.target.value)}
              placeholder="Describe how the NPC speaks (e.g., formal, casual, uses old English)..."
              rows={3}
            />
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create NPC'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/npcs')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
