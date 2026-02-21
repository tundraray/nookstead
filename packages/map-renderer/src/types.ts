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

/** Camera zoom/pan configuration. */
export interface CameraConfig {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
}

/** Default camera configuration. */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  minZoom: 0.25,
  maxZoom: 4,
  zoomStep: 0.25,
};
