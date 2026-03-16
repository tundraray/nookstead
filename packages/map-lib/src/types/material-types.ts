/**
 * Minimal tileset descriptor needed for autotile computations.
 * Material relationships are expressed via resolved keys (not UUIDs).
 */
export interface TilesetInfo {
  /** Unique tileset key (e.g., "terrain-03"). */
  key: string;
  /** Human-readable tileset name (e.g., "water_grass"). */
  name: string;
  /** Material key this tileset transitions FROM (e.g., 'grass'). */
  fromMaterialKey?: string;
  /** Material key this tileset transitions TO (e.g., 'deep_water'). */
  toMaterialKey?: string;
}

/**
 * Material descriptor for painting and walkability.
 * Keyed by material name (e.g., "grass", "deep_water").
 */
export interface MaterialInfo {
  /** Material key matching the materials table key column. */
  key: string;
  /** Hex color for palette swatch fallback (e.g., "#2d6a4f"). */
  color: string;
  /** Whether this material is walkable. */
  walkable: boolean;
  /** Render priority for layer ordering (higher = rendered on top). */
  renderPriority: number;
  /** Tileset key used for palette swatch rendering (optional; color fallback if absent). */
  baseTilesetKey?: string;
  /** Whether this material can be tilled with a hoe (ADR-0017 D2). */
  diggable: boolean;
  /** Whether fishing is allowed on this material. */
  fishable: boolean;
  /** Whether a watering can can be refilled here. */
  waterSource: boolean;
  /** Whether buildings/structures can be placed on this material. */
  buildable: boolean;
  /** Surface type for step sounds and planting logic. */
  surfaceType: string | null;
}
