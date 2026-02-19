'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useEditorMaps, type MapTypeFilter } from '@/hooks/use-editor-maps';
import { toast } from 'sonner';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapTypeBadgeVariant(
  mapType: string
): 'default' | 'secondary' | 'outline' {
  switch (mapType) {
    case 'player_homestead':
      return 'default';
    case 'town_district':
      return 'secondary';
    case 'template':
      return 'outline';
    default:
      return 'outline';
  }
}

export default function MapsPage() {
  const {
    maps,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    mapTypeFilter,
    setMapTypeFilter,
    refetch,
    loadMore,
  } = useEditorMaps();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/editor-maps/${deleteTarget}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete map');
      setDeleteTarget(null);
      toast.success('Map deleted');
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete map'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleFilterChange(value: string) {
    if (value === 'all') {
      setMapTypeFilter(null);
    } else {
      setMapTypeFilter(value as MapTypeFilter);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Maps</h1>
        <Button asChild>
          <Link href="/maps/new">New Map</Link>
        </Button>
      </div>

      <div className="mb-4">
        <Select
          value={mapTypeFilter ?? 'all'}
          onValueChange={handleFilterChange}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="player_homestead">Player Homestead</SelectItem>
            <SelectItem value="town_district">Town District</SelectItem>
            <SelectItem value="template">Template</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
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

      {!isLoading && !error && maps.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No maps yet. Create your first map.
          </p>
          <Button asChild>
            <Link href="/maps/new">New Map</Link>
          </Button>
        </div>
      )}

      {!isLoading && !error && maps.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maps.map((map) => (
                <TableRow key={map.id}>
                  <TableCell>
                    <Link
                      href={`/maps/${map.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {map.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={mapTypeBadgeVariant(map.mapType)}>
                      {map.mapType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {map.width} x {map.height}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(map.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(map.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        title="Delete Map"
        confirmLabel="Delete"
        confirmVariant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        description={
          <p>
            Are you sure you want to delete this map? This action cannot be
            undone.
          </p>
        }
      />
    </div>
  );
}
