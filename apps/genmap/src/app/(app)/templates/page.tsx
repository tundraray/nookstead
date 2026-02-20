'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';

interface TemplateEntry {
  id: string;
  name: string;
  description: string | null;
  mapType: string;
  baseWidth: number;
  baseHeight: number;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapTypeFilter, setMapTypeFilter] = useState<string | null>(null);
  const [publishedFilter, setPublishedFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (mapTypeFilter) params.set('mapType', mapTypeFilter);
      if (publishedFilter !== 'all')
        params.set('isPublished', publishedFilter);
      const res = await fetch(`/api/templates?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load templates');
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [mapTypeFilter, publishedFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/templates/${deleteTarget}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      setDeleteTarget(null);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete template'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handlePublish(id: string) {
    try {
      const res = await fetch(`/api/templates/${id}/publish`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to publish template');
      toast.success('Template published');
      fetchTemplates();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to publish template'
      );
    }
  }

  async function handleUnpublish(id: string) {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: false }),
      });
      if (!res.ok) throw new Error('Failed to unpublish template');
      toast.success('Template unpublished');
      fetchTemplates();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to unpublish'
      );
    }
  }

  async function handleCreateMapFromTemplate(template: TemplateEntry) {
    try {
      const res = await fetch('/api/editor-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `From template: ${template.name}`,
          mapType: template.mapType,
          width: template.baseWidth,
          height: template.baseHeight,
        }),
      });
      if (!res.ok) throw new Error('Failed to create map from template');
      const data = await res.json();
      window.location.href = `/maps/${data.id}`;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create map'
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
      </div>

      <div className="flex gap-3 mb-4">
        <Select
          value={mapTypeFilter ?? 'all'}
          onValueChange={(v) => setMapTypeFilter(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="player_homestead">Player Homestead</SelectItem>
            <SelectItem value="town_district">Town District</SelectItem>
          </SelectContent>
        </Select>

        <Select value={publishedFilter} onValueChange={setPublishedFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Published status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Published</SelectItem>
            <SelectItem value="false">Drafts</SelectItem>
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
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={fetchTemplates}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && templates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No templates yet. Save an editor map as a template from the map
            editor.
          </p>
        </div>
      )}

      {!isLoading && !error && templates.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-48"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div>
                    <span className="font-medium">{t.name}</span>
                    {t.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {t.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{t.mapType}</Badge>
                </TableCell>
                <TableCell>
                  {t.baseWidth} x {t.baseHeight}
                </TableCell>
                <TableCell>v{t.version}</TableCell>
                <TableCell>
                  <Badge variant={t.isPublished ? 'default' : 'secondary'}>
                    {t.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(t.updatedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleCreateMapFromTemplate(t)}
                    >
                      Use
                    </Button>
                    {t.isPublished ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleUnpublish(t.id)}
                      >
                        Unpublish
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => handlePublish(t.id)}
                      >
                        Publish
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(t.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Template"
        confirmLabel="Delete"
        confirmVariant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        description={
          <p>
            Are you sure you want to delete this template? This action cannot
            be undone.
          </p>
        }
      />
    </div>
  );
}
