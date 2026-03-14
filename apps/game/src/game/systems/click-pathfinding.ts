/**
 * Click-to-move pathfinding system module.
 *
 * Factory-function pattern (consistent with dialogue-lock.ts). Creates and
 * owns a Pathfinder instance, handles click→path→waypoints dispatch, and
 * manages visual feedback lifecycle (destination marker + rejection flash).
 */

import { Pathfinder } from '@nookstead/pathfinding';
import type { Point } from '@nookstead/pathfinding';
import { PLAYER_MAX_PATH_LENGTH } from '@nookstead/shared';
import type Phaser from 'phaser';

/** Minimal interface consumed from Player to avoid circular dependency. */
export interface ClickTarget {
  x: number;
  y: number;
  mapData: { walkable: boolean[][] };
  tileSize: number;
  setWaypoints(waypoints: Point[]): void;
}

export interface ClickPathfindingSystem {
  handleClick(worldX: number, worldY: number, player: ClickTarget): void;
  clearMarker(): void;
  destroy(): void;
}

export function createClickPathfindingSystem(
  scene: Phaser.Scene,
  walkable: boolean[][],
  tileSize: number,
): ClickPathfindingSystem {
  const pathfinder = new Pathfinder(walkable, PLAYER_MAX_PATH_LENGTH);

  /** Destination marker graphics object (at most one at a time). */
  let markerGraphics: Phaser.GameObjects.Graphics | null = null;
  /** Rejection flash graphics object (at most one at a time). */
  let flashGraphics: Phaser.GameObjects.Graphics | null = null;

  /**
   * Show a destination marker at the given tile position.
   * Removes any existing marker first to enforce the single-marker invariant.
   * Depth 10 places it above the tile layer (depth 0) but below the player
   * sprite (depth = player.y, typically 500-1000px range).
   */
  function showMarker(tileX: number, tileY: number): void {
    clearMarker();
    const graphics = scene.add.graphics();
    const px = tileX * tileSize;
    const py = tileY * tileSize;
    graphics.lineStyle(1, 0xffffff, 0.8);
    graphics.fillStyle(0xffffff, 0.2);
    graphics.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
    graphics.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
    graphics.setDepth(10);
    markerGraphics = graphics;
  }

  /**
   * Show a rejection flash (red overlay) at the given tile position.
   * The flash fades out over 300ms and self-destructs after the tween completes.
   * Cancels any in-progress flash to enforce the single-flash invariant.
   */
  function showRejectionFlash(tileX: number, tileY: number): void {
    if (flashGraphics) {
      flashGraphics.destroy();
      flashGraphics = null;
    }

    const graphics = scene.add.graphics();
    const px = tileX * tileSize;
    const py = tileY * tileSize;
    graphics.fillStyle(0xff0000, 0.5);
    graphics.fillRect(px, py, tileSize, tileSize);
    graphics.setDepth(10);
    flashGraphics = graphics;

    scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 300,
      ease: 'Linear',
      onComplete: () => {
        graphics.destroy();
        if (flashGraphics === graphics) {
          flashGraphics = null;
        }
      },
    });
  }

  /** Remove the destination marker if one exists. */
  function clearMarker(): void {
    markerGraphics?.destroy();
    markerGraphics = null;
  }

  function handleClick(worldX: number, worldY: number, player: ClickTarget): void {
    const tileX = Math.floor(worldX / tileSize);
    const tileY = Math.floor(worldY / tileSize);
    const walkableGrid = player.mapData.walkable;

    // Bounds and walkability check
    if (
      tileY < 0 || tileY >= walkableGrid.length ||
      tileX < 0 || tileX >= (walkableGrid[0]?.length ?? 0) ||
      !walkableGrid[tileY][tileX]
    ) {
      showRejectionFlash(tileX, tileY);
      return;
    }

    // Player's current tile (using feet position: y is at bottom edge of tile)
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = Math.floor((player.y - 1) / tileSize);

    const path = pathfinder.findPath(playerTileX, playerTileY, tileX, tileY);

    if (path.length === 0) {
      showRejectionFlash(tileX, tileY);
      return;
    }

    clearMarker();
    showMarker(tileX, tileY);
    player.setWaypoints(path);
  }

  /** Clean up all visual feedback objects. */
  function destroy(): void {
    clearMarker();
    if (flashGraphics) {
      flashGraphics.destroy();
      flashGraphics = null;
    }
  }

  return { handleClick, clearMarker, destroy };
}
