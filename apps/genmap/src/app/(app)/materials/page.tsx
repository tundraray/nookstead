'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MaterialForm } from '@/components/material-form';
import { useMaterials } from '@/hooks/use-materials';
import { toast } from 'sonner';
import type { Material } from '@nookstead/db';
import type { CreateMaterialRequest, UpdateMaterialRequest } from '@/hooks/use-materials';

export default function MaterialsPage() {
  const { materials, isLoading, error, createMaterial, updateMaterial, deleteMaterial, refresh } =
    useMaterials();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<{
    affectedTilesets: { id: string; name: string }[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleCreate(data: CreateMaterialRequest | UpdateMaterialRequest) {
    await createMaterial(data as CreateMaterialRequest);
    setShowAddForm(false);
    toast.success('Material created');
  }

  async function handleUpdate(id: string, data: CreateMaterialRequest | UpdateMaterialRequest) {
    await updateMaterial(id, data as UpdateMaterialRequest);
    setEditingId(null);
    toast.success('Material updated');
  }

  function handleDeleteClick(material: Material) {
    setDeleteTarget(material);
    setDeleteInfo(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteMaterial(deleteTarget.id);
      toast.success(`Deleted material "${result.deleted.name}"`);
      if (result.affectedTilesets.length > 0) {
        toast.info(
          `${result.affectedTilesets.length} tileset(s) had their material reference cleared`
        );
      }
      setDeleteTarget(null);
      setDeleteInfo(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete material');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Materials</h1>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          Add Material
        </Button>
      </div>

      {/* Material Palette */}
      {!isLoading && materials.length > 0 && (
        <TooltipProvider>
          <div className="flex flex-wrap gap-2 mb-6">
            {materials.map((m) => (
              <Tooltip key={m.id}>
                <TooltipTrigger asChild>
                  <div
                    className="w-6 h-6 rounded-full border border-border cursor-default"
                    style={{ backgroundColor: m.color }}
                  />
                </TooltipTrigger>
                <TooltipContent>{m.name}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && materials.length === 0 && !showAddForm && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No materials yet. Click &quot;Add Material&quot; to create one.
          </p>
          <Button onClick={() => setShowAddForm(true)}>Add Material</Button>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-4 p-4 border rounded-lg bg-muted/30">
          <MaterialForm
            onSave={handleCreate}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Materials Table */}
      {!isLoading && !error && materials.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Color</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Walkable</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Properties</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((material) =>
              editingId === material.id ? (
                <TableRow key={material.id}>
                  <TableCell colSpan={7}>
                    <MaterialForm
                      initialData={material}
                      onSave={(data) => handleUpdate(material.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={material.id}>
                  <TableCell>
                    <div
                      className="w-6 h-6 rounded border border-border"
                      style={{ backgroundColor: material.color }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{material.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {material.key}
                  </TableCell>
                  <TableCell>
                    <Badge variant={material.walkable ? 'secondary' : 'destructive'}>
                      {material.walkable ? 'Walkable' : 'Blocked'}
                    </Badge>
                  </TableCell>
                  <TableCell>{material.speedModifier}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {material.swimRequired && (
                        <Badge variant="outline">Swim</Badge>
                      )}
                      {material.damaging && (
                        <Badge variant="outline">Damaging</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditingId(material.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(material)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteInfo(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Material</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteInfo && deleteInfo.affectedTilesets.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-amber-600 mb-2">
                Warning: This material is referenced by {deleteInfo.affectedTilesets.length}{' '}
                tileset(s):
              </p>
              <ul className="list-disc list-inside text-muted-foreground">
                {deleteInfo.affectedTilesets.map((t) => (
                  <li key={t.id}>{t.name}</li>
                ))}
              </ul>
              <p className="mt-2 text-muted-foreground">
                Their material references will be cleared.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteInfo(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
