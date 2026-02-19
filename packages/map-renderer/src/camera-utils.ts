import type { Scene } from 'phaser';
import type { CameraConfig } from './types';
import { DEFAULT_CAMERA_CONFIG } from './types';

/**
 * Adjust camera zoom and position to show the full map.
 */
export function fitToViewport(
  scene: Scene,
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
): void {
  const cam = scene.cameras.main;
  const mapPixelW = mapWidth * tileSize;
  const mapPixelH = mapHeight * tileSize;

  const zoomX = cam.width / mapPixelW;
  const zoomY = cam.height / mapPixelH;
  cam.setZoom(Math.min(zoomX, zoomY));

  cam.centerOn(mapPixelW / 2, mapPixelH / 2);
}

/**
 * Increase camera zoom by one step, capped at maxZoom.
 */
export function zoomIn(scene: Scene, config?: Partial<CameraConfig>): void {
  const { maxZoom, zoomStep } = { ...DEFAULT_CAMERA_CONFIG, ...config };
  const cam = scene.cameras.main;
  cam.setZoom(Math.min(cam.zoom + zoomStep, maxZoom));
}

/**
 * Decrease camera zoom by one step, capped at minZoom.
 */
export function zoomOut(scene: Scene, config?: Partial<CameraConfig>): void {
  const { minZoom, zoomStep } = { ...DEFAULT_CAMERA_CONFIG, ...config };
  const cam = scene.cameras.main;
  cam.setZoom(Math.max(cam.zoom - zoomStep, minZoom));
}

/**
 * Constrain camera bounds to the map dimensions.
 */
export function constrainCamera(
  scene: Scene,
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
): void {
  const cam = scene.cameras.main;
  cam.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize);
}
