import type { RoutingTable } from '../types/routing-types';
import type { TilesetRegistry } from './tileset-registry';

/**
 * Edge classification for neighbor repaint stability.
 *
 * - C1: same material (always stable)
 * - C2: symmetric direct pair (stable -- both sides use direct tileset)
 * - C3: stable bridge (both direct, same intermediate hop)
 * - C4: mixed valid (both resolved, but routing may change on neighbor edit)
 * - C5: partial/invalid (at least one side has no route)
 */
export type EdgeClass = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';

/**
 * Classify a cardinal edge between two materials into a repaint-stability class.
 *
 * C1: same material
 * C2: symmetric direct pair (both direct, direct neighbors)
 * C3: stable bridge (both direct, same intermediate hop)
 * C4: mixed valid (both resolved, but not C2/C3)
 * C5: partial/invalid (at least one side unresolved)
 */
export function classifyEdge(
  materialA: string,
  materialB: string,
  router: RoutingTable,
  registry: TilesetRegistry,
): EdgeClass {
  if (materialA === materialB) {
    return 'C1';
  }

  const hopA = router.nextHop(materialA, materialB);
  const hopB = router.nextHop(materialB, materialA);

  const pairA = hopA !== null ? registry.resolvePair(materialA, hopA) : null;
  const pairB = hopB !== null ? registry.resolvePair(materialB, hopB) : null;

  if (pairA === null || pairB === null || hopA === null || hopB === null) {
    return 'C5';
  }

  const bothDirect = pairA.orientation === 'direct' && pairB.orientation === 'direct';
  if (!bothDirect) {
    return 'C4';
  }

  if (hopA === materialB && hopB === materialA) {
    return 'C2';
  }

  if (hopA === hopB && hopA !== materialA && hopA !== materialB) {
    return 'C3';
  }

  return 'C4';
}
