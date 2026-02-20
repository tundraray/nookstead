'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TransitionMatrix } from '@/components/transition-matrix';
import { useTransitionMatrix } from '@/hooks/use-transition-matrix';
import { ArrowLeft } from 'lucide-react';

export default function TransitionMatrixPage() {
  const router = useRouter();
  const { materials, matrixData, coverage, isLoading, error, refresh } =
    useTransitionMatrix();

  function handleCellClick(fromKey: string, toKey: string, count: number) {
    if (count > 0) {
      router.push(`/tilesets?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`);
    } else {
      router.push(
        `/tilesets?upload=true&fromKey=${encodeURIComponent(fromKey)}&toKey=${encodeURIComponent(toKey)}`
      );
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tilesets">
            <ArrowLeft className="size-4 mr-1" />
            Back to Tilesets
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Transition Matrix</h1>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      {/* Matrix content */}
      {!isLoading && !error && (
        <div className="overflow-auto">
          <TransitionMatrix
            materials={materials}
            matrixData={matrixData}
            coverage={coverage}
            onCellClick={handleCellClick}
          />
        </div>
      )}
    </div>
  );
}
