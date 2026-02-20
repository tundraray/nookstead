'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SpriteCard } from '@/components/sprite-card';
import { SpriteUploadForm } from '@/components/sprite-upload-form';
import { useSprites } from '@/hooks/use-sprites';
import { toast } from 'sonner';

export default function SpritesPage() {
  const { sprites, isLoading, isLoadingMore, error, hasMore, refetch, loadMore } =
    useSprites();
  const [uploadOpen, setUploadOpen] = useState(false);

  function handleUploadSuccess() {
    setUploadOpen(false);
    toast.success('Sprite uploaded successfully');
    refetch();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sprite Library</h1>
        <Button onClick={() => setUploadOpen(true)}>Upload Sprite</Button>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Sprite</DialogTitle>
          </DialogHeader>
          <SpriteUploadForm onSuccess={handleUploadSuccess} />
        </DialogContent>
      </Dialog>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
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

      {!isLoading && !error && sprites.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No sprites yet. Upload your first sprite sheet to get started.
          </p>
          <Button onClick={() => setUploadOpen(true)}>Upload Sprite</Button>
        </div>
      )}

      {!isLoading && !error && sprites.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sprites.map((sprite) => (
              <SpriteCard key={sprite.id} sprite={sprite} />
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
    </div>
  );
}
