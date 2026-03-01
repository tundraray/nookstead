import type { TilesetInfo } from '../types/material-types';

/**
 * Result of resolving a transition pair with direct-first + reverse fallback.
 */
export interface ResolvedPair {
  /** The tileset key for this pair. */
  readonly tilesetKey: string;
  /** Whether the pair is direct (FG_BG exists) or reverse (BG_FG exists, inverted). */
  readonly orientation: 'direct' | 'reverse';
}

/**
 * Central registry for tileset metadata. Provides fast lookup by key,
 * by material pair, and base tileset queries.
 *
 * Constructed once from a tileset array; immutable after construction.
 * Entries without `fromMaterialKey` are silently skipped.
 */
export class TilesetRegistry {
  /** Map from tileset key to TilesetInfo. */
  private readonly byKey: ReadonlyMap<string, TilesetInfo>;

  /** Map from "from:to" compound key to tileset key string. */
  private readonly pairToKey: ReadonlyMap<string, string>;

  /** Map from material key to its base (standalone) tileset key. */
  private readonly baseKeys: ReadonlyMap<string, string>;

  /** All unique material keys found in the tileset data. */
  private readonly materials: ReadonlySet<string>;

  /** All transition pairs as [from, to] tuples. */
  private readonly transitionPairs: ReadonlyArray<readonly [string, string]>;

  /**
   * Create a new TilesetRegistry from an array of tileset descriptors.
   *
   * @param tilesets - Complete set of tilesets. Entries without `fromMaterialKey` are skipped.
   */
  constructor(tilesets: ReadonlyArray<TilesetInfo>) {
    const byKey = new Map<string, TilesetInfo>();
    const pairToKey = new Map<string, string>();
    const baseKeys = new Map<string, string>();
    const materialSet = new Set<string>();
    const pairs: Array<readonly [string, string]> = [];

    for (const ts of tilesets) {
      const from = ts.fromMaterialKey;
      if (!from) {
        continue;
      }

      byKey.set(ts.key, ts);
      materialSet.add(from);

      const to = ts.toMaterialKey;
      const isBase = !to || from === to;

      if (isBase) {
        baseKeys.set(from, ts.key);
      } else {
        // Transition tileset: both keys present and different
        const compoundKey = `${from}:${to}`;
        pairToKey.set(compoundKey, ts.key);
        pairs.push([from, to]);
        materialSet.add(to);
      }
    }

    this.byKey = byKey;
    this.pairToKey = pairToKey;
    this.baseKeys = baseKeys;
    this.materials = materialSet;
    this.transitionPairs = Object.freeze([...pairs]);
  }

  /**
   * Check if a transition tileset exists for the pair (fg, bg).
   * Self-edges (fg === bg) always return false.
   *
   * @param fg - Foreground material key.
   * @param bg - Background material key.
   * @returns `true` if a transition tileset exists for this pair.
   */
  hasTileset(fg: string, bg: string): boolean {
    if (fg === bg) return false;
    return this.pairToKey.has(`${fg}:${bg}`);
  }

  /**
   * Get the tileset key for a transition pair.
   * Returns `undefined` if no tileset exists for this pair
   * or if fg === bg.
   *
   * @param fg - Foreground material key.
   * @param bg - Background material key.
   * @returns The tileset key string, or `undefined`.
   */
  getTilesetKey(fg: string, bg: string): string | undefined {
    if (fg === bg) return undefined;
    return this.pairToKey.get(`${fg}:${bg}`);
  }

  /**
   * Get the base (standalone) tileset key for a material.
   * A base tileset has `fromMaterialKey` present but `toMaterialKey`
   * absent, or `fromMaterialKey === toMaterialKey`.
   *
   * @param material - Material key to look up.
   * @returns The base tileset key, or `undefined` if not found.
   */
  getBaseTilesetKey(material: string): string | undefined {
    return this.baseKeys.get(material);
  }

  /**
   * Get all unique material keys found in the tileset data.
   * Includes both `fromMaterialKey` and `toMaterialKey` values.
   *
   * @returns An immutable set of material key strings.
   */
  getAllMaterials(): ReadonlySet<string> {
    return this.materials;
  }

  /**
   * Get all transition pairs as `[fromMaterial, toMaterial]` tuples.
   * Base tilesets (self-edges) are not included.
   *
   * @returns An immutable array of `[from, to]` tuples.
   */
  getAllTransitionPairs(): ReadonlyArray<readonly [string, string]> {
    return this.transitionPairs;
  }

  /**
   * Get the full TilesetInfo for a given tileset key.
   *
   * @param key - The tileset key to look up.
   * @returns The TilesetInfo, or `undefined` if the key is unknown.
   */
  getTilesetInfo(key: string): TilesetInfo | undefined {
    return this.byKey.get(key);
  }

  /**
   * Resolve a transition pair using direct-first + reverse fallback.
   *
   * Rules (ADR-0011 Decision 7):
   * 1. If FG_BG tileset exists -> direct orientation.
   * 2. Else if BG_FG tileset exists -> reverse orientation.
   * 3. Else -> null (no pair available).
   * 4. If both exist -> always direct (direct takes precedence).
   *
   * Self-edges (fg === bg) always return null.
   *
   * @param fg - Foreground material key.
   * @param bg - Background material key.
   * @returns ResolvedPair with tilesetKey and orientation, or null if no pair exists.
   */
  resolvePair(fg: string, bg: string): ResolvedPair | null {
    if (fg === bg) return null;

    const directKey = this.pairToKey.get(`${fg}:${bg}`);
    if (directKey) {
      return { tilesetKey: directKey, orientation: 'direct' };
    }

    const reverseKey = this.pairToKey.get(`${bg}:${fg}`);
    if (reverseKey) {
      return { tilesetKey: reverseKey, orientation: 'reverse' };
    }

    return null;
  }

  /**
   * Check if a transition pair exists in either direction (direct or reverse).
   *
   * Convenience method equivalent to `resolvePair(fg, bg) !== null`.
   *
   * @param fg - Foreground material key.
   * @param bg - Background material key.
   * @returns `true` if a tileset exists for this pair in either direction.
   */
  hasPairOrReverse(fg: string, bg: string): boolean {
    if (fg === bg) return false;
    return this.pairToKey.has(`${fg}:${bg}`) || this.pairToKey.has(`${bg}:${fg}`);
  }
}
