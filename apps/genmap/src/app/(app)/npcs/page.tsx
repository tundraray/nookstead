'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NpcCard } from '@/components/npc-card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useNpcs } from '@/hooks/use-npcs';
import { toast } from 'sonner';

export default function NpcsPage() {
  const { npcs, isLoading, isLoadingMore, error, hasMore, refetch, loadMore } =
    useNpcs();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/npcs/${deleteTarget}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete NPC');
      setDeleteTarget(null);
      toast.success('NPC deleted');
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete NPC'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">NPCs</h1>
        <Button asChild>
          <Link href="/npcs/new">New NPC</Link>
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && npcs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No NPCs found. Create your first NPC.
          </p>
          <Button asChild>
            <Link href="/npcs/new">New NPC</Link>
          </Button>
        </div>
      )}

      {!isLoading && !error && npcs.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {npcs.map((npc) => (
              <NpcCard
                key={npc.id}
                npc={npc}
                onDelete={(id) => setDeleteTarget(id)}
              />
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-6">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete NPC"
        confirmLabel="Delete"
        confirmVariant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        description={
          <p>
            Are you sure you want to delete this NPC? All dialogue history will
            also be deleted. This action cannot be undone.
          </p>
        }
      />
    </div>
  );
}
