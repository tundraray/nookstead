import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { TILE_SIZE, FRAME_SIZE, MAP_WIDTH, MAP_HEIGHT, CLICK_THRESHOLD } from '../constants';
import { EMPTY_FRAME } from '@nookstead/map-lib';
import type { MapDataPayload, GeneratedMap } from '@nookstead/shared';
import type { Room } from '@colyseus/sdk';
import { PlayerManager } from '../multiplayer/PlayerManager';
import { Player } from '../entities/Player';
import { findSpawnTile } from '../systems/spawn';

export class Game extends Scene {
  private mapData: GeneratedMap | null = null;
  private rt!: Phaser.GameObjects.RenderTexture;
  private hover!: Phaser.GameObjects.Graphics;
  private playerManager!: PlayerManager;
  private player!: Player;
  private room: Room | null = null;
  private serverSpawnX: number | undefined;
  private serverSpawnY: number | undefined;

  constructor() {
    super('Game');
  }

  /**
   * Called by Phaser before create() with data from scene.start().
   * Receives mapData and room from LoadingScene.
   */
  init(data: { mapData: MapDataPayload; room?: Room }): void {
    // Cast MapDataPayload to GeneratedMap at the network boundary.
    // The structures are identical at runtime; the server generates
    // map data using the same pipeline. The only type-level difference
    // is SerializedCell.terrain (string) vs Cell.terrain (TerrainCellType).
    this.mapData = data.mapData as unknown as GeneratedMap;
    this.room = data.room ?? null;
    this.serverSpawnX = data.mapData.spawnX;
    this.serverSpawnY = data.mapData.spawnY;
  }

  create() {
    if (!this.mapData) {
      console.error('[Game] No mapData received from LoadingScene!');
      return;
    }

    const mapPixelW = MAP_WIDTH * TILE_SIZE;
    const mapPixelH = MAP_HEIGHT * TILE_SIZE;

    const tileScale = TILE_SIZE / FRAME_SIZE;

    // Render all layers to a single RenderTexture.
    this.rt = this.add.renderTexture(0, 0, mapPixelW, mapPixelH);
    const rt = this.rt;
    rt.setOrigin(0, 0);

    const stamp = this.add.sprite(0, 0, '').setScale(tileScale).setOrigin(0, 0).setVisible(false);

    for (const layerData of this.mapData.layers) {
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const frame = layerData.frames[y][x];
          if (frame === EMPTY_FRAME) continue;

          stamp.setTexture(layerData.terrainKey, frame);
          rt.draw(stamp, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }
    stamp.destroy();

    // Determine spawn position: prefer server-computed, fall back to client-side
    let spawnX: number;
    let spawnY: number;
    if (this.serverSpawnX != null && this.serverSpawnY != null) {
      spawnX = this.serverSpawnX;
      spawnY = this.serverSpawnY;
    } else {
      const spawn = findSpawnTile(
        this.mapData.walkable,
        this.mapData.grid,
        MAP_WIDTH,
        MAP_HEIGHT,
      );
      spawnX = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
      spawnY = (spawn.tileY + 1) * TILE_SIZE;
    }
    this.player = new Player(this, spawnX, spawnY, this.mapData);

    // Camera: follow player with lerp smoothing, bounded by map
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x215c81);
    cam.setBounds(0, 0, mapPixelW, mapPixelH);
    cam.startFollow(this.player, true, 0.1, 0.1);
    cam.setZoom(2);

    // Tile hover highlight
    this.hover = this.add.graphics();
    this.hover.setDepth(1);
    let prevTileX = -1;
    let prevTileY = -1;

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);

      if (tileX === prevTileX && tileY === prevTileY) return;
      prevTileX = tileX;
      prevTileY = tileY;

      this.hover.clear();
      if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;

      this.hover.lineStyle(1, 0xffffff, 0.6);
      this.hover.fillStyle(0xffffff, 0.12);
      this.hover.fillRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      this.hover.strokeRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });

    // Mouse wheel zoom
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        cam.zoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.25, 4);
      },
    );

    // Click-to-move: track pointer down position to distinguish clicks from drags
    let pointerDownX = 0;
    let pointerDownY = 0;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointerDownX = pointer.x;
      pointerDownY = pointer.y;
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - pointerDownX;
      const dy = pointer.y - pointerDownY;
      if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return;

      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;

      // Calculate pixel target (center of tile, bottom edge for feet alignment)
      const targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
      const targetY = (tileY + 1) * TILE_SIZE;

      // Move local player toward the clicked tile
      this.player.setMoveTarget(targetX, targetY);
    });

    // Re-fit camera when the canvas resizes
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      cam.setSize(gameSize.width, gameSize.height);
    });

    // Multiplayer — reuse existing room from LoadingScene to avoid duplicate connection
    this.playerManager = new PlayerManager(this);
    this.playerManager.setLocalPlayer(this.player);
    this.playerManager.connect(this.room ?? undefined);

    EventBus.emit('current-scene-ready', this);
  }

  /**
   * Per-frame update: drive remote sprite interpolation.
   * Local player movement is sent by WalkState via the Colyseus service.
   */
  override update(_time: number, delta: number): void {
    // Drive interpolation on all remote player sprites
    this.playerManager.update(delta);
  }

  shutdown(): void {
    this.playerManager.destroy();
  }
}
