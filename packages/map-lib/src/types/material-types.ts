/**
 * Minimal tileset descriptor needed for autotile computations.
 * Extended from the original to include material relationship IDs.
 */
export interface TilesetInfo {
  /** Unique tileset key (e.g., "terrain-03"). */
  key: string;
  /** Human-readable tileset name (e.g., "water_grass"). */
  name: string;
  /** Material this tileset transitions FROM (UUID, optional for legacy tilesets). */
  fromMaterialId?: string;
  /** Material this tileset transitions TO (UUID, optional for legacy tilesets). */
  toMaterialId?: string;
}

/**
 * Material descriptor for painting and walkability.
 * Keyed by material name (e.g., "grass", "deep_water").
 */
export interface MaterialInfo {
  /** Material key matching the materials table key column. */
  key: string;
  /** Whether this material is walkable. */
  walkable: boolean;
  /** Render priority for layer ordering (higher = rendered on top). */
  renderPriority: number;
}
