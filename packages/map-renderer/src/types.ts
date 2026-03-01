/** Configuration for the MapRenderer. */
export interface MapRendererConfig {
  /** Size of each tile in world pixels. */
  tileSize: number;
  /** Size of each frame in the spritesheet (source pixels). */
  frameSize: number;
}

/** Default renderer configuration. */
export const DEFAULT_CONFIG: MapRendererConfig = {
  tileSize: 16,
  frameSize: 16,
};
