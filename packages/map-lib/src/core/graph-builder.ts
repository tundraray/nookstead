import type { CompatGraph, RenderGraph } from '../types/routing-types';
import type { TilesetRegistry } from './tileset-registry';

/**
 * Contains both the undirected compatibility graph and the directed render
 * graph built from a TilesetRegistry.
 */
export interface MaterialGraphs {
  /** Undirected graph: A--B edge if either A_B or B_A tileset exists. */
  readonly compatGraph: CompatGraph;
  /** Directed graph: A->B edge only if A_B tileset exists. */
  readonly renderGraph: RenderGraph;
}

/**
 * Build the material compatibility graph (undirected) and render graph
 * (directed) from a fully-constructed TilesetRegistry.
 *
 * - `compatGraph`: if tileset A_B or B_A exists, both A->B and B->A edges
 *   are present. Self-edges (A->A) are excluded.
 * - `renderGraph`: A->B edge only if tileset A_B (fg=A, bg=B) exists.
 *   Self-edges are excluded.
 *
 * @param registry - A fully-constructed TilesetRegistry.
 * @returns The `MaterialGraphs` containing both graph views.
 */
export function buildGraphs(registry: TilesetRegistry): MaterialGraphs {
  const compatAccum = new Map<string, Set<string>>();
  const renderAccum = new Map<string, Set<string>>();

  const pairs = registry.getAllTransitionPairs();

  for (const [from, to] of pairs) {
    // Self-edges excluded (should not appear in transition pairs, but guard)
    if (from === to) continue;

    // renderGraph: directed A->B only if A_B tileset exists
    if (!renderAccum.has(from)) {
      renderAccum.set(from, new Set());
    }
    renderAccum.get(from)!.add(to);

    // compatGraph: undirected -- add both directions
    if (!compatAccum.has(from)) {
      compatAccum.set(from, new Set());
    }
    compatAccum.get(from)!.add(to);

    if (!compatAccum.has(to)) {
      compatAccum.set(to, new Set());
    }
    compatAccum.get(to)!.add(from);
  }

  // Convert mutable maps to readonly maps with readonly sets
  const compatGraph: CompatGraph = new Map(
    Array.from(compatAccum.entries()).map(([k, v]) => [k, new Set(v)] as const),
  );
  const renderGraph: RenderGraph = new Map(
    Array.from(renderAccum.entries()).map(([k, v]) => [k, new Set(v)] as const),
  );

  return { compatGraph, renderGraph };
}
