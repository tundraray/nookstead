'use client';

import { useRelationships } from '@/hooks/use-relationships';
import { useNpcStatuses } from '@/hooks/use-npc-statuses';

const socialTypeLabels: Record<string, string> = {
  stranger: 'Stranger',
  acquaintance: 'Acquaintance',
  friend: 'Friend',
  close_friend: 'Close Friend',
  romantic: 'Romantic',
  rival: 'Rival',
};

const statusLabels: Record<string, string> = {
  ignore: 'Ignoring',
  ban: 'Banned',
};

export function NpcRelationshipsTab({ botId }: { botId: string }) {
  const {
    relationships,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
  } = useRelationships(botId);

  const {
    statuses,
    isLoading: isLoadingStatuses,
    error: statusesError,
  } = useNpcStatuses(botId);

  return (
    <div className="space-y-6">
      {/* Active Player Statuses */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Active Statuses</h3>

        {isLoadingStatuses && (
          <p className="text-sm text-muted-foreground">Loading statuses...</p>
        )}

        {statusesError && (
          <p className="text-sm text-destructive">{statusesError}</p>
        )}

        {!isLoadingStatuses && statuses.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No active statuses. NPCs can ignore players who are rude during dialogue.
          </p>
        )}

        {statuses.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
              <span>Player ID</span>
              <span>Status</span>
              <span>Reason</span>
              <span>Expires</span>
              <span>Created</span>
            </div>
            {statuses.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-5 gap-2 text-xs py-1 border-b"
              >
                <span className="truncate font-mono text-muted-foreground">
                  {s.userId.slice(0, 8)}...
                </span>
                <span className="text-destructive font-medium">
                  {statusLabels[s.status] ?? s.status}
                </span>
                <span className="truncate text-muted-foreground">
                  {s.reason ?? '—'}
                </span>
                <span>{new Date(s.expiresAt).toLocaleString()}</span>
                <span>{new Date(s.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relationships */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Relationships</h3>

        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading relationships...
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isLoading && relationships.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No relationships yet. Relationships are created when players interact
            with this NPC.
          </p>
        )}

        {relationships.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
              <span>Player ID</span>
              <span>Social Type</span>
              <span>Score</span>
              <span>Worker</span>
              <span>Updated</span>
            </div>
            {relationships.map((rel) => (
              <div
                key={rel.id}
                className="grid grid-cols-5 gap-2 text-xs py-1 border-b"
              >
                <span className="truncate font-mono text-muted-foreground">
                  {rel.userId.slice(0, 8)}...
                </span>
                <span>
                  {socialTypeLabels[rel.socialType] ?? rel.socialType}
                </span>
                <span>{rel.score}</span>
                <span>{rel.isWorker ? 'Yes' : 'No'}</span>
                <span>{new Date(rel.updatedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        {hasMore && relationships.length > 0 && (
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="mt-3 text-sm text-primary hover:underline disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
