'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TilesetImageCanvas } from '@/components/tileset-image-canvas';
import { AutotilePreview } from '@/components/autotile-preview';
import { TilesetPropertiesForm } from '@/components/tileset-properties-form';
import { TilesetValidation } from '@/components/tileset-validation';
import { TransitionTestCanvas } from '@/components/transition-test-canvas';
import { useMaterials } from '@/hooks/use-materials';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tileset } from '@nookstead/db';

interface TilesetWithTags extends Tileset {
  tags: string[];
}

interface UsageData {
  maps: { id: string; name: string }[];
  count: number;
}

export default function TilesetEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { materials, isLoading: materialsLoading } = useMaterials();

  const [tileset, setTileset] = useState<TilesetWithTags | null>(null);
  const [allTilesets, setAllTilesets] = useState<Tileset[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inverse tileset data for the transition test canvas
  const [inverseTilesetUrl, setInverseTilesetUrl] = useState<string | undefined>(undefined);

  const fetchTileset = useCallback(async () => {
    try {
      const res = await fetch(`/api/tilesets/${params.id}`);
      if (!res.ok) throw new Error('Failed to fetch tileset');
      const data: TilesetWithTags = await res.json();
      setTileset(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [params.id]);

  const fetchAllTilesets = useCallback(async () => {
    try {
      const res = await fetch('/api/tilesets');
      if (!res.ok) throw new Error('Failed to fetch tilesets');
      const data: Tileset[] = await res.json();
      setAllTilesets(data);
    } catch {
      // Non-critical for inverse dropdown
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`/api/tilesets/${params.id}/usage`);
      if (!res.ok) throw new Error('Failed to fetch usage');
      const data: UsageData = await res.json();
      setUsage(data);
    } catch {
      // Non-critical
    }
  }, [params.id]);

  // Fetch inverse tileset URL if linked
  const fetchInverseTilesetUrl = useCallback(async (inverseTilesetId: string | null) => {
    if (!inverseTilesetId) {
      setInverseTilesetUrl(undefined);
      return;
    }
    try {
      const res = await fetch(`/api/tilesets/${inverseTilesetId}`);
      if (!res.ok) return;
      const data = await res.json();
      setInverseTilesetUrl(data.s3Url);
    } catch {
      // Non-critical
    }
  }, []);

  // Initial data load
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const ts = await fetchTileset();
      await Promise.all([fetchAllTilesets(), fetchUsage()]);
      if (ts) {
        await fetchInverseTilesetUrl(ts.inverseTilesetId);
      }
      setIsLoading(false);
    }
    load();
  }, [fetchTileset, fetchAllTilesets, fetchUsage, fetchInverseTilesetUrl]);

  async function handleSave(data: {
    name: string;
    fromMaterialId: string | null;
    toMaterialId: string | null;
    inverseTilesetId: string | null;
    tags: string[];
  }) {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tilesets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      const updated: TilesetWithTags = await res.json();
      setTileset(updated);
      await fetchInverseTilesetUrl(updated.inverseTilesetId);
      await fetchAllTilesets();
      toast.success('Tileset saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tilesets/${params.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete');
      }
      toast.success('Tileset deleted');
      router.push('/tilesets');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
      setIsDeleting(false);
    }
  }

  // Resolve material colors for the transition test canvas
  const fromMaterial = materials.find((m) => m.id === tileset?.fromMaterialId);
  const toMaterial = materials.find((m) => m.id === tileset?.toMaterialId);

  const hasBothMaterials = !!tileset?.fromMaterialId && !!tileset?.toMaterialId;

  if (isLoading || materialsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-64" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !tileset) {
    return (
      <div className="space-y-4">
        <Link
          href="/tilesets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Tilesets
        </Link>
        <div className="text-center py-12">
          <p className="text-destructive mb-4">
            {error || 'Tileset not found'}
          </p>
          <Button variant="outline" onClick={() => router.push('/tilesets')}>
            Go to Tilesets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/tilesets"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Tilesets
      </Link>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tileset.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isDeleting}>
              <Trash2 className="size-4 mr-1" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete tileset?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{tileset.name}&quot; and
                remove its image from storage.
                {usage && usage.count > 0 && (
                  <>
                    {' '}
                    This tileset is used in{' '}
                    <strong>
                      {usage.count} map{usage.count !== 1 ? 's' : ''}
                    </strong>
                    : {usage.maps.map((m) => m.name).join(', ')}.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: Image + Preview + Validation */}
        <div className="lg:col-span-3 space-y-6">
          <TilesetImageCanvas src={tileset.s3Url} />
          <AutotilePreview src={tileset.s3Url} />
          <TilesetValidation tilesetId={tileset.id} hasInverse={!!tileset.inverseTilesetId} />
        </div>

        {/* Right column: Properties form */}
        <div className="lg:col-span-2">
          <TilesetPropertiesForm
            tileset={tileset}
            allTilesets={allTilesets}
            materials={materials}
            onSave={handleSave}
            isLoading={isSaving}
          />
        </div>
      </div>

      {/* Transition Test Canvas */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Transition Test</h2>
        {hasBothMaterials ? (
          <TransitionTestCanvas
            tilesetSrc={tileset.s3Url}
            inverseTilesetSrc={inverseTilesetUrl}
            fromMaterialColor={fromMaterial?.color ?? '#888888'}
            toMaterialColor={toMaterial?.color ?? '#888888'}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Assign &quot;From&quot; and &quot;To&quot; materials in the properties form to enable the transition test canvas.
          </div>
        )}
      </div>

      {/* Usage section */}
      {usage && (
        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-2">Usage</h2>
          <p className="text-sm text-muted-foreground">
            Used in {usage.count} map{usage.count !== 1 ? 's' : ''}.
          </p>
          {usage.count > 0 && (
            <ul className="mt-2 space-y-1">
              {usage.maps.map((m) => (
                <li key={m.id} className="text-sm">
                  <Link
                    href={`/maps/${m.id}`}
                    className="text-primary hover:underline"
                  >
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
