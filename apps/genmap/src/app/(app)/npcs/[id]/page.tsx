'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumb';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AVAILABLE_SKINS } from '@nookstead/shared';
import { NpcMemoriesTab } from './memories-tab';
import { NpcRelationshipsTab } from './relationships-tab';
import {
  useNpcDialogues,
  type AdminDialogueSession,
  type DialogueMessage,
} from '@/hooks/use-npc-dialogues';
import type { Npc } from '@/hooks/use-npcs';
import { toast } from 'sonner';
import { AlertTriangle, Sparkles } from 'lucide-react';

interface MapOption {
  id: string;
  name: string;
  mapType: string;
}

export default function NpcEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // NPC data
  const [npc, setNpc] = useState<Npc | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [skin, setSkin] = useState('');
  const [mapId, setMapId] = useState('');
  const [role, setRole] = useState('');
  const [personality, setPersonality] = useState('');
  const [speechStyle, setSpeechStyle] = useState('');
  const [bio, setBio] = useState('');
  const [age, setAge] = useState('');
  const [traits, setTraits] = useState('');
  const [goals, setGoals] = useState('');
  const [fears, setFears] = useState('');
  const [interests, setInterests] = useState('');
  const [concept, setConcept] = useState('');

  // Maps dropdown
  const [maps, setMaps] = useState<MapOption[]>([]);
  const [mapsLoading, setMapsLoading] = useState(true);

  // Save/delete state
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dialogue state
  const [activeTab, setActiveTab] = useState('details');
  const {
    sessions,
    isLoading: isLoadingSessions,
    isLoadingMore: isLoadingMoreSessions,
    error: sessionsError,
    hasMore: hasMoreSessions,
    loadMore: loadMoreSessions,
    fetchSessionMessages,
  } = useNpcDialogues(activeTab === 'dialogues' ? id : null);

  // Expanded sessions and messages
  const [expandedSessions, setExpandedSessions] = useState<
    Record<string, DialogueMessage[]>
  >({});
  const [loadingSession, setLoadingSession] = useState<string | null>(null);

  // Load NPC data and maps in parallel
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    const loadNpc = fetch(`/api/npcs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('NPC not found');
        return r.json();
      })
      .then((data: Npc) => {
        setNpc(data);
        setName(data.name);
        setSkin(data.skin);
        setMapId(data.mapId);
        setRole(data.role ?? '');
        setPersonality(data.personality ?? '');
        setSpeechStyle(data.speechStyle ?? '');
        setBio(data.bio ?? '');
        setAge(data.age != null ? String(data.age) : '');
        setTraits(data.traits ? data.traits.join(', ') : '');
        setGoals(data.goals ? data.goals.join(', ') : '');
        setFears(data.fears ? data.fears.join(', ') : '');
        setInterests(data.interests ? data.interests.join(', ') : '');
      });

    const loadMaps = fetch('/api/maps')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load maps');
        return r.json();
      })
      .then((data: MapOption[]) => setMaps(data))
      .catch(() => setMaps([]));

    Promise.all([loadNpc, loadMaps])
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load NPC'
        );
      })
      .finally(() => {
        setIsLoading(false);
        setMapsLoading(false);
      });
  }, [id]);

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
      if (data.bio) setBio(data.bio);
      if (data.age != null) setAge(String(data.age));
      if (data.traits) setTraits(data.traits.join(', '));
      if (data.goals) setGoals(data.goals.join(', '));
      if (data.fears) setFears(data.fears.join(', '));
      if (data.interests) setInterests(data.interests.join(', '));
      toast.success('Character generated');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Generation failed'
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setSaveError('Name is required');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/npcs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          skin,
          mapId,
          role: role.trim() || null,
          personality: personality.trim() || null,
          speechStyle: speechStyle.trim() || null,
          bio: bio.trim() || null,
          age: age.trim() ? Number(age.trim()) : null,
          traits: traits.trim() ? traits.split(',').map((s) => s.trim()).filter(Boolean) : null,
          goals: goals.trim() ? goals.split(',').map((s) => s.trim()).filter(Boolean) : null,
          fears: fears.trim() ? fears.split(',').map((s) => s.trim()).filter(Boolean) : null,
          interests: interests.trim() ? interests.split(',').map((s) => s.trim()).filter(Boolean) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save NPC');
      }
      toast.success('NPC saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/npcs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete NPC');
      toast.success('NPC deleted');
      router.push('/npcs');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function toggleSession(sessionId: string) {
    if (expandedSessions[sessionId]) {
      // Collapse
      setExpandedSessions((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      return;
    }

    // Expand and fetch messages
    setLoadingSession(sessionId);
    try {
      const messages = await fetchSessionMessages(sessionId);
      setExpandedSessions((prev) => ({ ...prev, [sessionId]: messages }));
    } catch {
      toast.error('Failed to load session messages');
    } finally {
      setLoadingSession(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 max-w-lg rounded-lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <Breadcrumb
          items={[{ label: 'NPCs', href: '/npcs' }, { label: 'Error' }]}
        />
        <p className="text-destructive mt-4">{loadError}</p>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => router.push('/npcs')}
        >
          Back to NPCs
        </Button>
      </div>
    );
  }

  // Group sessions by userId for the dialogue tab
  const sessionsByUser = sessions.reduce<
    Record<string, AdminDialogueSession[]>
  >((acc, session) => {
    const key = session.userId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(session);
    return acc;
  }, {});

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'NPCs', href: '/npcs' },
          { label: npc?.name || 'Edit NPC' },
        ]}
      />
      <h1 className="text-2xl font-bold mb-4">
        Edit NPC: &quot;{npc?.name}&quot;
      </h1>

      <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 mb-4 max-w-lg">
        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          Personality changes will not take effect on active game rooms until the
          room restarts.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="dialogues">Dialogues</TabsTrigger>
          <TabsTrigger value="memories">Memories</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="space-y-4 mt-4">
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
              <Label htmlFor="npc-map">Map</Label>
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
                  placeholder="Describe how the NPC speaks..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="npc-bio">Bio</Label>
                <Textarea
                  id="npc-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Background story: where from, why in the village, hidden conflict..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="npc-age">Age</Label>
                <Input
                  id="npc-age"
                  type="number"
                  min={18}
                  max={70}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="18-70"
                  className="w-24"
                />
              </div>

              <div>
                <Label htmlFor="npc-traits">Traits</Label>
                <Input
                  id="npc-traits"
                  value={traits}
                  onChange={(e) => setTraits(e.target.value)}
                  placeholder="e.g., kind, stubborn, curious, shy, brave"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated, up to 5</p>
              </div>

              <div>
                <Label htmlFor="npc-goals">Goals</Label>
                <Input
                  id="npc-goals"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="e.g., open a bakery, find a lost heirloom"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated, up to 3</p>
              </div>

              <div>
                <Label htmlFor="npc-fears">Fears</Label>
                <Input
                  id="npc-fears"
                  value={fears}
                  onChange={(e) => setFears(e.target.value)}
                  placeholder="e.g., thunderstorms, being forgotten"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated, up to 3</p>
              </div>

              <div>
                <Label htmlFor="npc-interests">Interests</Label>
                <Input
                  id="npc-interests"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder="e.g., fishing, folk tales, herbal medicine"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated, up to 5</p>
              </div>
            </div>

            {saveError && (
              <p className="text-destructive text-sm">{saveError}</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Delete NPC
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="dialogues">
          <div className="mt-4 space-y-4">
            {isLoadingSessions && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-16 w-full rounded-md" />
                  </div>
                ))}
              </div>
            )}

            {sessionsError && (
              <div className="text-center py-8">
                <p className="text-destructive mb-4">{sessionsError}</p>
              </div>
            )}

            {!isLoadingSessions && !sessionsError && sessions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No dialogues yet.</p>
              </div>
            )}

            {!isLoadingSessions &&
              !sessionsError &&
              sessions.length > 0 &&
              Object.entries(sessionsByUser).map(
                ([userId, userSessions]) => {
                  const firstSession = userSessions[0];

                  return (
                    <div key={userId} className="space-y-2">
                      <h3 className="text-sm font-semibold">
                        {firstSession.userEmail}
                        {firstSession.userName && (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            ({firstSession.userName})
                          </span>
                        )}
                      </h3>

                      {userSessions.map((session) => (
                        <div
                          key={session.sessionId}
                          className="border rounded-md"
                        >
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center justify-between"
                            onClick={() => toggleSession(session.sessionId)}
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <span>
                                {new Date(
                                  session.startedAt
                                ).toLocaleDateString()}{' '}
                                {new Date(
                                  session.startedAt
                                ).toLocaleTimeString()}
                              </span>
                              <span className="text-muted-foreground">-</span>
                              <span>
                                {session.endedAt
                                  ? new Date(
                                      session.endedAt
                                    ).toLocaleTimeString()
                                  : 'Active'}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {session.messageCount} message
                                {session.messageCount !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <span className="text-muted-foreground text-xs">
                              {expandedSessions[session.sessionId]
                                ? 'Collapse'
                                : 'Expand'}
                            </span>
                          </button>

                          {loadingSession === session.sessionId && (
                            <div className="px-3 py-2 space-y-2">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-4 w-5/6" />
                            </div>
                          )}

                          {expandedSessions[session.sessionId] && (
                            <div className="border-t px-3 py-2 space-y-2 max-h-80 overflow-y-auto">
                              {expandedSessions[session.sessionId].map(
                                (msg) => (
                                  <div
                                    key={msg.id}
                                    className="flex gap-2 text-sm"
                                  >
                                    <Badge
                                      variant={
                                        msg.role === 'user'
                                          ? 'default'
                                          : 'secondary'
                                      }
                                      className="text-xs shrink-0 h-5"
                                    >
                                      {msg.role === 'user' ? 'User' : 'NPC'}
                                    </Badge>
                                    <p className="flex-1 whitespace-pre-wrap">
                                      {msg.content}
                                    </p>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {new Date(
                                        msg.createdAt
                                      ).toLocaleTimeString()}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }
              )}

            {hasMoreSessions && !isLoadingSessions && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={loadMoreSessions}
                  disabled={isLoadingMoreSessions}
                >
                  {isLoadingMoreSessions
                    ? 'Loading...'
                    : 'Load More Sessions'}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="memories">
          <NpcMemoriesTab botId={id} />
        </TabsContent>

        <TabsContent value="relationships">
          <div className="mt-4">
            <NpcRelationshipsTab botId={id} />
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete NPC"
        description={
          <p>
            Are you sure you want to delete this NPC? All dialogue history will
            also be deleted. This action cannot be undone.
          </p>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
