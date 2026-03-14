'use client';

import { useRelationships } from '@/hooks/use-relationships';

const socialTypeLabels: Record<string, string> = {
  stranger: 'Stranger',
  acquaintance: 'Acquaintance',
  friend: 'Friend',
  close_friend: 'Close Friend',
  romantic: 'Romantic',
  rival: 'Rival',
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

  return (
    <div className="space-y-4">
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
          {/* Table header */}
          <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
            <span>Player ID</span>
            <span>Social Type</span>
            <span>Score</span>
            <span>Worker</span>
            <span>Updated</span>
          </div>
          {/* Table rows */}
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
  );
}
