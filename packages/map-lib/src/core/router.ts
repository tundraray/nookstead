import type { CompatGraph, RoutingTable } from '../types/routing-types';

/**
 * Compute the all-pairs BFS routing table from the undirected compatibility
 * graph. The routing table provides O(1) `nextHop` lookups for any pair of
 * materials.
 *
 * BFS is run from each material to discover shortest paths to all reachable
 * materials. When multiple equal-length paths exist, tie-breaking uses the
 * `preferences` array (earlier index = preferred next hop).
 *
 * The returned routing table is immutable after construction.
 *
 * @param compatGraph - Undirected material compatibility graph.
 * @param preferences - Ordered preference list for tie-breaking equal-length
 *   paths. Earlier index is preferred. Defaults to empty (arbitrary but
 *   deterministic tie-breaking).
 * @returns An immutable `RoutingTable` with `nextHop` and `hasRoute` methods.
 */
export function computeRoutingTable(
  compatGraph: CompatGraph,
  preferences: ReadonlyArray<string> = [],
): RoutingTable {
  // Build a priority index for fast tie-breaking lookups.
  // Lower index = higher preference.
  const preferenceIndex = new Map<string, number>();
  for (let i = 0; i < preferences.length; i++) {
    preferenceIndex.set(preferences[i], i);
  }

  // Collect all material keys from the compat graph.
  const allMaterials: string[] = Array.from(compatGraph.keys());

  // nextHopMap[from][to] = first hop on shortest path from `from` to `to`.
  const nextHopMap = new Map<string, Map<string, string>>();

  // Run BFS from each source material.
  for (const source of allMaterials) {
    const hopMap = new Map<string, string>();
    nextHopMap.set(source, hopMap);

    // BFS state: distance from source to each discovered node.
    const dist = new Map<string, number>();
    dist.set(source, 0);

    // For each node, track the best nextHop (the first step from source).
    // nextHopCandidate[node] = the first-hop neighbor from source on the
    // shortest path to node.
    const nextHopCandidate = new Map<string, string>();

    // BFS queue of [node, firstHop] pairs.
    const queue: Array<[string, string]> = [];

    // Seed: enqueue all direct neighbors of source, sorted by preference
    // for deterministic tie-breaking at distance 1.
    const sourceNeighbors = compatGraph.get(source);
    if (sourceNeighbors) {
      // Sort neighbors by preference index for deterministic BFS seeding.
      const sortedNeighbors = Array.from(sourceNeighbors).sort((a, b) => {
        const pa = preferenceIndex.get(a) ?? Infinity;
        const pb = preferenceIndex.get(b) ?? Infinity;
        return pa - pb;
      });

      for (const neighbor of sortedNeighbors) {
        dist.set(neighbor, 1);
        nextHopCandidate.set(neighbor, neighbor);
        hopMap.set(neighbor, neighbor);
        queue.push([neighbor, neighbor]);
      }
    }

    // BFS loop.
    let head = 0;
    while (head < queue.length) {
      const [current, firstHop] = queue[head++];
      const currentDist = dist.get(current)!;

      const neighbors = compatGraph.get(current);
      if (!neighbors) continue;

      for (const next of neighbors) {
        const newDist = currentDist + 1;
        const existingDist = dist.get(next);

        if (existingDist === undefined) {
          // First discovery of `next`.
          dist.set(next, newDist);
          nextHopCandidate.set(next, firstHop);
          hopMap.set(next, firstHop);
          queue.push([next, firstHop]);
        } else if (existingDist === newDist) {
          // Equal-length path found. Tie-break using preferences.
          const existingHop = nextHopCandidate.get(next)!;
          const existingPref = preferenceIndex.get(existingHop) ?? Infinity;
          const newPref = preferenceIndex.get(firstHop) ?? Infinity;

          if (newPref < existingPref) {
            nextHopCandidate.set(next, firstHop);
            hopMap.set(next, firstHop);
          }
        }
        // If newDist > existingDist, skip (longer path).
      }
    }
  }

  // Build the immutable RoutingTable.
  const table: RoutingTable = {
    nextHop(from: string, to: string): string | null {
      if (from === to) return null;
      const hopMap = nextHopMap.get(from);
      if (!hopMap) return null;
      return hopMap.get(to) ?? null;
    },

    hasRoute(from: string, to: string): boolean {
      if (from === to) return true;
      const hopMap = nextHopMap.get(from);
      if (!hopMap) return false;
      return hopMap.has(to);
    },
  };

  return Object.freeze(table);
}
