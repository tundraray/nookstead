import type {
  EdgeDirection,
  EdgeOwner,
  MaterialPriorityMap,
  RoutingTable,
} from '../types/routing-types';
import type { TilesetRegistry } from './tileset-registry';

/**
 * Resolve edge ownership between two adjacent cells.
 *
 * Given two materials sharing a cardinal edge, determines which cell
 * "owns" the boundary for tileset selection purposes. Ownership is used
 * by `selectTilesetForCell` during S1/S2 conflict resolution.
 *
 * Algorithm:
 * 1. Same-material edges return `null` (no conflict to resolve).
 * 2. Compute virtual backgrounds via `router.nextHop`:
 *    - `virtualBG_A = nextHop(materialA, materialB)` (A's route toward B)
 *    - `virtualBG_B = nextHop(materialB, materialA)` (B's route toward A)
 * 3. Check tileset availability for each candidate:
 *    - Candidate A is valid if `virtualBG_A` is non-null and
 *      `registry.resolvePair(materialA, virtualBG_A)` is non-null.
 *    - Candidate B is valid if `virtualBG_B` is non-null and
 *      `registry.resolvePair(materialB, virtualBG_B)` is non-null.
 * 4. Resolution:
 *    - Only one valid: that candidate owns the edge.
 *    - Both valid: higher `priorities` value wins.
 *    - If priorities tie: lexicographically smaller material key wins
 *      to keep ownership symmetric regardless call order.
 *    - Neither valid: return `null`.
 *
 * The `dir` parameter encodes which direction of the shared edge is being
 * resolved (N/E/S/W). It is recorded for debugging but does not affect
 * the resolution logic -- the algorithm is symmetric by design.
 *
 * @param materialA - FG material of the source cell.
 * @param materialB - FG material of the neighbor cell.
 * @param dir - Direction from source to neighbor (N/E/S/W).
 * @param router - Routing table for `nextHop` queries.
 * @param registry - Tileset registry for `hasTileset` queries.
 * @param priorities - Material priority map for ownership tie-breaking.
 * @returns `EdgeOwner` if resolved, `null` if unresolvable or same-material.
 */
export function resolveEdge(
  materialA: string,
  materialB: string,
  _dir: EdgeDirection,
  router: RoutingTable,
  registry: TilesetRegistry,
  priorities: MaterialPriorityMap,
): EdgeOwner | null {
  // Same-material edges need no resolution.
  if (materialA === materialB) {
    return null;
  }

  // Compute virtual backgrounds via routing table.
  const virtualBG_A = router.nextHop(materialA, materialB);
  const virtualBG_B = router.nextHop(materialB, materialA);

  // Check tileset availability for each candidate.
  const candidateAResolved = virtualBG_A !== null
    ? registry.resolvePair(materialA, virtualBG_A)
    : null;
  const candidateBResolved = virtualBG_B !== null
    ? registry.resolvePair(materialB, virtualBG_B)
    : null;

  const candidateAValid = candidateAResolved !== null;
  const candidateBValid = candidateBResolved !== null;

  if (candidateAValid && candidateBValid) {
    // Both candidates valid -- higher priority wins.
    const priorityA = priorities.get(materialA) ?? 0;
    const priorityB = priorities.get(materialB) ?? 0;

    if (priorityA > priorityB || (priorityA === priorityB && materialA <= materialB)) {
      return {
        owner: materialA,
        bg: virtualBG_A!,
        tilesetKey: candidateAResolved!.tilesetKey,
      };
    } else {
      return {
        owner: materialB,
        bg: virtualBG_B!,
        tilesetKey: candidateBResolved!.tilesetKey,
      };
    }
  }

  if (candidateAValid) {
    return {
      owner: materialA,
      bg: virtualBG_A!,
      tilesetKey: candidateAResolved!.tilesetKey,
    };
  }

  if (candidateBValid) {
    return {
      owner: materialB,
      bg: virtualBG_B!,
      tilesetKey: candidateBResolved!.tilesetKey,
    };
  }

  // Neither candidate is valid -- edge is unresolvable.
  return null;
}

// Re-export classifyEdge and EdgeClass so that callers can import both
// edge ownership (resolveEdge) and edge stability classification
// (classifyEdge) from the same module.
export { classifyEdge } from './edge-classifier';
export type { EdgeClass } from './edge-classifier';
