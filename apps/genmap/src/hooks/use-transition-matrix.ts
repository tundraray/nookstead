'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Material } from '@nookstead/db';

interface MatrixCell {
  fromId: string;
  toId: string;
  count: number;
  representativeId?: string;
}

interface CoverageStats {
  total: number;
  covered: number;
  percentage: number;
}

export interface UseTransitionMatrixReturn {
  materials: Material[];
  matrixData: Map<string, Map<string, number>>;
  coverage: CoverageStats;
  cells: MatrixCell[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

interface MatrixApiResponse {
  materials: Material[];
  cells: {
    fromId: string;
    toId: string;
    count: number;
    representativeId: string;
  }[];
}

export function useTransitionMatrix(): UseTransitionMatrixReturn {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [cells, setCells] = useState<MatrixCell[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tilesets/matrix');
      if (!res.ok) throw new Error('Failed to fetch transition matrix');
      const data: MatrixApiResponse = await res.json();
      setMaterials(data.materials);
      setCells(
        data.cells.map((c) => ({
          fromId: c.fromId,
          toId: c.toId,
          count: Number(c.count),
          representativeId: c.representativeId || undefined,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const matrixData = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const cell of cells) {
      if (!map.has(cell.fromId)) {
        map.set(cell.fromId, new Map());
      }
      map.get(cell.fromId)?.set(cell.toId, cell.count);
    }
    return map;
  }, [cells]);

  const coverage = useMemo((): CoverageStats => {
    const n = materials.length;
    const total = n * (n - 1);
    if (total === 0) {
      return { total: 0, covered: 0, percentage: 0 };
    }
    const covered = cells.filter((c) => c.count > 0).length;
    const percentage = (covered / total) * 100;
    return { total, covered, percentage };
  }, [materials, cells]);

  return {
    materials,
    matrixData,
    coverage,
    cells,
    isLoading,
    error,
    refresh: fetchMatrix,
  };
}
