import type { Cell } from '@nookstead/shared';
import type { EditorLayerUnion } from './editor-types';
import type { TilesetInfo, MaterialInfo } from './material-types';

// ---------------------------------------------------------------------------
// Graph Types
// ---------------------------------------------------------------------------

/**
 * Undirected material compatibility graph.
 * If tileset A_B or B_A exists, both A→B and B→A edges are present.
 * Used by the BFS router to find shortest paths between materials.
 */
export type CompatGraph = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Directed material render graph.
 * A→B edge exists only if tileset A_B exists (not B_A).
 * Used to determine which cell can actually render a transition.
 */
export type RenderGraph = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Map from material key to numeric priority value.
 * Higher priority wins ownership conflicts during S1/S2 resolution.
 */
export type MaterialPriorityMap = ReadonlyMap<string, number>;

// ---------------------------------------------------------------------------
// Routing Table
// ---------------------------------------------------------------------------

/**
 * Precomputed all-pairs BFS routing table over the compatibility graph.
 * Immutable after construction; provides O(1) hop lookups.
 */
export interface RoutingTable {
  /**
   * Returns the first hop on the shortest path from `from` to `to`.
   * Returns `null` for same-material queries or unreachable pairs.
   */
  nextHop(from: string, to: string): string | null;

  /**
   * Returns `true` if a path exists from `from` to `to` in the compat graph.
   */
  hasRoute(from: string, to: string): boolean;
}

// ---------------------------------------------------------------------------
// Direction Types
// ---------------------------------------------------------------------------

/** Cardinal and ordinal neighbor direction labels. */
export type NeighborDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** Cardinal edge direction (used for edge ownership resolution). */
export type EdgeDirection = 'N' | 'E' | 'S' | 'W';

/** Cardinal edge direction constant: North. */
export const EDGE_N: EdgeDirection = 'N';
/** Cardinal edge direction constant: East. */
export const EDGE_E: EdgeDirection = 'E';
/** Cardinal edge direction constant: South. */
export const EDGE_S: EdgeDirection = 'S';
/** Cardinal edge direction constant: West. */
export const EDGE_W: EdgeDirection = 'W';

// ---------------------------------------------------------------------------
// Cell Cache Types
// ---------------------------------------------------------------------------

/**
 * Per-cell cached tileset selection and frame data.
 * Maintained by the RetileEngine for incremental updates.
 */
export interface CellCacheEntry {
  /** Foreground material key at this cell. */
  readonly fg: string;
  /** Tileset key selected by the routing pipeline (may differ from renderTilesetKey for SOLID_FRAME). */
  readonly selectedTilesetKey: string;
  /** Tileset key actually used for rendering (may fall back to baseTilesetKey for SOLID_FRAME). */
  readonly renderTilesetKey: string;
  /** Blob-47 frame index for this cell. */
  readonly frameId: number;
  /** Selected background material ('' for base mode). */
  readonly bg: string;
  /** Pair orientation: 'direct', 'reverse', or '' (base). */
  readonly orientation: 'direct' | 'reverse' | '';
}

/** 2D grid of per-cell cache entries. Indexed as `[y][x]`. */
export type CellCache = (CellCacheEntry | null)[][];

// ---------------------------------------------------------------------------
// Patch Types (Undo/Redo)
// ---------------------------------------------------------------------------

/**
 * A single cell's before/after state for undo/redo support.
 * Stores both the material change and the cache change.
 */
export interface CellPatchEntry {
  /** Cell x coordinate. */
  readonly x: number;
  /** Cell y coordinate. */
  readonly y: number;
  /** Material key before the change. */
  readonly oldFg: string;
  /** Material key after the change. */
  readonly newFg: string;
  /** Cache entry before the change (undefined for previously uncached cells). */
  readonly oldCache?: CellCacheEntry;
  /** Cache entry after the change. */
  readonly newCache?: CellCacheEntry;
}

// ---------------------------------------------------------------------------
// RetileEngine Types
// ---------------------------------------------------------------------------

/**
 * Result returned by all RetileEngine operations.
 * Contains the updated layers, undo patches, and metrics.
 */
export interface RetileResult {
  /** Updated editor layers with recomputed frames and tilesetKeys. */
  readonly layers: EditorLayerUnion[];
  /** Cell-level patches for undo/redo support. */
  readonly patches: ReadonlyArray<CellPatchEntry>;
  /** Number of cells that were recomputed in this operation. */
  readonly rebuiltCells: number;
  /** Updated grid with terrain changes applied (for applyMapPatch). */
  readonly grid: Cell[][];
}

/**
 * Constructor options for RetileEngine.
 */
export interface RetileEngineOptions {
  /** Map width in cells. */
  readonly width: number;
  /** Map height in cells. */
  readonly height: number;
  /** Available tileset descriptors. */
  readonly tilesets: ReadonlyArray<TilesetInfo>;
  /** Material definitions keyed by material key. */
  readonly materials: ReadonlyMap<string, MaterialInfo>;
  /** Material priority map for S1/S2 conflict resolution (optional; defaults to empty). */
  readonly materialPriority?: MaterialPriorityMap;
  /** BFS tie-break preference array (optional; earlier index = preferred). */
  readonly preferences?: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Edge Resolver Types
// ---------------------------------------------------------------------------

/**
 * Result of edge ownership resolution between two adjacent cells.
 */
export interface EdgeOwner {
  /** Material key of the cell that owns this edge. */
  readonly owner: string;
  /** Virtual background material determined by routing. */
  readonly bg: string;
  /** Tileset key for the owner's transition. */
  readonly tilesetKey: string;
}

/**
 * Input patch entry for applyMapPatch -- specifies a cell to paint.
 */
export interface MapPatchEntry {
  /** Cell x coordinate. */
  readonly x: number;
  /** Cell y coordinate. */
  readonly y: number;
  /** New foreground material key. */
  readonly fg: string;
}
