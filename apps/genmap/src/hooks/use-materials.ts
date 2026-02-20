'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Material } from '@nookstead/db';

export interface CreateMaterialRequest {
  name: string;
  key?: string;
  color: string;
  walkable?: boolean;
  speedModifier?: number;
  swimRequired?: boolean;
  damaging?: boolean;
}

export interface UpdateMaterialRequest {
  name?: string;
  key?: string;
  color?: string;
  walkable?: boolean;
  speedModifier?: number;
  swimRequired?: boolean;
  damaging?: boolean;
}

interface UseMaterialsReturn {
  materials: Material[];
  isLoading: boolean;
  error: string | null;
  createMaterial: (data: CreateMaterialRequest) => Promise<Material>;
  updateMaterial: (id: string, data: UpdateMaterialRequest) => Promise<Material>;
  deleteMaterial: (id: string) => Promise<{ deleted: Material; affectedTilesets: { id: string; name: string }[] }>;
  refresh: () => void;
}

export function useMaterials(): UseMaterialsReturn {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/materials');
      if (!res.ok) throw new Error('Failed to fetch materials');
      const data: Material[] = await res.json();
      setMaterials(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const createMaterial = useCallback(
    async (data: CreateMaterialRequest): Promise<Material> => {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create material');
      }

      const material: Material = await res.json();
      await fetchMaterials();
      return material;
    },
    [fetchMaterials]
  );

  const updateMaterial = useCallback(
    async (id: string, data: UpdateMaterialRequest): Promise<Material> => {
      const res = await fetch(`/api/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update material');
      }

      const material: Material = await res.json();
      await fetchMaterials();
      return material;
    },
    [fetchMaterials]
  );

  const deleteMaterial = useCallback(
    async (
      id: string
    ): Promise<{ deleted: Material; affectedTilesets: { id: string; name: string }[] }> => {
      const res = await fetch(`/api/materials/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete material');
      }

      const result = await res.json();
      await fetchMaterials();
      return result;
    },
    [fetchMaterials]
  );

  return {
    materials,
    isLoading,
    error,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    refresh: fetchMaterials,
  };
}
