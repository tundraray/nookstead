'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TilesetCard } from '@/components/tileset-card';
import { TilesetUploadForm } from '@/components/tileset-upload-form';
import { useTilesets } from '@/hooks/use-tilesets';
import { useMaterials } from '@/hooks/use-materials';
import { Mountain } from 'lucide-react';
import { toast } from 'sonner';
import type { Tileset } from '@nookstead/db';

type SortOption = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest';

function parseSortOption(option: SortOption): {
  sort: 'name' | 'createdAt';
  order: 'asc' | 'desc';
} {
  switch (option) {
    case 'name-asc':
      return { sort: 'name', order: 'asc' };
    case 'name-desc':
      return { sort: 'name', order: 'desc' };
    case 'date-newest':
      return { sort: 'createdAt', order: 'desc' };
    case 'date-oldest':
      return { sort: 'createdAt', order: 'asc' };
  }
}

export default function TilesetsPage() {
  return (
    <Suspense>
      <TilesetsPageContent />
    </Suspense>
  );
}

function TilesetsPageContent() {
  const searchParams = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFromMaterialId, setUploadFromMaterialId] = useState<string | undefined>();
  const [uploadToMaterialId, setUploadToMaterialId] = useState<string | undefined>();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('date-newest');
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const { sort, order } = parseSortOption(sortOption);

  const { tilesets, isLoading, error, refresh } = useTilesets({
    search: debouncedSearch || undefined,
    tag: selectedTag ?? undefined,
    sort,
    order,
  });

  const { materials } = useMaterials();

  // Build material lookup maps
  const materialMap = new Map(materials.map((m) => [m.id, m]));
  const materialKeyMap = new Map(materials.map((m) => [m.key, m]));

  // URL param: from/to material keys for filtering from matrix
  const fromKey = searchParams.get('from');
  const toKey = searchParams.get('to');
  const fromMaterial = fromKey ? materialKeyMap.get(fromKey) : undefined;
  const toMaterial = toKey ? materialKeyMap.get(toKey) : undefined;

  // URL param: upload=true with pre-selected materials from matrix
  useEffect(() => {
    if (searchParams.get('upload') === 'true' && materials.length > 0) {
      const preFromKey = searchParams.get('fromKey');
      const preToKey = searchParams.get('toKey');
      const preFrom = preFromKey ? materialKeyMap.get(preFromKey) : undefined;
      const preTo = preToKey ? materialKeyMap.get(preToKey) : undefined;
      setUploadFromMaterialId(preFrom?.id);
      setUploadToMaterialId(preTo?.id);
      setUploadOpen(true);
    }
  }, [materials.length]); // Only run when materials load (searchParams is stable)

  // Fetch available tags
  useEffect(() => {
    async function fetchTags() {
      try {
        const res = await fetch('/api/tilesets/tags');
        if (res.ok) {
          const data: string[] = await res.json();
          setAvailableTags(data);
        }
      } catch {
        // Non-critical
      }
    }
    fetchTags();
  }, [tilesets]);

  function handleUploadSuccess(_created: Tileset[]) {
    setUploadOpen(false);
    setUploadFromMaterialId(undefined);
    setUploadToMaterialId(undefined);
    toast.success('Tileset uploaded successfully');
    refresh();
  }

  function toggleTagFilter(tag: string) {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tileset Library</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/tilesets/matrix">Transition Matrix</Link>
          </Button>
          <Button onClick={() => setUploadOpen(true)}>Upload</Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex gap-3">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tilesets..."
            className="max-w-sm"
          />
          <Select
            value={sortOption}
            onValueChange={(v) => setSortOption(v as SortOption)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="date-newest">Date (newest)</SelectItem>
              <SelectItem value="date-oldest">Date (oldest)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tag filter chips */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTag === tag ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleTagFilter(tag)}
              >
                {tag}
              </Badge>
            ))}
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="text-sm text-muted-foreground hover:text-foreground ml-1"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Tileset</DialogTitle>
          </DialogHeader>
          <TilesetUploadForm
            onSuccess={handleUploadSuccess}
            onClose={() => setUploadOpen(false)}
            preselectedFromMaterial={uploadFromMaterialId}
            preselectedToMaterial={uploadToMaterialId}
          />
        </DialogContent>
      </Dialog>

      {/* Loading state */}
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

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && tilesets.length === 0 && (
        <div className="text-center py-12">
          <Mountain className="mx-auto size-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">No tilesets found</h2>
          <p className="text-muted-foreground mb-4">
            {debouncedSearch || selectedTag
              ? 'Try adjusting your search or filters.'
              : 'Upload your first tileset to get started.'}
          </p>
          {!debouncedSearch && !selectedTag && (
            <Button onClick={() => setUploadOpen(true)}>
              Upload your first tileset
            </Button>
          )}
        </div>
      )}

      {/* Active material pair filter indicator */}
      {(fromMaterial || toMaterial) && (
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <span>Filtering:</span>
          {fromMaterial && (
            <Badge variant="outline">
              From: {fromMaterial.name}
            </Badge>
          )}
          {toMaterial && (
            <Badge variant="outline">
              To: {toMaterial.name}
            </Badge>
          )}
          <Link
            href="/tilesets"
            className="text-xs text-primary hover:underline ml-2"
          >
            Clear filter
          </Link>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && !error && tilesets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tilesets
            .filter((tileset) => {
              if (fromMaterial && tileset.fromMaterialId !== fromMaterial.id) return false;
              if (toMaterial && tileset.toMaterialId !== toMaterial.id) return false;
              return true;
            })
            .map((tileset) => (
              <TilesetCard
                key={tileset.id}
                tileset={{
                  ...tileset,
                  tags: (tileset as Tileset & { tags?: string[] }).tags ?? [],
                  fromMaterial: tileset.fromMaterialId
                    ? materialMap.get(tileset.fromMaterialId) ?? null
                    : null,
                  toMaterial: tileset.toMaterialId
                    ? materialMap.get(tileset.toMaterialId) ?? null
                    : null,
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}
