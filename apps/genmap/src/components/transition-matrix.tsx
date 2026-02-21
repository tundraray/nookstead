'use client';

import type { Material } from '@nookstead/db';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TransitionMatrixProps {
  materials: Material[];
  matrixData: Map<string, Map<string, number>>;
  coverage: { total: number; covered: number; percentage: number };
  onCellClick: (fromKey: string, toKey: string, count: number) => void;
}

function MaterialSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-4 rounded border border-border shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

export function TransitionMatrix({
  materials,
  matrixData,
  coverage,
  onCellClick,
}: TransitionMatrixProps) {
  function getCellCount(fromId: string, toId: string): number {
    return matrixData.get(fromId)?.get(toId) ?? 0;
  }

  return (
    <div>
      {/* Coverage summary bar */}
      <div className="mb-4 space-y-2">
        <p className="text-sm font-medium">
          Coverage: {coverage.covered}/{coverage.total} pairs (
          {coverage.percentage.toFixed(1)}%)
        </p>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(coverage.percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Matrix table with horizontal scroll */}
      <div className="overflow-auto border rounded-lg">
        <TooltipProvider>
          <table className="border-collapse">
            {/* Header row */}
            <thead>
              <tr>
                {/* Top-left corner cell */}
                <th className="sticky top-0 left-0 z-20 bg-background border-b border-r p-2 min-w-[120px]">
                  <span className="text-xs text-muted-foreground">
                    From \ To
                  </span>
                </th>
                {/* Column headers (To materials) */}
                {materials.map((mat) => (
                  <th
                    key={mat.id}
                    className="sticky top-0 z-10 bg-background border-b p-2 min-w-[80px] text-center"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <MaterialSwatch color={mat.color} />
                      <span className="text-xs font-medium whitespace-nowrap">
                        {mat.name}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body rows */}
            <tbody>
              {materials.map((fromMat) => (
                <tr key={fromMat.id}>
                  {/* Row header (From material) */}
                  <td className="sticky left-0 z-10 bg-background border-r p-2 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <MaterialSwatch color={fromMat.color} />
                      <span className="text-xs font-medium whitespace-nowrap">
                        {fromMat.name}
                      </span>
                    </div>
                  </td>

                  {/* Data cells */}
                  {materials.map((toMat) => {
                    const isDiagonal = fromMat.id === toMat.id;
                    const count = getCellCount(fromMat.id, toMat.id);
                    const isPopulated = count > 0;

                    if (isDiagonal) {
                      return (
                        <td
                          key={toMat.id}
                          className="border p-2 text-center bg-muted text-muted-foreground select-none"
                        >
                          <span className="text-xs">&mdash;</span>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={toMat.id}
                        className={`border p-2 text-center cursor-pointer transition-shadow hover:shadow-md ${
                          isPopulated ? 'bg-green-50' : 'bg-red-50'
                        }`}
                        onClick={() =>
                          onCellClick(fromMat.key, toMat.key, count)
                        }
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`text-xs font-medium ${
                                isPopulated
                                  ? 'text-green-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {isPopulated ? count : '0'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            From {fromMat.name} to {toMat.name}: {count}{' '}
                            tileset{count !== 1 ? 's' : ''}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TooltipProvider>
      </div>
    </div>
  );
}
